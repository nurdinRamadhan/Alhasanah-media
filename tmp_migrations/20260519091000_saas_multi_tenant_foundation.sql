-- SaaS multi-tenant foundation for PesantrenMedia.
-- Run this after the baseline schema restore.
--
-- Model:
-- - platform schema stores SaaS/global metadata.
-- - tenant_<slug> schema stores each Business-tier tenant data.
-- - tenant tables keep tenant_id for policy checks, cross-tenant reports, and future migration to dedicated projects.

create schema if not exists platform;
create schema if not exists tenant_alhasanah;

create extension if not exists pgcrypto with schema extensions;

create type platform.tenant_tier as enum ('basic', 'business', 'enterprise');
create type platform.tenant_status as enum ('trial', 'active', 'suspended', 'cancelled', 'archived');
create type platform.subscription_status as enum ('trialing', 'active', 'past_due', 'cancelled', 'expired');
create type platform.member_role as enum ('owner', 'yayasan_admin', 'institution_admin', 'staff', 'teacher', 'guardian', 'student', 'auditor');
create type platform.institution_type as enum ('pesantren', 'smp', 'sma', 'smk', 'ma', 'mts', 'mi', 'sd', 'tk', 'madin', 'tpq', 'other');
create type platform.feature_scope as enum ('tenant', 'institution');

create type tenant_alhasanah.gender as enum ('L', 'P');
create type tenant_alhasanah.person_status as enum ('active', 'inactive', 'graduated', 'transferred', 'withdrawn', 'alumni', 'archived');
create type tenant_alhasanah.enrollment_status as enum ('active', 'inactive', 'graduated', 'transferred', 'withdrawn');
create type tenant_alhasanah.staff_status as enum ('active', 'inactive', 'resigned', 'archived');
create type tenant_alhasanah.attendance_status as enum ('present', 'late', 'sick', 'excused', 'absent', 'leave');
create type tenant_alhasanah.invoice_status as enum ('draft', 'issued', 'partial', 'paid', 'void', 'overdue');
create type tenant_alhasanah.payment_status as enum ('pending', 'confirmed', 'failed', 'refunded', 'void');
create type tenant_alhasanah.wallet_status as enum ('active', 'locked', 'closed');

create table if not exists platform.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  legal_name text,
  tier platform.tenant_tier not null default 'business',
  status platform.tenant_status not null default 'trial',
  primary_schema_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenants_slug_format check (slug ~ '^[a-z0-9][a-z0-9_]{1,62}$'),
  constraint tenants_schema_format check (primary_schema_name is null or primary_schema_name ~ '^tenant_[a-z0-9_]{2,62}$')
);

create table if not exists platform.tenant_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  domain text not null unique,
  is_primary boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists platform.organizations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  name text not null,
  short_name text,
  legal_entity_type text,
  registration_number text,
  address jsonb not null default '{}'::jsonb,
  contact jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists platform.institutions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  organization_id uuid references platform.organizations(id) on delete set null,
  code text,
  name text not null,
  type platform.institution_type not null,
  npsn text,
  nsm text,
  nsp text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code),
  unique (tenant_id, name, type)
);

create table if not exists platform.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  tier platform.tenant_tier not null,
  monthly_price bigint not null default 0,
  yearly_price bigint not null default 0,
  limits jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists platform.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  plan_id uuid references platform.subscription_plans(id) on delete restrict,
  status platform.subscription_status not null default 'trialing',
  starts_at timestamptz not null default now(),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancelled_at timestamptz,
  billing_provider text,
  billing_customer_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists platform.features (
  key text primary key,
  name text not null,
  scope platform.feature_scope not null default 'tenant',
  description text,
  default_enabled boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists platform.tenant_features (
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  feature_key text not null references platform.features(key) on delete cascade,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, feature_key)
);

create table if not exists platform.user_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  role platform.member_role not null,
  institution_id uuid references platform.institutions(id) on delete cascade,
  is_platform_admin boolean not null default false,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, auth_user_id, role, institution_id)
);

