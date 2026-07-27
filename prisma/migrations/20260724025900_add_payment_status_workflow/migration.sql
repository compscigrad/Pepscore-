-- Phase 1 of 2 — payment-status workflow overhaul (docs/Decisions.md).
--
-- IMPORTANT — this project has never used Prisma Migrate (confirmed via
-- `prisma migrate status`: no prisma/migrations directory existed before
-- this file, and the live database has no `_prisma_migrations` tracking
-- table). docs/ProductRoadmap.md's Phase 2G explicitly documents this as
-- intentional: "db:push has been the only schema-sync method since commit
-- one ... worth adopting [migrate] before the schema grows through several
-- more phases' worth of new models, not because anything is currently
-- broken." Adopting `prisma migrate deploy` now would require first
-- baselining the *entire* existing 30+ table schema as a synthetic "already
-- applied" migration — a separate, project-wide workflow change with real
-- risk if the baseline doesn't exactly match production, and out of scope
-- for this fix. This file is therefore a committed, reviewable RECORD of
-- exactly what was applied and how, generated verbatim by
-- `prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script`
-- against the live database on 2026-07-24 — but it is applied via
-- `prisma db push` (this project's established, documented method), not
-- `prisma migrate deploy`, since no migration history exists to deploy
-- against. It is not tracked in a `_prisma_migrations` table.
--
-- Purely additive: 3 new enum types, 4 new nullable-or-defaulted columns on
-- Invoice, 6 new nullable-or-defaulted columns on PaymentArrangement. No
-- column is dropped, no existing column's type changes, no existing row can
-- become invalid — every new NOT NULL column carries a DEFAULT, so it
-- back-fills automatically for all 11 existing Invoice rows and 0 existing
-- PaymentArrangement rows. No InvoiceStatus enum values are touched (that
-- narrowing is Phase 2, gated on a manual data backfill — see Phase 2 plan).
--
-- Pre-migration backup: full raw-SQL JSON export of Invoice (+ items,
-- discounts, payments, activity log), PaymentArrangement (+ installments),
-- Customer, and IntakeLink taken immediately before this file was written —
-- 11 invoices, 3 invoice payments, 0 payment arrangements, 5 customers, 15
-- intake links captured.

-- CreateEnum
CREATE TYPE "InvoicePaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED', 'OVERPAID');

-- CreateEnum
CREATE TYPE "PaymentIntentStatus" AS ENUM ('NOT_AVAILABLE', 'AWAITING_CLIENT_SELECTION', 'AWAITING_MANUAL_CONFIRMATION', 'ARRANGEMENT_APPROVAL_PENDING', 'ARRANGEMENT_APPROVED', 'ARRANGEMENT_DENIED', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ArrangementRequestStatus" AS ENUM ('REQUESTED', 'APPROVED', 'DENIED');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "overpaidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "paymentIntentStatus" "PaymentIntentStatus" NOT NULL DEFAULT 'NOT_AVAILABLE',
ADD COLUMN     "paymentStatus" "InvoicePaymentStatus" NOT NULL DEFAULT 'UNPAID',
ADD COLUMN     "selectedPaymentMethod" "PaymentMethod";

-- AlterTable
ALTER TABLE "PaymentArrangement" ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "decidedBy" TEXT,
ADD COLUMN     "denialReason" TEXT,
ADD COLUMN     "proposedDownPayment" DOUBLE PRECISION,
ADD COLUMN     "requestedAt" TIMESTAMP(3),
ADD COLUMN     "status" "ArrangementRequestStatus" NOT NULL DEFAULT 'APPROVED';
