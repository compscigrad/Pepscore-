# Project Overview

## Purpose

Pepscore is a peptide research supplier selling research-use-only compounds to researchers and labs. The product is two things at once: a public storefront (Stripe checkout, compliance acknowledgment, order tracking) and an internal operations tool for the owner (order management, shipping labels, profit tracking, and — as of this module — invoicing).

## Business Goals

- Make every sale — whether through the Stripe storefront or a manual/off-platform transaction (DM, cash, Cash App, Zelle, etc.) — trackable in one place.
- Give the owner accurate, real-time visibility into revenue, outstanding balances, and shipment status without spreadsheets.
- Produce professional, branded documents (invoices, receipts) for both internal record-keeping and customer-facing delivery.
- Build every module so it can grow into the next one without a rewrite — invoicing today, inventory/CRM/subscriptions tomorrow.

## Current Modules

- **Storefront**: product catalog, cart, Stripe checkout, RUO compliance acknowledgment, customer accounts (Clerk).
- **Admin dashboard**: order management, Shippo shipping labels, CPA-ready XLSX export, profit/expense tracking.
- **Invoice system** *(this module)*: standalone invoicing for both Stripe-linked and fully manual sales — customer/shipping capture, unlimited line items, stacking promotions, partial payment tracking, dual PDF output (internal Master Invoice vs. customer-facing Recipient Receipt), searchable dashboard.

## Future Modules

See [FutureRoadmap.md](./FutureRoadmap.md) for the full list (inventory, CRM, wholesale/clinic portals, subscription billing, shipping/email/accounting integrations, barcode/QR support).

## Vision

A single, coherent back-office system that scales from "one person taking manual orders over DM" to a fully automated, multi-channel operation — without ever needing to throw away and rebuild what came before.