create table if not exists platform.audit_logs (
  id bigserial primary key,
  tenant_id uuid references platform.tenants(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_schema text,
  resource_table text,
  resource_id text,
  details jsonb not null default '{}'::jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create or replace function platform.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function platform.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = platform, public
as $$
  select exists (
    select 1
    from platform.user_memberships m
    where m.auth_user_id = auth.uid()
      and m.is_platform_admin = true
      and m.is_active = true
  );
$$;

create or replace function platform.current_user_has_tenant_access(p_tenant_id uuid, p_roles platform.member_role[] default null)
returns boolean
language sql
stable
security definer
set search_path = platform, public
as $$
  select exists (
    select 1
    from platform.user_memberships m
    where m.tenant_id = p_tenant_id
      and m.auth_user_id = auth.uid()
      and m.is_active = true
      and (p_roles is null or m.role = any(p_roles) or m.is_platform_admin = true)
  );
$$;

create or replace function platform.current_user_has_institution_access(
  p_tenant_id uuid,
  p_institution_id uuid,
  p_roles platform.member_role[] default null
)
returns boolean
language sql
stable
security definer
set search_path = platform, public
as $$
  select exists (
    select 1
    from platform.user_memberships m
    where m.tenant_id = p_tenant_id
      and m.auth_user_id = auth.uid()
      and m.is_active = true
      and (m.institution_id is null or m.institution_id = p_institution_id)
      and (p_roles is null or m.role = any(p_roles) or m.is_platform_admin = true)
  );
$$;

create trigger tenants_touch_updated_at
before update on platform.tenants
for each row execute function platform.touch_updated_at();

create trigger organizations_touch_updated_at
before update on platform.organizations
for each row execute function platform.touch_updated_at();

create trigger institutions_touch_updated_at
before update on platform.institutions
for each row execute function platform.touch_updated_at();

create trigger subscriptions_touch_updated_at
before update on platform.subscriptions
for each row execute function platform.touch_updated_at();

create trigger user_memberships_touch_updated_at
before update on platform.user_memberships
for each row execute function platform.touch_updated_at();

create index if not exists tenant_domains_tenant_idx on platform.tenant_domains(tenant_id);
create index if not exists organizations_tenant_idx on platform.organizations(tenant_id);
create index if not exists institutions_tenant_type_idx on platform.institutions(tenant_id, type);
create index if not exists subscriptions_tenant_status_idx on platform.subscriptions(tenant_id, status);
create index if not exists user_memberships_auth_user_idx on platform.user_memberships(auth_user_id);
create index if not exists user_memberships_tenant_role_idx on platform.user_memberships(tenant_id, role);
create index if not exists audit_logs_tenant_created_idx on platform.audit_logs(tenant_id, created_at desc);

alter table platform.tenants enable row level security;
alter table platform.tenant_domains enable row level security;
alter table platform.organizations enable row level security;
alter table platform.institutions enable row level security;
alter table platform.subscription_plans enable row level security;
alter table platform.subscriptions enable row level security;
alter table platform.features enable row level security;
alter table platform.tenant_features enable row level security;
alter table platform.user_memberships enable row level security;
alter table platform.audit_logs enable row level security;

create policy tenants_read_member_or_platform_admin on platform.tenants
for select to authenticated
using (platform.is_platform_admin() or platform.current_user_has_tenant_access(id));

create policy tenant_domains_read_member_or_platform_admin on platform.tenant_domains
for select to authenticated
using (platform.is_platform_admin() or platform.current_user_has_tenant_access(tenant_id));

create policy organizations_read_member_or_platform_admin on platform.organizations
for select to authenticated
using (platform.is_platform_admin() or platform.current_user_has_tenant_access(tenant_id));

create policy institutions_read_member_or_platform_admin on platform.institutions
for select to authenticated
using (platform.is_platform_admin() or platform.current_user_has_tenant_access(tenant_id));

create policy subscription_plans_read_authenticated on platform.subscription_plans
for select to authenticated
using (is_active = true or platform.is_platform_admin());

create policy subscriptions_read_admin on platform.subscriptions
for select to authenticated
using (platform.is_platform_admin() or platform.current_user_has_tenant_access(tenant_id, array['owner','yayasan_admin','auditor']::platform.member_role[]));

create policy features_read_authenticated on platform.features
for select to authenticated
using (true);

create policy tenant_features_read_member_or_platform_admin on platform.tenant_features
for select to authenticated
using (platform.is_platform_admin() or platform.current_user_has_tenant_access(tenant_id));

create policy user_memberships_read_own_or_admin on platform.user_memberships
for select to authenticated
using (
  auth_user_id = auth.uid()
  or platform.is_platform_admin()
  or platform.current_user_has_tenant_access(tenant_id, array['owner','yayasan_admin','auditor']::platform.member_role[])
);

create policy audit_logs_read_admin on platform.audit_logs
for select to authenticated
using (platform.is_platform_admin() or platform.current_user_has_tenant_access(tenant_id, array['owner','yayasan_admin','auditor']::platform.member_role[]));

create table if not exists tenant_alhasanah.institutions (
  id uuid primary key,
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  platform_institution_id uuid unique references platform.institutions(id) on delete cascade,
  code text,
  name text not null,
  type platform.institution_type not null,
  address jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table if not exists tenant_alhasanah.academic_years (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  institution_id uuid references tenant_alhasanah.institutions(id) on delete cascade,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  is_active boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, institution_id, name),
  constraint academic_year_dates_valid check (starts_on < ends_on)
);

create table if not exists tenant_alhasanah.classes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  institution_id uuid not null references tenant_alhasanah.institutions(id) on delete cascade,
  academic_year_id uuid references tenant_alhasanah.academic_years(id) on delete set null,
  code text not null,
  name text not null,
  level text,
  homeroom_staff_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, institution_id, academic_year_id, code)
);

