import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type WalletRole = "super_admin" | "rois" | "dewan" | "bendahara" | "kantin";

const READ_ROLES = new Set<WalletRole>(["super_admin", "rois", "dewan", "bendahara", "kantin"]);
const MANAGE_ROLES = new Set<WalletRole>(["super_admin", "rois", "bendahara"]);
const MUTATION_ROLES = new Set<WalletRole>(["super_admin", "rois", "bendahara"]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const cleanText = (value: unknown) => String(value ?? "").trim();

const requirePositiveAmount = (value: unknown) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
    throw new Error("Nominal harus bilangan bulat lebih dari 0.");
  }
  return amount;
};

const idempotencyKey = (prefix: string, actorId: string) =>
  `${prefix}:${actorId}:${crypto.randomUUID()}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!supabaseUrl || !serviceKey) throw new Error("Supabase environment is not configured.");
    if (!token) return json({ error: "Authorization token wajib dikirim." }, 401);

    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await service.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Token tidak valid." }, 401);

    const { data: profile, error: profileError } = await service
      .from("profiles")
      .select("id, role, full_name, is_active")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    const role = cleanText(profile?.role).toLowerCase() as WalletRole;
    if (!profile?.is_active || !READ_ROLES.has(role)) {
      return json({ error: "Role tidak memiliki akses dompet santri." }, 403);
    }

    const body = await req.json();
    const action = cleanText(body.action);

    if (action === "lookup_qr") {
      const walletPublicId = cleanText(body.wallet_public_id);
      if (!walletPublicId) throw new Error("wallet_public_id wajib diisi.");

      const { data, error } = await service
        .from("dompet_santri")
        .select("santri_nis,wallet_public_id,saldo,status,low_balance_threshold,single_transaction_limit,santri(nama,kelas,jurusan,status_santri)")
        .eq("wallet_public_id", walletPublicId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return json({ error: "QR dompet tidak ditemukan atau sudah diganti." }, 404);

      await service.from("wallet_audit_logs").insert({
        actor_id: profile.id,
        actor_role: role,
        action: "wallet_lookup_qr",
        resource: "dompet_santri",
        santri_nis: data.santri_nis,
        record_id: walletPublicId,
        user_agent: req.headers.get("User-Agent"),
        metadata: { role },
      });

      return json({ data });
    }

    if (!MANAGE_ROLES.has(role)) {
      return json({ error: "Role ini hanya boleh membaca data dompet." }, 403);
    }

    if (action === "lock_account" || action === "unlock_account") {
      const santriNis = cleanText(body.santri_nis);
      const reason = cleanText(body.reason) || (action === "lock_account" ? "Admin wallet lock" : "Admin wallet unlock");
      const rpcName = action === "lock_account" ? "wallet_lock_account" : "wallet_unlock_account";
      const { data, error } = await service.rpc(rpcName, {
        p_santri_nis: santriNis,
        p_actor_id: profile.id,
        p_actor_role: role,
        p_reason: reason,
      });
      if (error) throw error;
      return json({ data });
    }

    if (action === "reissue_card_qr") {
      const santriNis = cleanText(body.santri_nis);
      const reason = cleanText(body.reason) || "Reissue QR kartu santri";
      const { data, error } = await service.rpc("wallet_reissue_card_qr", {
        p_santri_nis: santriNis,
        p_actor_id: profile.id,
        p_actor_role: role,
        p_reason: reason,
      });
      if (error) throw error;
      return json({ data });
    }

    if (action === "register_kantin_device") {
      const kantinUserId = cleanText(body.kantin_user_id);
      const deviceId = cleanText(body.device_id);
      const deviceFingerprint = cleanText(body.device_fingerprint);
      const publicKey = cleanText(body.public_key);

      if (!kantinUserId) throw new Error("kantin_user_id wajib diisi.");
      if (!deviceId) throw new Error("device_id wajib diisi.");
      if (!deviceFingerprint) throw new Error("device_fingerprint wajib diisi.");
      if (!publicKey) throw new Error("public_key wajib diisi.");

      const { data, error } = await service.rpc("wallet_register_kantin_device", {
        p_kantin_user_id: kantinUserId,
        p_device_id: deviceId,
        p_device_fingerprint: deviceFingerprint,
        p_public_key: publicKey,
        p_registered_by: profile.id,
        p_metadata: {
          source: "admin_panel",
          action,
          actor_name: profile.full_name,
        },
      });
      if (error) throw error;
      return json({ data });
    }

    if (action === "set_kantin_device_status") {
      const deviceId = cleanText(body.device_id);
      const status = cleanText(body.status);
      const reason = cleanText(body.reason);

      if (!deviceId) throw new Error("device_id wajib diisi.");
      if (!["active", "suspended", "revoked"].includes(status)) throw new Error("Status device kantin tidak valid.");

      const { data, error } = await service.rpc("wallet_set_kantin_device_status", {
        p_device_id: deviceId,
        p_status: status,
        p_actor_id: profile.id,
        p_reason: reason || null,
      });
      if (error) throw error;
      return json({ data });
    }

    if (action === "set_kantin_account_status") {
      const kantinUserId = cleanText(body.kantin_user_id);
      const isActive = Boolean(body.is_active);
      const reason = cleanText(body.reason) || (isActive ? "Aktivasi akun kantin" : "Nonaktifkan akun kantin");

      if (!kantinUserId) throw new Error("kantin_user_id wajib diisi.");

      const { data, error } = await service.rpc("wallet_set_kantin_account_status", {
        p_kantin_user_id: kantinUserId,
        p_is_active: isActive,
        p_actor_id: profile.id,
        p_reason: reason,
      });
      if (error) throw error;
      return json({ data });
    }

    if (action === "run_reconciliation") {
      if (!MUTATION_ROLES.has(role)) return json({ error: "Tidak boleh menjalankan rekonsiliasi." }, 403);

      const reservedBankBalance =
        body.reserved_bank_balance === undefined || body.reserved_bank_balance === null || body.reserved_bank_balance === ""
          ? null
          : Number(body.reserved_bank_balance);

      if (reservedBankBalance !== null && (!Number.isInteger(reservedBankBalance) || reservedBankBalance < 0)) {
        throw new Error("reserved_bank_balance harus bilangan bulat >= 0.");
      }

      const { data, error } = await service.rpc("wallet_run_reconciliation", {
        p_reserved_bank_balance: reservedBankBalance,
        p_triggered_by: profile.id,
      });
      if (error) throw error;
      return json({ data });
    }

    if (action === "run_ledger_integrity_check") {
      if (!MUTATION_ROLES.has(role)) return json({ error: "Tidak boleh menjalankan verifikasi ledger." }, 403);

      const santriNis = cleanText(body.santri_nis) || null;
      const fromDate = cleanText(body.from_date) || null;

      const { data, error } = await service.rpc("wallet_run_ledger_integrity_check", {
        p_santri_nis: santriNis,
        p_from_date: fromDate,
      });
      if (error) throw error;
      return json({ data });
    }

    if (action === "set_system_freeze") {
      if (!MUTATION_ROLES.has(role)) return json({ error: "Tidak boleh mengubah freeze switch." }, 403);

      const isFrozen = Boolean(body.is_frozen);
      const reason = cleanText(body.reason) || (isFrozen ? "Manual wallet system freeze" : "Manual wallet system unfreeze");

      const { data, error } = await service.rpc("wallet_set_system_freeze", {
        p_is_frozen: isFrozen,
        p_reason: reason,
        p_actor_id: profile.id,
        p_metadata: {
          source: "admin_panel",
          action,
          actor_name: profile.full_name,
        },
      });
      if (error) throw error;
      return json({ data });
    }

    if (action === "post_adjustment") {
      if (!MUTATION_ROLES.has(role)) return json({ error: "Tidak boleh membuat transaksi dompet." }, 403);

      const santriNis = cleanText(body.santri_nis);
      const direction = cleanText(body.direction);
      const category = cleanText(body.category) || "correction";
      const amount = requirePositiveAmount(body.amount);
      const keterangan = cleanText(body.keterangan);
      const allowedCategories = new Set([
        "correction",
        "refund",
        "account_migration_in",
        "account_migration_out",
        "settlement_to_pesantren_ledger",
      ]);

      if (!["credit", "debit"].includes(direction)) throw new Error("Arah transaksi tidak valid.");
      if (!allowedCategories.has(category)) throw new Error("Kategori transaksi admin tidak valid.");
      if (!keterangan || keterangan.length < 12) {
        throw new Error("Keterangan minimal 12 karakter untuk audit.");
      }

      const { data, error } = await service.rpc("wallet_post_transaction", {
        p_santri_nis: santriNis,
        p_direction: direction,
        p_category: category,
        p_amount: amount,
        p_actor_id: profile.id,
        p_actor_role: role,
        p_idempotency_key: idempotencyKey("wallet-admin-adjustment", profile.id),
        p_keterangan: keterangan,
        p_metadata: {
          source: "admin_panel",
          action,
          actor_name: profile.full_name,
        },
      });
      if (error) throw error;
      return json({ data });
    }

    return json({ error: "Action tidak dikenali." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wallet admin function failed.";
    return json({ error: message }, 400);
  }
});
