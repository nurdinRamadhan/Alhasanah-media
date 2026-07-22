# MASTER INSTRUCTION FOR CODEX CLI / AI AGENT

## Project: Al-Hasanah Media – Finance Fund Accounting Extension

You are acting as a **Senior PostgreSQL Architect**, **Supabase Architect**, **Backend Engineer**, **Database Auditor**, and **Financial System Engineer**.

Your task is **NOT** to immediately generate SQL.

Your first responsibility is to understand the existing production system before proposing any modification.

---

# PROJECT BACKGROUND

This project is a production Pesantren Management System called **Al-Hasanah Media**.

The system is already running in production and has active users.

The database is PostgreSQL hosted on Supabase.

The Android application is written in Kotlin + Jetpack Compose.

The Admin Panel is connected to the same Supabase project.

The financial system already works correctly.

The goal of this task is **NOT** to redesign the existing financial system.

The goal is to **extend** it by implementing **Fund Accounting (Dana Management)** while keeping the current production workflow intact.

---

# VERY IMPORTANT

Assume nothing.

Verify everything.

Never guess table names.

Never guess column names.

Never guess enum values.

Never guess relationships.

Never guess triggers.

Never guess policies.

Every architectural decision must be based on the actual production schema.

---

# FIRST TASK (MANDATORY)

Before generating any SQL:

Audit the entire database.

Inspect:

* tables
* columns
* primary keys
* foreign keys
* indexes
* constraints
* triggers
* functions
* procedures
* views
* materialized views
* RLS policies
* enums
* extensions
* auth schema
* storage policies
* realtime configuration
* cron jobs
* edge functions (if any)

Also inspect the application source code (if available):

* Kotlin Android
* Admin Panel
* RPC calls
* SQL migrations
* Supabase client usage

Understand how the finance module currently works.

DO NOT modify anything before completing this audit.

---

# CURRENT FINANCIAL FLOW

The existing production flow is:

ref_jenis_pembayaran
↓
tagihan_santri
↓
pembayaran_tagihan
↓
transaksi_keuangan
↓
detail_transaksi

Separate expense table:

pengeluaran

This flow is already working.

It must continue to work exactly as it does today.

---

# ABSOLUTE RULES

You are NOT allowed to:

Rename tables.

Rename columns.

Rename enums.

Redesign payment flow.

Replace existing architecture.

Delete production data.

Break backward compatibility.

Modify Android API contracts.

Modify Admin Panel contracts.

Create destructive migrations unless explicitly approved.

---

# ONLY ADDITIVE CHANGES

You may only:

Create new tables.

Create new functions.

Create new triggers.

Create new indexes.

Create new RLS policies.

Create new views.

Create new helper functions.

Everything must be additive.

---

# NEW FEATURE

Implement Fund Accounting.

Each payment category has its own balance.

Example:

SPP

Kas

Infaq

Listrik

Tafaruqan

Miftah

and any future payment category.

Each balance is separated by:

scope_gender

scope_jurusan

Therefore:

same payment type

different gender

different balance

same payment type

different jurusan

different balance

---

# REQUIRED NEW TABLES

Expected tables:

saldo_dana

mutasi_dana

You may improve their structure if necessary, but explain why.

---

# BUSINESS LOGIC

Incoming payment:

When a payment becomes FINAL:

Insert mutation.

Update balance.

Never double-post.

Partial payment (installment) must immediately increase the corresponding balance.

Pending payment must NOT affect balance.

Failed payment must NOT affect balance.

Cancelled payment must NOT affect balance.

---

Expense

Expense must select exactly one fund.

Validate available balance.

Reject if insufficient.

Insert outgoing mutation.

Update balance.

Never overwrite balance without recording a mutation.

---

# LEDGER PRINCIPLE

The ledger must be immutable.

Never UPDATE ledger history.

Never DELETE ledger history.

Corrections must use reversal entries.

Every balance must always be reproducible from ledger history.

---

# CONCURRENCY

Prevent race conditions.

Protect balance updates.

Use proper PostgreSQL transaction handling.

Use row locking where appropriate.

Avoid duplicate posting.

Ensure atomicity.

---

# RBAC

Inspect existing profiles table.

Reuse current role system.

Reuse existing scope_gender.

Reuse existing scope_jurusan.

Do not redesign authorization.

Integrate with existing RLS.

---

# PERFORMANCE

Optimize for production.

Avoid unnecessary scans.

Create proper indexes.

Analyze execution plans if necessary.

Avoid N+1 queries.

---

# REPORTS

Prepare architecture supporting:

Balance per payment type.

Balance per gender.

Balance per jurusan.

Ledger history.

Cash flow.

Fund movement.

Audit report.

Financial reconciliation.

---

# BACKFILL

Inspect historical transactions.

Generate migration to populate initial balances.

Do not duplicate history.

The migration must be safely re-runnable or clearly document if it is one-time only.

---

# VERIFICATION

Create SQL verification scripts.

Validate:

Ledger consistency.

Balance consistency.

Duplicate posting.

Missing references.

Orphan records.

Incorrect balances.

Foreign key integrity.

---

# ROLLBACK

Every migration must have a rollback strategy.

Explain rollback limitations if data has already changed.

---

# EXPECTED DELIVERABLES

Provide work in this order:

1. Database audit report.

2. Architecture review.

3. Risk analysis.

4. Migration strategy.

5. Proposed ERD.

6. SQL migration files.

7. Trigger implementation.

8. Function implementation.

9. RLS implementation.

10. Reporting views.

11. Backfill script.

12. Verification script.

13. Rollback script.

14. Deployment checklist.

15. Post-deployment verification checklist.

Do not skip steps.

---

# COMMUNICATION STYLE

For every recommendation:

Explain:

Why it is needed.

Why it is safe.

Possible risks.

Production impact.

Performance impact.

Alternative approaches.

Do not hide assumptions.

Explicitly mark every assumption.

---

# FINAL GOAL

Deliver a production-grade Fund Accounting module that integrates seamlessly with the existing Al-Hasanah Media financial system.

The final implementation must:

* preserve the existing payment workflow,
* preserve existing production data,
* preserve compatibility with Android and Admin Panel,
* maintain auditability,
* support future expansion,
* follow PostgreSQL and Supabase best practices,
* prioritize correctness, maintainability, and operational safety over speed.