create table if not exists tenant_alhasanah.guardians (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  phone text,
  email text,
  relation text,
  address jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tenant_alhasanah.students (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  full_name text not null,
  gender tenant_alhasanah.gender,
  birth_place text,
  birth_date date,
  photo_url text,
  primary_guardian_id uuid references tenant_alhasanah.guardians(id) on delete set null,
  status tenant_alhasanah.person_status not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tenant_alhasanah.student_guardians (
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  student_id uuid not null references tenant_alhasanah.students(id) on delete cascade,
  guardian_id uuid not null references tenant_alhasanah.guardians(id) on delete cascade,
  relation text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (student_id, guardian_id)
);

create table if not exists tenant_alhasanah.staff (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  gender tenant_alhasanah.gender,
  phone text,
  email text,
  status tenant_alhasanah.staff_status not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tenant_alhasanah.classes
  add constraint classes_homeroom_staff_fk foreign key (homeroom_staff_id)
  references tenant_alhasanah.staff(id) on delete set null;

create table if not exists tenant_alhasanah.user_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  platform_membership_id uuid references platform.user_memberships(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  institution_id uuid references tenant_alhasanah.institutions(id) on delete cascade,
  staff_id uuid references tenant_alhasanah.staff(id) on delete set null,
  guardian_id uuid references tenant_alhasanah.guardians(id) on delete set null,
  role platform.member_role not null,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tenant_alhasanah.student_institution_enrollments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  student_id uuid not null references tenant_alhasanah.students(id) on delete cascade,
  institution_id uuid not null references tenant_alhasanah.institutions(id) on delete cascade,
  academic_year_id uuid not null references tenant_alhasanah.academic_years(id) on delete restrict,
  class_id uuid references tenant_alhasanah.classes(id) on delete set null,
  institution_type platform.institution_type not null,
  nis_local text,
  nisn text,
  class_level text,
  status tenant_alhasanah.enrollment_status not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, institution_id, academic_year_id, nis_local),
  unique (tenant_id, institution_id, academic_year_id, student_id)
);

create table if not exists tenant_alhasanah.institution_features (
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  institution_id uuid not null references tenant_alhasanah.institutions(id) on delete cascade,
  feature_key text not null references platform.features(key) on delete cascade,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (institution_id, feature_key)
);

create table if not exists tenant_alhasanah.subjects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  institution_id uuid references tenant_alhasanah.institutions(id) on delete cascade,
  code text,
  name text not null,
  category text not null default 'general',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, institution_id, code)
);

