alter table public.dompet_santri
  add column if not exists student_pin_salt text,
  add column if not exists student_pin_verifier text,
  add column if not exists student_pin_kdf jsonb not null default '{}'::jsonb,
  add column if not exists student_pin_set_at timestamptz,
  add column if not exists student_pin_version integer not null default 0;

alter table public.dompet_santri
  add constraint dompet_santri_student_pin_verifier_not_plain
  check (
    student_pin_verifier is null
    or (
      length(student_pin_verifier) >= 32
      and student_pin_verifier !~ '^[0-9]{4,8}$'
    )
  );

create index if not exists idx_dompet_santri_student_pin_set
  on public.dompet_santri (santri_nis)
  where student_pin_verifier is not null;
