create or replace function public.wallet_run_security_audit(
  p_triggered_by uuid,
  p_triggered_by_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_role text := lower(coalesce(p_triggered_by_role, ''));
  v_run_id uuid;
  v_checks jsonb := '[]'::jsonb;
  v_findings jsonb := '[]'::jsonb;
  v_recommendations jsonb := '[]'::jsonb;
  v_layers jsonb := '{}'::jsonb;
  v_score integer := 100;
  v_status text := 'success';
  v_severity text := 'aman';
  v_count integer := 0;
  v_control public.wallet_system_controls%rowtype;
  v_latest_reconciliation public.wallet_reconciliation_runs%rowtype;
  v_latest_integrity public.wallet_ledger_integrity_runs%rowtype;
  v_parent_threshold integer := 0;
  v_rls_disabled_count integer := 0;
  v_anon_grant_count integer := 0;
  v_missing_cron_count integer := 0;
  v_kantin_without_device_count integer := 0;
  v_active_device_inactive_account_count integer := 0;
  v_active_merchant_without_user_count integer := 0;
  v_negative_merchant_balance_count integer := 0;
  v_merchant_balance_mismatch_count integer := 0;
  v_stale_settlement_count integer := 0;
  v_pending_settlement_mismatch_count integer := 0;
  v_summary text;
begin
  if v_role not in ('super_admin','bendahara','rois','dewan') then
    raise exception 'Role tidak boleh menjalankan audit keamanan dompet';
  end if;

  insert into public.wallet_security_audit_runs (triggered_by, triggered_by_role)
  values (p_triggered_by, v_role)
  returning id into v_run_id;

  select * into v_control
  from public.wallet_system_controls
  where key = 'wallet_transactions';

  v_parent_threshold := coalesce((v_control.metadata->>'parent_approval_required_above')::int, 0);

  if coalesce(v_control.is_frozen, false) then
    v_score := v_score - 25;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Database','name','Freeze switch global','status','critical','label','Sistem dompet sedang dibekukan','details',jsonb_build_object('reason', v_control.freeze_reason, 'frozen_at', v_control.frozen_at)));
    v_findings := v_findings || jsonb_build_array('Sistem transaksi dompet sedang freeze. Transaksi baru harus ditahan sampai alasan freeze selesai.');
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Database','name','Freeze switch global','status','ok','label','Sistem dompet tidak sedang dibekukan'));
  end if;

  if v_parent_threshold = 75000 then
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','App','name','Batas persetujuan wali','status','ok','label','Persetujuan wali wajib untuk transaksi di atas Rp75.000','details',jsonb_build_object('threshold', v_parent_threshold)));
  else
    v_score := v_score - 15;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','App','name','Batas persetujuan wali','status','warning','label','Batas persetujuan wali belum sesuai Rp75.000','details',jsonb_build_object('current_threshold', v_parent_threshold)));
    v_recommendations := v_recommendations || jsonb_build_array('Set parent_approval_required_above menjadi 75000 dan pastikan Android meminta persetujuan wali hanya untuk nominal di atas batas ini.');
  end if;

  select * into v_latest_reconciliation from public.wallet_reconciliation_runs order by started_at desc limit 1;
  if v_latest_reconciliation.id is null then
    v_score := v_score - 20;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Database','name','Rekonsiliasi otomatis','status','critical','label','Belum ada hasil rekonsiliasi'));
    v_findings := v_findings || jsonb_build_array('Rekonsiliasi belum pernah berjalan. Sistem belum punya safety net saldo vs ledger.');
  elsif v_latest_reconciliation.status <> 'success' or coalesce(v_latest_reconciliation.difference_internal, 0) <> 0 then
    v_score := v_score - 25;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Database','name','Rekonsiliasi otomatis','status','critical','label','Rekonsiliasi terakhir bermasalah','details',jsonb_build_object('run_id', v_latest_reconciliation.id, 'status', v_latest_reconciliation.status, 'difference_internal', v_latest_reconciliation.difference_internal, 'started_at', v_latest_reconciliation.started_at)));
    v_findings := v_findings || jsonb_build_array('Saldo cepat dan ledger tidak cocok pada rekonsiliasi terakhir.');
  elsif v_latest_reconciliation.started_at < now() - interval '2 hours' then
    v_score := v_score - 10;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Database','name','Rekonsiliasi otomatis','status','warning','label','Rekonsiliasi terakhir sudah lebih dari 2 jam','details',jsonb_build_object('started_at', v_latest_reconciliation.started_at)));
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Database','name','Rekonsiliasi otomatis','status','ok','label','Rekonsiliasi terakhir cocok dan masih baru','details',jsonb_build_object('started_at', v_latest_reconciliation.started_at)));
  end if;

  select * into v_latest_integrity from public.wallet_ledger_integrity_runs order by started_at desc limit 1;
  if v_latest_integrity.id is null then
    v_score := v_score - 20;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Data','name','Hash-chain ledger','status','critical','label','Belum ada pemeriksaan hash-chain'));
    v_findings := v_findings || jsonb_build_array('Hash-chain ledger belum pernah diverifikasi.');
  elsif v_latest_integrity.status <> 'success' then
    v_score := v_score - 30;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Data','name','Hash-chain ledger','status','critical','label','Hash-chain ledger terakhir gagal','details',jsonb_build_object('run_id', v_latest_integrity.id, 'broken_at', v_latest_integrity.broken_at)));
    v_findings := v_findings || jsonb_build_array('Ledger dompet menunjukkan indikasi rusak/tidak konsisten.');
  elsif v_latest_integrity.started_at < now() - interval '26 hours' then
    v_score := v_score - 8;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Data','name','Hash-chain ledger','status','warning','label','Pemeriksaan hash-chain sudah lebih dari 26 jam','details',jsonb_build_object('started_at', v_latest_integrity.started_at)));
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Data','name','Hash-chain ledger','status','ok','label','Hash-chain ledger terakhir valid','details',jsonb_build_object('checked_entries', v_latest_integrity.checked_entries)));
  end if;

  select count(*) into v_count from public.wallet_risk_events where status in ('open','acknowledged','investigating','escalated') and severity in ('high','critical');
  if v_count > 0 then
    v_score := v_score - least(30, v_count * 10);
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','API','name','Peringatan keamanan aktif','status',case when v_count >= 3 then 'critical' else 'warning' end,'label','Ada peringatan keamanan tinggi/kritis yang belum selesai','details',jsonb_build_object('count', v_count)));
    v_findings := v_findings || jsonb_build_array('Masih ada risk event tinggi/kritis yang belum selesai.');
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','API','name','Peringatan keamanan aktif','status','ok','label','Tidak ada peringatan tinggi/kritis terbuka'));
  end if;

  select count(*) into v_count from public.wallet_disputes where status in ('open','investigating') and response_due_at is not null and response_due_at < now();
  if v_count > 0 then
    v_score := v_score - least(20, v_count * 8);
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','App','name','SLA laporan wali','status','warning','label','Ada laporan wali melewati SLA','details',jsonb_build_object('count', v_count)));
    v_recommendations := v_recommendations || jsonb_build_array('Selesaikan dispute yang melewati SLA dan eskalasi ke super admin bila belum ada tindak lanjut.');
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','App','name','SLA laporan wali','status','ok','label','Tidak ada laporan wali lewat SLA'));
  end if;

  select count(*) into v_count from public.notification_queue where priority = 'critical' and coalesce(status, 'pending') <> 'sent' and coalesce(wallet_review_status, '') not in ('reviewed','resolved','ignored_dummy') and created_at >= now() - interval '7 days';
  if v_count > 0 then
    v_score := v_score - least(20, v_count * 5);
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','App','name','Notifikasi kritis','status','critical','label','Ada notifikasi kritis yang belum terkirim/selesai','details',jsonb_build_object('count', v_count)));
    v_findings := v_findings || jsonb_build_array('Notifikasi kritis belum berhasil dikirim atau belum selesai diproses.');
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','App','name','Notifikasi kritis','status','ok','label','Tidak ada notifikasi kritis tertahan'));
  end if;

  select count(*) into v_count from public.kantin_devices where status in ('pending','suspended','revoked');
  if v_count > 0 then
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','API','name','Device kantin','status','warning','label','Ada device kantin tidak aktif yang perlu diawasi','details',jsonb_build_object('count', v_count)));
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','API','name','Device kantin','status','ok','label','Semua device kantin terdaftar dalam status aktif'));
  end if;

  select count(*) into v_kantin_without_device_count
  from public.profiles p
  where lower(coalesce(p.role, '')) = 'kantin'
    and coalesce(p.is_active, false)
    and not exists (select 1 from public.kantin_devices kd where kd.kantin_user_id = p.id and kd.status = 'active');

  select count(*) into v_active_device_inactive_account_count
  from public.kantin_devices kd
  left join public.profiles p on p.id = kd.kantin_user_id
  where kd.status = 'active'
    and (p.id is null or not coalesce(p.is_active, false) or lower(coalesce(p.role, '')) <> 'kantin');

  select count(*) into v_active_merchant_without_user_count
  from public.wallet_merchants wm
  where wm.status = 'active'
    and not exists (
      select 1
      from public.wallet_merchant_users wmu
      join public.profiles p on p.id = wmu.profile_id
      where wmu.merchant_id = wm.id
        and wmu.status = 'active'
        and coalesce(p.is_active, false)
        and lower(coalesce(p.role, '')) = 'kantin'
    );

  if v_kantin_without_device_count > 0 or v_active_device_inactive_account_count > 0 or v_active_merchant_without_user_count > 0 then
    v_score := v_score - least(25, (v_kantin_without_device_count + v_active_device_inactive_account_count + v_active_merchant_without_user_count) * 8);
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'layer','API',
      'name','Kesiapan akses kantin',
      'status', case when v_active_device_inactive_account_count > 0 then 'critical' else 'warning' end,
      'label','Ada konfigurasi akun/device/merchant kantin yang belum aman',
      'details',jsonb_build_object(
        'akun_kantin_aktif_tanpa_device_aktif', v_kantin_without_device_count,
        'device_aktif_milik_akun_tidak_valid', v_active_device_inactive_account_count,
        'merchant_aktif_tanpa_user_kantin_aktif', v_active_merchant_without_user_count
      )
    ));
    if v_active_device_inactive_account_count > 0 then
      v_findings := v_findings || jsonb_build_array('Ada device kantin aktif yang terhubung ke akun tidak aktif/tidak valid. Revoke device tersebut sebelum operasional kantin dilanjutkan.');
    end if;
    v_recommendations := v_recommendations || jsonb_build_array('Buka Manajemen Kantin, pastikan setiap merchant aktif punya akun kantin aktif dan setiap transaksi hanya dari device aktif yang dipercaya.');
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','API','name','Kesiapan akses kantin','status','ok','label','Akun, device, dan merchant kantin aktif sudah konsisten'));
  end if;

  select count(*) into v_negative_merchant_balance_count
  from public.wallet_merchant_balances
  where saldo_available < 0 or saldo_pending_settlement < 0 or total_sales < 0 or total_settled < 0;

  with latest_ledger as (
    select distinct on (merchant_id, outlet_id)
      merchant_id, outlet_id, balance_available_after, pending_settlement_after
    from public.wallet_merchant_ledger
    order by merchant_id, outlet_id, id desc
  )
  select count(*) into v_merchant_balance_mismatch_count
  from public.wallet_merchant_balances b
  join latest_ledger l
    on l.merchant_id = b.merchant_id
   and l.outlet_id is not distinct from b.outlet_id
  where coalesce(l.balance_available_after, 0) <> coalesce(b.saldo_available, 0)
     or coalesce(l.pending_settlement_after, 0) <> coalesce(b.saldo_pending_settlement, 0);

  select count(*) into v_stale_settlement_count
  from public.wallet_merchant_settlement_requests
  where status in ('requested','approved')
    and created_at < now() - interval '2 days';

  with pending_requests as (
    select merchant_id, outlet_id, sum(amount)::bigint as pending_amount
    from public.wallet_merchant_settlement_requests
    where status in ('requested','approved')
    group by merchant_id, outlet_id
  )
  select count(*) into v_pending_settlement_mismatch_count
  from pending_requests pr
  left join public.wallet_merchant_balances b
    on b.merchant_id = pr.merchant_id
   and b.outlet_id is not distinct from pr.outlet_id
  where coalesce(pr.pending_amount, 0) > coalesce(b.saldo_pending_settlement, 0);

  if v_negative_merchant_balance_count > 0 or v_merchant_balance_mismatch_count > 0 or v_pending_settlement_mismatch_count > 0 then
    v_score := v_score - least(35, (v_negative_merchant_balance_count + v_merchant_balance_mismatch_count + v_pending_settlement_mismatch_count) * 12);
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'layer','Database',
      'name','Saldo dan ledger merchant kantin',
      'status','critical',
      'label','Ada ketidaksesuaian saldo merchant kantin',
      'details',jsonb_build_object(
        'saldo_negatif', v_negative_merchant_balance_count,
        'cached_balance_tidak_cocok_dengan_ledger_terakhir', v_merchant_balance_mismatch_count,
        'pending_request_melebihi_saldo_pending', v_pending_settlement_mismatch_count
      )
    ));
    v_findings := v_findings || jsonb_build_array('Saldo/ledger merchant kantin tidak konsisten. Freeze operasional kantin besar dan lakukan rekonsiliasi sebelum pencairan baru.');
    v_recommendations := v_recommendations || jsonb_build_array('Tahan pencairan merchant, jalankan rekonsiliasi, cocokkan ledger merchant terakhir dengan saldo cached, lalu koreksi hanya lewat ledger resmi.');
  elsif v_stale_settlement_count > 0 then
    v_score := v_score - least(15, v_stale_settlement_count * 5);
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Database','name','Saldo dan ledger merchant kantin','status','warning','label','Ada pengajuan pencairan kantin yang tertahan lebih dari 2 hari','details',jsonb_build_object('pencairan_tertahan', v_stale_settlement_count)));
    v_recommendations := v_recommendations || jsonb_build_array('Review pengajuan pencairan kantin yang tertahan agar tidak menjadi sengketa operasional.');
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Database','name','Saldo dan ledger merchant kantin','status','ok','label','Saldo merchant, pending settlement, dan ledger terakhir konsisten'));
  end if;

  select count(*) into v_count from public.wallet_pin_attempts where attempt_status = 'failed' and created_at >= now() - interval '1 hour';
  if v_count >= 10 then
    v_score := v_score - 20;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Data','name','Percobaan PIN gagal','status','critical','label','Percobaan PIN gagal sangat tinggi dalam 1 jam terakhir','details',jsonb_build_object('failed_attempts_1h', v_count)));
    v_findings := v_findings || jsonb_build_array('Ada indikasi brute-force PIN.');
  elsif v_count >= 3 then
    v_score := v_score - 8;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Data','name','Percobaan PIN gagal','status','warning','label','Ada percobaan PIN gagal berulang','details',jsonb_build_object('failed_attempts_1h', v_count)));
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Data','name','Percobaan PIN gagal','status','ok','label','Percobaan PIN gagal dalam batas wajar'));
  end if;

  select count(*) into v_rls_disabled_count
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and c.relname in ('dompet_santri','crypto_keystores','wallet_devices','wallet_payment_intents','wallet_authorization_sessions','transaksi_dompet','wallet_nonces','wallet_nonce_uses','wallet_card_qr_versions','wallet_key_rotation_logs','wallet_audit_logs','wallet_merchants','wallet_merchant_outlets','wallet_merchant_users','wallet_merchant_balances','wallet_merchant_ledger','wallet_merchant_settlement_requests','wallet_card_tokens','wallet_system_controls','wallet_reconciliation_runs','wallet_risk_events','kantin_devices','wallet_disputes','wallet_ledger_integrity_runs','wallet_pin_attempts','wallet_weekly_digest_runs','wallet_security_audit_runs')
    and not c.relrowsecurity;

  select count(*) into v_anon_grant_count
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'anon'
    and table_name in ('dompet_santri','crypto_keystores','wallet_devices','wallet_payment_intents','wallet_authorization_sessions','transaksi_dompet','wallet_nonces','wallet_nonce_uses','wallet_card_qr_versions','wallet_key_rotation_logs','wallet_audit_logs','wallet_merchants','wallet_merchant_outlets','wallet_merchant_users','wallet_merchant_balances','wallet_merchant_ledger','wallet_merchant_settlement_requests','wallet_card_tokens','wallet_system_controls','wallet_reconciliation_runs','wallet_risk_events','kantin_devices','wallet_disputes','wallet_ledger_integrity_runs','wallet_pin_attempts','wallet_weekly_digest_runs','wallet_security_audit_runs');

  if v_rls_disabled_count > 0 or v_anon_grant_count > 0 then
    v_score := v_score - 35;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Database','name','RLS dan akses publik','status','critical','label','Ada tabel dompet tanpa RLS atau grant anon','details',jsonb_build_object('rls_disabled', v_rls_disabled_count, 'anon_grants', v_anon_grant_count)));
    v_findings := v_findings || jsonb_build_array('RLS/grant publik pada tabel dompet perlu diperiksa segera.');
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Database','name','RLS dan akses publik','status','ok','label','Tabel dompet/kantin memakai RLS dan tidak ada grant anon terdeteksi'));
  end if;

  if coalesce(v_control.metadata->>'qr_payload_policy', '') = 'opaque_public_id_only' then
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Data','name','Payload QR kartu','status','ok','label','QR hanya boleh berisi public id acak, bukan NIS/nama/saldo/PIN'));
  else
    v_score := v_score - 15;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Data','name','Payload QR kartu','status','warning','label','Kebijakan payload QR belum dikunci sebagai opaque public id'));
  end if;

  if coalesce((v_control.metadata->>'argon2id_required_for_pin_verifier')::boolean, false) then
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Data','name','Argon2id untuk PIN','status','ok','label','PIN/verifier wajib memakai Argon2id dengan parameter adaptif Android','details',jsonb_build_object('target_ms', v_control.metadata->>'argon2id_target_ms_android', 'memory_low_mb', v_control.metadata->>'argon2id_memory_mb_android_low', 'memory_normal_mb', v_control.metadata->>'argon2id_memory_mb_android_normal')));
  else
    v_score := v_score - 15;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Data','name','Argon2id untuk PIN','status','warning','label','Argon2id belum diwajibkan untuk verifier PIN'));
  end if;

  select count(*) into v_missing_cron_count
  from (values ('wallet-reconciliation-hourly'),('wallet-ledger-integrity-daily'),('wallet-push-notifications-every-minute'),('wallet-dispute-sla-hourly'),('wallet-weekly-digest-sunday')) expected(jobname)
  where not exists (select 1 from cron.job j where j.jobname = expected.jobname);

  if v_missing_cron_count > 0 then
    v_score := v_score - least(20, v_missing_cron_count * 5);
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','App','name','Jadwal otomatis','status','warning','label','Ada jadwal otomatis dompet yang belum aktif','details',jsonb_build_object('missing_count', v_missing_cron_count)));
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','App','name','Jadwal otomatis','status','ok','label','Jadwal otomatis utama terdaftar'));
  end if;

  v_score := greatest(0, least(100, v_score));
  if v_score < 55 then
    v_status := 'critical'; v_severity := 'kritis';
  elsif v_score < 75 then
    v_status := 'warning'; v_severity := 'berisiko';
  elsif v_score < 90 then
    v_status := 'warning'; v_severity := 'perlu_perhatian';
  else
    v_status := 'success'; v_severity := 'aman';
  end if;

  v_layers := jsonb_build_object(
    'Network', jsonb_build_object('status', 'manual_review', 'label', 'Cloud Armor, DDoS, dan WAF diverifikasi di provider hosting'),
    'App', jsonb_build_object('status', case when v_score >= 75 then 'ok' else 'review' end, 'label', 'Rate limit, idempotency, notifikasi, jadwal otomatis, dan limit wali'),
    'API', jsonb_build_object('status', case when v_score >= 75 then 'ok' else 'review' end, 'label', 'Role, device kantin, assignment merchant, signature request, dan risk event'),
    'Database', jsonb_build_object('status', case when v_rls_disabled_count = 0 and v_anon_grant_count = 0 then 'ok' else 'critical' end, 'label', 'RLS, rekonsiliasi, saldo merchant, settlement, freeze switch, dan audit log'),
    'Data', jsonb_build_object('status', case when v_latest_integrity.status = 'success' then 'ok' else 'review' end, 'label', 'AES-256/pgcrypto, hash-chain, Argon2id, QR opaque, dan ledger merchant')
  );

  if jsonb_array_length(v_findings) = 0 then
    v_findings := jsonb_build_array('Tidak ada temuan kritis dari pemeriksaan otomatis. Tetap lakukan review manual untuk lapisan network/WAF/provider.');
  end if;

  if jsonb_array_length(v_recommendations) = 0 then
    v_recommendations := jsonb_build_array('Pertahankan jadwal rekonsiliasi, verifikasi hash-chain, review device/merchant kantin, pencairan, dan audit notifikasi kritis secara rutin.');
  end if;

  v_summary := 'Skor audit keamanan dompet ' || v_score || '/100. Status: ' || v_severity || '. Pemeriksaan mencakup rekonsiliasi, hash-chain, risk event, dispute, notifikasi kritis, device kantin, assignment merchant, saldo dan ledger merchant, settlement, PIN, RLS, QR opaque, Argon2id, dan jadwal otomatis. Lapisan network/WAF tetap harus diverifikasi manual di provider hosting.';

  update public.wallet_security_audit_runs
  set finished_at = now(), status = v_status, score = v_score, severity = v_severity,
      layer_summary = v_layers, checks = v_checks, findings = v_findings,
      recommendations = v_recommendations, ai_summary = v_summary,
      metadata = jsonb_build_object(
        'audit_engine', 'deterministic_ai_ready_v2_kantin_merchant',
        'parent_approval_required_above', 75000,
        'contains_sensitive_payload', false,
        'kantin_checks', jsonb_build_object(
          'akun_kantin_aktif_tanpa_device_aktif', v_kantin_without_device_count,
          'device_aktif_milik_akun_tidak_valid', v_active_device_inactive_account_count,
          'merchant_aktif_tanpa_user_kantin_aktif', v_active_merchant_without_user_count,
          'saldo_merchant_negatif', v_negative_merchant_balance_count,
          'saldo_merchant_mismatch_ledger', v_merchant_balance_mismatch_count,
          'pencairan_tertahan', v_stale_settlement_count,
          'pending_settlement_mismatch', v_pending_settlement_mismatch_count
        )
      )
  where id = v_run_id;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, record_id, metadata)
  values (p_triggered_by, v_role, 'wallet_run_security_audit', 'wallet_security_audit_runs', v_run_id::text, jsonb_build_object('score', v_score, 'severity', v_severity, 'engine', 'deterministic_ai_ready_v2_kantin_merchant'));

  return (select to_jsonb(r) from public.wallet_security_audit_runs r where r.id = v_run_id);
exception
  when others then
    if v_run_id is not null then
      update public.wallet_security_audit_runs
      set finished_at = now(), status = 'failed', severity = 'kritis', score = 0,
          findings = jsonb_build_array(sqlerrm),
          recommendations = jsonb_build_array('Periksa error audit keamanan dan jalankan ulang setelah penyebabnya diperbaiki.'),
          ai_summary = 'Audit keamanan gagal dijalankan: ' || sqlerrm
      where id = v_run_id;
    end if;
    raise;
end;
$$;

revoke all on function public.wallet_run_security_audit(uuid, text) from public, anon, authenticated;
grant execute on function public.wallet_run_security_audit(uuid, text) to service_role;