create table if not exists tenant_alhasanah.teaching_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  institution_id uuid not null references tenant_alhasanah.institutions(id) on delete cascade,
  academic_year_id uuid not null references tenant_alhasanah.academic_years(id) on delete cascade,
  class_id uuid references tenant_alhasanah.classes(id) on delete cascade,
  subject_id uuid references tenant_alhasanah.subjects(id) on delete cascade,
  staff_id uuid not null references tenant_alhasanah.staff(id) on delete cascade,
  schedule jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists tenant_alhasanah.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  institution_id uuid not null references tenant_alhasanah.institutions(id) on delete cascade,
  academic_year_id uuid references tenant_alhasanah.academic_years(id) on delete set null,
  class_id uuid references tenant_alhasanah.classes(id) on delete set null,
  teaching_assignment_id uuid references tenant_alhasanah.teaching_assignments(id) on delete set null,
  session_date date not null,
  starts_at time,
  ends_at time,
  title text,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists tenant_alhasanah.student_attendance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  attendance_session_id uuid not null references tenant_alhasanah.attendance_sessions(id) on delete cascade,
  student_id uuid not null references tenant_alhasanah.students(id) on delete cascade,
  status tenant_alhasanah.attendance_status not null,
  recorded_by uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attendance_session_id, student_id)
);

create table if not exists tenant_alhasanah.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  institution_id uuid references tenant_alhasanah.institutions(id) on delete set null,
  staff_id uuid not null references tenant_alhasanah.staff(id) on delete cascade,
  attendance_date date not null,
  status tenant_alhasanah.attendance_status not null,
  check_in_at timestamptz,
  check_out_at timestamptz,
  recorded_by uuid references auth.users(id) on delete set null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, staff_id, attendance_date)
);

create table if not exists tenant_alhasanah.emis_student_profiles (
  student_id uuid primary key references tenant_alhasanah.students(id) on delete cascade,
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  institution_id uuid not null references tenant_alhasanah.institutions(id) on delete cascade,
  nik_hash text,
  kk_hash text,
  nisn text,
  madrasah_status text,
  pesantren_status text,
  emis_extra jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists tenant_alhasanah.smk_competency_programs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  institution_id uuid not null references tenant_alhasanah.institutions(id) on delete cascade,
  code text,
  name text not null,
  metadata jsonb not null default '{}'::jsonb,
  unique (tenant_id, institution_id, code)
);

create table if not exists tenant_alhasanah.dapodik_student_profiles (
  student_id uuid primary key references tenant_alhasanah.students(id) on delete cascade,
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  institution_id uuid not null references tenant_alhasanah.institutions(id) on delete cascade,
  nisn text,
  rombel text,
  kompetensi_keahlian_id uuid references tenant_alhasanah.smk_competency_programs(id) on delete set null,
  dapodik_extra jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists tenant_alhasanah.tk_development_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  student_id uuid not null references tenant_alhasanah.students(id) on delete cascade,
  institution_id uuid not null references tenant_alhasanah.institutions(id) on delete cascade,
  academic_year_id uuid references tenant_alhasanah.academic_years(id) on delete set null,
  period_label text not null,
  motorik_score numeric(5,2),
  bahasa_score numeric(5,2),
  sosial_emosional_score numeric(5,2),
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists tenant_alhasanah.halaqahs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  institution_id uuid not null references tenant_alhasanah.institutions(id) on delete cascade,
  name text not null,
  mentor_staff_id uuid references tenant_alhasanah.staff(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists tenant_alhasanah.halaqah_members (
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  halaqah_id uuid not null references tenant_alhasanah.halaqahs(id) on delete cascade,
  student_id uuid not null references tenant_alhasanah.students(id) on delete cascade,
  joined_on date not null default current_date,
  left_on date,
  primary key (halaqah_id, student_id)
);

create table if not exists tenant_alhasanah.tahfidz_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  student_id uuid not null references tenant_alhasanah.students(id) on delete cascade,
  institution_id uuid not null references tenant_alhasanah.institutions(id) on delete cascade,
  halaqah_id uuid references tenant_alhasanah.halaqahs(id) on delete set null,
  recorded_on date not null default current_date,
  surah text,
  ayah_from integer,
  ayah_to integer,
  juz integer,
  score numeric(5,2),
  note text,
  recorded_by_staff_id uuid references tenant_alhasanah.staff(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists tenant_alhasanah.kitab_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  student_id uuid not null references tenant_alhasanah.students(id) on delete cascade,
  institution_id uuid not null references tenant_alhasanah.institutions(id) on delete cascade,
  kitab_name text not null,
  chapter text,
  progress_text text,
  score numeric(5,2),
  recorded_on date not null default current_date,
  recorded_by_staff_id uuid references tenant_alhasanah.staff(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists tenant_alhasanah.asrama_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  student_id uuid not null references tenant_alhasanah.students(id) on delete cascade,
  institution_id uuid references tenant_alhasanah.institutions(id) on delete set null,
  building text,
  room text,
  bed text,
  starts_on date not null default current_date,
  ends_on date,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists tenant_alhasanah.wallet_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  student_id uuid not null references tenant_alhasanah.students(id) on delete cascade,
  wallet_public_id uuid not null default gen_random_uuid() unique,
  balance bigint not null default 0,
  status tenant_alhasanah.wallet_status not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallet_balance_non_negative check (balance >= 0),
  unique (tenant_id, student_id)
);

create table if not exists tenant_alhasanah.invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  institution_id uuid references tenant_alhasanah.institutions(id) on delete set null,
  student_id uuid not null references tenant_alhasanah.students(id) on delete cascade,
  invoice_number text,
  description text not null,
  amount bigint not null,
  remaining_amount bigint not null,
  due_date date,
  status tenant_alhasanah.invoice_status not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_amount_valid check (amount >= 0 and remaining_amount >= 0 and remaining_amount <= amount),
  unique (tenant_id, invoice_number)
);

create table if not exists tenant_alhasanah.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  invoice_id uuid references tenant_alhasanah.invoices(id) on delete set null,
  student_id uuid references tenant_alhasanah.students(id) on delete set null,
  amount bigint not null,
  status tenant_alhasanah.payment_status not null default 'pending',
  method text,
  provider_ref text,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint payments_amount_positive check (amount > 0)
);

create table if not exists tenant_alhasanah.inventory_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete cascade,
  institution_id uuid references tenant_alhasanah.institutions(id) on delete set null,
  asset_code text,
  name text not null,
  category text,
  location text,
  condition text,
  acquired_on date,
  value bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, asset_code)
);

create index if not exists tenant_alhasanah_institutions_tenant_type_idx on tenant_alhasanah.institutions(tenant_id, type);
create index if not exists tenant_alhasanah_academic_years_tenant_idx on tenant_alhasanah.academic_years(tenant_id, institution_id);
create index if not exists tenant_alhasanah_classes_tenant_idx on tenant_alhasanah.classes(tenant_id, institution_id, academic_year_id);
create index if not exists tenant_alhasanah_guardians_tenant_idx on tenant_alhasanah.guardians(tenant_id);
create index if not exists tenant_alhasanah_students_tenant_status_idx on tenant_alhasanah.students(tenant_id, status);
create index if not exists tenant_alhasanah_students_name_idx on tenant_alhasanah.students using gin (to_tsvector('simple', coalesce(full_name, '')));
create index if not exists tenant_alhasanah_staff_tenant_status_idx on tenant_alhasanah.staff(tenant_id, status);
create index if not exists tenant_alhasanah_memberships_auth_idx on tenant_alhasanah.user_memberships(auth_user_id);
create index if not exists tenant_alhasanah_enrollments_student_idx on tenant_alhasanah.student_institution_enrollments(student_id);
create index if not exists tenant_alhasanah_enrollments_institution_year_idx on tenant_alhasanah.student_institution_enrollments(tenant_id, institution_id, academic_year_id, status);
create index if not exists tenant_alhasanah_enrollments_nisn_idx on tenant_alhasanah.student_institution_enrollments(tenant_id, nisn) where nisn is not null;
create index if not exists tenant_alhasanah_emis_nik_idx on tenant_alhasanah.emis_student_profiles(tenant_id, nik_hash) where nik_hash is not null;
create index if not exists tenant_alhasanah_dapodik_nisn_idx on tenant_alhasanah.dapodik_student_profiles(tenant_id, nisn) where nisn is not null;
create index if not exists tenant_alhasanah_attendance_sessions_date_idx on tenant_alhasanah.attendance_sessions(tenant_id, institution_id, session_date);
create index if not exists tenant_alhasanah_student_attendance_session_idx on tenant_alhasanah.student_attendance(attendance_session_id, status);
create index if not exists tenant_alhasanah_staff_attendance_date_idx on tenant_alhasanah.staff_attendance(tenant_id, staff_id, attendance_date);
create index if not exists tenant_alhasanah_tahfidz_student_date_idx on tenant_alhasanah.tahfidz_records(tenant_id, student_id, recorded_on desc);
create index if not exists tenant_alhasanah_kitab_student_date_idx on tenant_alhasanah.kitab_records(tenant_id, student_id, recorded_on desc);
create index if not exists tenant_alhasanah_invoices_student_status_idx on tenant_alhasanah.invoices(tenant_id, student_id, status);
create index if not exists tenant_alhasanah_payments_student_created_idx on tenant_alhasanah.payments(tenant_id, student_id, created_at desc);
create index if not exists tenant_alhasanah_inventory_institution_idx on tenant_alhasanah.inventory_assets(tenant_id, institution_id);

create or replace function tenant_alhasanah.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tenant_alhasanah_institutions_touch_updated_at
before update on tenant_alhasanah.institutions
for each row execute function tenant_alhasanah.touch_updated_at();

create trigger tenant_alhasanah_classes_touch_updated_at
before update on tenant_alhasanah.classes
for each row execute function tenant_alhasanah.touch_updated_at();

create trigger tenant_alhasanah_guardians_touch_updated_at
before update on tenant_alhasanah.guardians
for each row execute function tenant_alhasanah.touch_updated_at();

create trigger tenant_alhasanah_students_touch_updated_at
before update on tenant_alhasanah.students
for each row execute function tenant_alhasanah.touch_updated_at();

create trigger tenant_alhasanah_staff_touch_updated_at
before update on tenant_alhasanah.staff
for each row execute function tenant_alhasanah.touch_updated_at();

create trigger tenant_alhasanah_user_memberships_touch_updated_at
before update on tenant_alhasanah.user_memberships
for each row execute function tenant_alhasanah.touch_updated_at();

create trigger tenant_alhasanah_enrollments_touch_updated_at
before update on tenant_alhasanah.student_institution_enrollments
for each row execute function tenant_alhasanah.touch_updated_at();

create trigger tenant_alhasanah_student_attendance_touch_updated_at
before update on tenant_alhasanah.student_attendance
for each row execute function tenant_alhasanah.touch_updated_at();

create trigger tenant_alhasanah_staff_attendance_touch_updated_at
before update on tenant_alhasanah.staff_attendance
for each row execute function tenant_alhasanah.touch_updated_at();

create trigger tenant_alhasanah_wallet_accounts_touch_updated_at
before update on tenant_alhasanah.wallet_accounts
for each row execute function tenant_alhasanah.touch_updated_at();

create trigger tenant_alhasanah_invoices_touch_updated_at
before update on tenant_alhasanah.invoices
for each row execute function tenant_alhasanah.touch_updated_at();

create trigger tenant_alhasanah_inventory_assets_touch_updated_at
before update on tenant_alhasanah.inventory_assets
for each row execute function tenant_alhasanah.touch_updated_at();

alter table tenant_alhasanah.institutions enable row level security;
alter table tenant_alhasanah.academic_years enable row level security;
alter table tenant_alhasanah.classes enable row level security;
alter table tenant_alhasanah.guardians enable row level security;
alter table tenant_alhasanah.students enable row level security;
alter table tenant_alhasanah.student_guardians enable row level security;
alter table tenant_alhasanah.staff enable row level security;
alter table tenant_alhasanah.user_memberships enable row level security;
alter table tenant_alhasanah.student_institution_enrollments enable row level security;
alter table tenant_alhasanah.institution_features enable row level security;
alter table tenant_alhasanah.subjects enable row level security;
alter table tenant_alhasanah.teaching_assignments enable row level security;
alter table tenant_alhasanah.attendance_sessions enable row level security;
alter table tenant_alhasanah.student_attendance enable row level security;
alter table tenant_alhasanah.staff_attendance enable row level security;
alter table tenant_alhasanah.emis_student_profiles enable row level security;
alter table tenant_alhasanah.smk_competency_programs enable row level security;
alter table tenant_alhasanah.dapodik_student_profiles enable row level security;
alter table tenant_alhasanah.tk_development_records enable row level security;
alter table tenant_alhasanah.halaqahs enable row level security;
alter table tenant_alhasanah.halaqah_members enable row level security;
alter table tenant_alhasanah.tahfidz_records enable row level security;
alter table tenant_alhasanah.kitab_records enable row level security;
alter table tenant_alhasanah.asrama_assignments enable row level security;
alter table tenant_alhasanah.wallet_accounts enable row level security;
alter table tenant_alhasanah.invoices enable row level security;
alter table tenant_alhasanah.payments enable row level security;
alter table tenant_alhasanah.inventory_assets enable row level security;

create policy tenant_alhasanah_institutions_tenant_read on tenant_alhasanah.institutions
for select to authenticated
using (platform.current_user_has_tenant_access(tenant_id));

create policy tenant_alhasanah_academic_years_tenant_read on tenant_alhasanah.academic_years
for select to authenticated
using (platform.current_user_has_tenant_access(tenant_id));

create policy tenant_alhasanah_classes_tenant_read on tenant_alhasanah.classes
for select to authenticated
using (platform.current_user_has_institution_access(tenant_id, institution_id));

create policy tenant_alhasanah_guardians_tenant_read on tenant_alhasanah.guardians
for select to authenticated
using (platform.current_user_has_tenant_access(tenant_id));

create policy tenant_alhasanah_students_tenant_read on tenant_alhasanah.students
for select to authenticated
using (platform.current_user_has_tenant_access(tenant_id));

create policy tenant_alhasanah_student_guardians_tenant_read on tenant_alhasanah.student_guardians
for select to authenticated
using (platform.current_user_has_tenant_access(tenant_id));

create policy tenant_alhasanah_staff_tenant_read on tenant_alhasanah.staff
for select to authenticated
using (platform.current_user_has_tenant_access(tenant_id));

create policy tenant_alhasanah_user_memberships_tenant_read on tenant_alhasanah.user_memberships
for select to authenticated
using (
  auth_user_id = auth.uid()
  or platform.current_user_has_tenant_access(tenant_id, array['owner','yayasan_admin','auditor']::platform.member_role[])
);

create policy tenant_alhasanah_enrollments_tenant_read on tenant_alhasanah.student_institution_enrollments
for select to authenticated
using (platform.current_user_has_institution_access(tenant_id, institution_id));

create policy tenant_alhasanah_institution_features_tenant_read on tenant_alhasanah.institution_features
for select to authenticated
using (platform.current_user_has_institution_access(tenant_id, institution_id));

create policy tenant_alhasanah_subjects_tenant_read on tenant_alhasanah.subjects
for select to authenticated
using (institution_id is null and platform.current_user_has_tenant_access(tenant_id) or platform.current_user_has_institution_access(tenant_id, institution_id));

create policy tenant_alhasanah_teaching_assignments_tenant_read on tenant_alhasanah.teaching_assignments
for select to authenticated
using (platform.current_user_has_institution_access(tenant_id, institution_id));

create policy tenant_alhasanah_attendance_sessions_tenant_read on tenant_alhasanah.attendance_sessions
for select to authenticated
using (platform.current_user_has_institution_access(tenant_id, institution_id));

create policy tenant_alhasanah_student_attendance_tenant_read on tenant_alhasanah.student_attendance
for select to authenticated
using (platform.current_user_has_tenant_access(tenant_id));

create policy tenant_alhasanah_staff_attendance_tenant_read on tenant_alhasanah.staff_attendance
for select to authenticated
using (platform.current_user_has_tenant_access(tenant_id));

create policy tenant_alhasanah_emis_profiles_tenant_read on tenant_alhasanah.emis_student_profiles
for select to authenticated
using (platform.current_user_has_institution_access(tenant_id, institution_id));

create policy tenant_alhasanah_smk_programs_tenant_read on tenant_alhasanah.smk_competency_programs
for select to authenticated
using (platform.current_user_has_institution_access(tenant_id, institution_id));

create policy tenant_alhasanah_dapodik_profiles_tenant_read on tenant_alhasanah.dapodik_student_profiles
for select to authenticated
using (platform.current_user_has_institution_access(tenant_id, institution_id));

create policy tenant_alhasanah_tk_records_tenant_read on tenant_alhasanah.tk_development_records
for select to authenticated
using (platform.current_user_has_institution_access(tenant_id, institution_id));

create policy tenant_alhasanah_halaqahs_tenant_read on tenant_alhasanah.halaqahs
for select to authenticated
using (platform.current_user_has_institution_access(tenant_id, institution_id));

create policy tenant_alhasanah_halaqah_members_tenant_read on tenant_alhasanah.halaqah_members
for select to authenticated
using (platform.current_user_has_tenant_access(tenant_id));

create policy tenant_alhasanah_tahfidz_records_tenant_read on tenant_alhasanah.tahfidz_records
for select to authenticated
using (platform.current_user_has_institution_access(tenant_id, institution_id));

create policy tenant_alhasanah_kitab_records_tenant_read on tenant_alhasanah.kitab_records
for select to authenticated
using (platform.current_user_has_institution_access(tenant_id, institution_id));

create policy tenant_alhasanah_asrama_assignments_tenant_read on tenant_alhasanah.asrama_assignments
for select to authenticated
using (platform.current_user_has_tenant_access(tenant_id));

create policy tenant_alhasanah_wallet_accounts_tenant_read on tenant_alhasanah.wallet_accounts
for select to authenticated
using (platform.current_user_has_tenant_access(tenant_id, array['owner','yayasan_admin','institution_admin','staff','guardian','auditor']::platform.member_role[]));

create policy tenant_alhasanah_invoices_tenant_read on tenant_alhasanah.invoices
for select to authenticated
using (platform.current_user_has_tenant_access(tenant_id, array['owner','yayasan_admin','institution_admin','staff','guardian','auditor']::platform.member_role[]));

create policy tenant_alhasanah_payments_tenant_read on tenant_alhasanah.payments
for select to authenticated
using (platform.current_user_has_tenant_access(tenant_id, array['owner','yayasan_admin','institution_admin','staff','guardian','auditor']::platform.member_role[]));

create policy tenant_alhasanah_inventory_assets_tenant_read on tenant_alhasanah.inventory_assets
for select to authenticated
using (institution_id is null and platform.current_user_has_tenant_access(tenant_id) or platform.current_user_has_institution_access(tenant_id, institution_id));

grant usage on schema platform to authenticated, service_role;
grant usage on schema tenant_alhasanah to authenticated, service_role;

grant select on all tables in schema platform to authenticated;
grant select on all tables in schema tenant_alhasanah to authenticated;
grant all on all tables in schema platform to service_role;
grant all on all tables in schema tenant_alhasanah to service_role;
grant usage, select on all sequences in schema platform to authenticated, service_role;
grant usage, select on all sequences in schema tenant_alhasanah to authenticated, service_role;

grant execute on function platform.is_platform_admin() to authenticated, service_role;
grant execute on function platform.current_user_has_tenant_access(uuid, platform.member_role[]) to authenticated, service_role;
grant execute on function platform.current_user_has_institution_access(uuid, uuid, platform.member_role[]) to authenticated, service_role;
