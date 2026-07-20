# Invoice System Spec (Frozen)

This document is the official engineering specification for the invoice system, copied verbatim from the original master development prompt (Parts 1 & 2). It is the permanent blueprint — consult it before any future invoice-related work. Implementation decisions that deviate from or extend this spec, and why, are recorded separately in [Decisions.md](./Decisions.md).

---

# PEPSCORE LAB
# MASTER DEVELOPMENT PROMPT
## PART 1 — PROJECT FOUNDATION, SYSTEM ARCHITECTURE & ENGINEERING STANDARDS

---

# SYSTEM ROLE

You are acting as:

• Principal Software Architect
• Senior Full Stack Engineer
• Senior React Engineer
• Senior Next.js Engineer
• Senior TypeScript Engineer
• Senior UI/UX Designer
• Product Designer
• Software Documentation Specialist
• PDF Generation Engineer
• Front-End Architect
• Back-End Architect
• Database Designer
• Quality Assurance Engineer
• Technical Writer
• Accessibility Specialist
• Performance Optimization Engineer

Your responsibility is to build production-quality software that is scalable, maintainable, reusable, and easy for future developers to understand.

You should think like a senior engineer working for Apple, Stripe, Shopify, Linear, Vercel, or Notion.

Never build quick hacks. Always build systems.

---

# PRIMARY OBJECTIVE

Develop a complete invoice management system inside my existing GitHub project.

This should not be a simple invoice page. Instead, build a reusable invoice platform that can continue growing as Pepscore grows.

The software should eventually support: Invoices, Receipts, Packing Slips, Shipping Labels, Quotes, Purchase Orders, Customer Records, Payment Tracking, Product Catalog, Inventory, Order History, Reporting.

Everything should be built with future expansion in mind. Never hardcode solutions that limit future growth.

---

# EXISTING PROJECT

The invoice generator will be added to my existing GitHub repository. Maintain the current project architecture whenever possible. Do not unnecessarily restructure the application. Only introduce new folders when they improve organization.

---

# OFFICIAL DESIGN LANGUAGE

IMPORTANT: The previous Pepscore website is NO LONGER the design reference. Ignore its colors and styling. Instead, the official design language is now: Pepscore-landing.vercel.app

Everything should visually match that application — typography, color palette, spacing, cards, buttons, shadows, border radius, animations, layout, overall visual hierarchy. The invoice system should feel like it was designed at the exact same time as the landing page. A user should never feel like they switched to another application.

---

# DESIGN PHILOSOPHY

Less is more. Whitespace is valuable. Do not overcrowd the interface. Use professional spacing throughout. Every card should breathe. Every form should feel organized. The interface should inspire confidence. Professionalism should always take priority over flashy design.

---

# DESIGN INSPIRATION

The interface should resemble software from companies such as: Apple, Stripe, Square, Shopify, Vercel, Linear, Notion, Framer, Arc Browser, modern enterprise SaaS applications. Do not imitate. Instead, inherit the same design philosophy.

---

# DEVELOPMENT PHILOSOPHY

Every component should have one responsibility. Favor composition over duplication. Avoid giant files. Keep business logic separate from presentation. Never mix calculations directly inside UI components. Follow SOLID principles whenever practical.

---

# CODE QUALITY

Every line of code should be production quality. Avoid shortcuts, unnecessary dependencies, duplicated code, magic numbers, hardcoded values. Use reusable utility functions, hooks, and components. Write code another senior engineer would enjoy maintaining.

---

# CODE COMMENTS

This project WILL include comments. Comments should explain WHY code exists rather than simply repeating WHAT the code does.

Good example:
```
// Calculates the customer's remaining balance after discounts and payments.
// Keeping this logic centralized ensures the PDF preview and printed invoice always match.
```

Bad example:
```
// Add shipping
```

Every major section should include meaningful comments: components, hooks, utilities, calculation functions, complex logic, API routes, configuration files, reusable helpers. Never over-comment trivial code.

---

# TYPESCRIPT

Use strong typing everywhere. Avoid "any." Create reusable interfaces, types, and enums when appropriate. Favor explicit types over inferred types where readability improves.

---

# FILE ORGANIZATION

Keep the project clean. Suggested structure: `/app`, `/components`, `/features`, `/lib`, `/utils`, `/hooks`, `/types`, `/constants`, `/services`, `/styles`, `/assets`. Separate business logic from UI. Separate utilities from calculations. Separate configuration from implementation.

---

# COMPONENT DESIGN

Build small reusable components. Examples: InvoiceHeader, InvoiceFooter, InvoiceForm, InvoiceItemTable, InvoiceTotals, DiscountSection, PromotionSection, CustomerCard, ShippingCard, TrackingCard, PaymentCard, InvoicePreview, PDFExporter, StatusBadge, BrandLogo, TotalsCard, DateSelector, AddressForm, NotesSection. Buttons should also become reusable components where appropriate.

---

# FORM DESIGN

The application should use grouped sections: Customer Information, Shipping, Invoice Information, Products, Discounts, Promotions, Payment, Totals, Preview, Export. Each section should appear inside its own card. Spacing should remain consistent throughout the application.

---

# USER EXPERIENCE

The workflow should feel effortless. The user should never wonder what to do next. Fields should be clearly labeled. Validation should occur naturally. Error messages should be friendly. The interface should guide the user. Never overwhelm them.

---

# ACCESSIBILITY

Support keyboard navigation, screen readers, semantic HTML, proper color contrast, focus states, and reduced motion preferences where practical. Accessibility is not optional.

---

# RESPONSIVENESS

The application must work beautifully on desktop, laptop, tablet, and mobile. Forms should intelligently stack on smaller devices. Tables should remain readable. PDF generation should remain unaffected.

---

# PERFORMANCE

Optimize rendering. Prevent unnecessary re-renders. Memoize expensive calculations when appropriate. Lazy load heavy dependencies. Keep bundle size reasonable. Avoid unnecessary state updates.

---

# CONFIGURATION

Never hardcode brand assets. Instead create configurable placeholders. Example:
```
// PEPSCORE LOGO: "C:\Users\micha\Downloads\Invoice Logo Pepscore.jpeg"
// MASTER INVOICE TEMPLATE: "C:\Users\micha\Downloads\Marvin_Alexander_Master_Invoice_FINAL_POSITION_FIXED.pdf"
// RECIPIENT TEMPLATE: "C:\Users\micha\Downloads\Marvin_Alexander_Recipient_Receipt_FINAL_POSITION_FIXED.pdf"
```
Future assets should be replaceable without modifying application logic.

---

# ERROR HANDLING

Handle unexpected situations gracefully: missing logo, missing template, missing address, missing prices, missing tracking, empty invoice, invalid payment, invalid discounts, network failures (future). Every error should produce meaningful feedback. Never crash the application.

---

# FUTURE EXPANSION

Everything built today should support future additions without major rewrites. Possible future modules: Customer CRM, Inventory Management, Subscription Billing, Clinic Accounts, Wholesale Accounts, Research Orders, Recurring Invoices, Analytics Dashboard, Email Integration, Stripe Integration, Square Integration, QuickBooks Integration, Shipping API Integration, Barcode Generation, QR Code Generation. Design today's architecture with tomorrow's features in mind.

---

# ENGINEERING EXPECTATION

Do not simply make this feature "work." Engineer it. Prioritize maintainability, readability, scalability, and long-term reliability. Every decision should be made as if this application will be actively developed for many years by multiple engineers. This is production software, not a prototype.

---

# PEPSCORE LAB
# MASTER DEVELOPMENT PROMPT
## PART 2 — INVOICE ENGINE, PDF GENERATION, DATA MODEL & IMPLEMENTATION

---

# PRIMARY GOAL

Build a complete invoice management system that generates professional invoices while remaining scalable for future business growth. The software should be capable of handling hundreds or thousands of invoices without requiring major architectural changes. Every design decision should prioritize maintainability.

---

# APPLICATION FLOW

Dashboard → Create New Invoice → Enter Customer Information → Enter Shipping Information → Add Products → Apply Promotions / Discounts → Review Totals → Preview Invoice → Generate PDFs → Save Invoice → Download → Print → Return to Dashboard. The workflow should feel natural and intuitive.

---

# DASHBOARD

Create a clean dashboard showing: Total Invoices, Paid Invoices, Partial Payments, Outstanding Balances, Pending Shipments, Delivered Orders, Revenue Summary, Recent Invoices. Include a searchable invoice list. Allow sorting by Invoice Number, Customer, Date, Balance, Status, Carrier, Tracking Number, Payment Status.

---

# INVOICE NUMBERING

Automatically generate invoice numbers. Example: PS-2026-000001, PS-2026-000002, PS-2026-000003. Do NOT reuse invoice numbers. Invoice numbers should remain unique. Future database support should be simple.

---

# CUSTOMER INFORMATION

Capture: Customer Name, Company (optional), Phone, Email, Shipping Address, Billing Address, City, State, ZIP Code, Country, Internal Notes, Public Notes. Support multiple shipping addresses in the future.

---

# SHIPPING INFORMATION

Support: USPS, UPS, FedEx, DHL, Pickup, Hand Delivery, Courier, Tracking Pending, Tracking Number, Shipping Cost, Ship Date, Delivery Date, Delivered Date, Delivery Status. Allow future integration with shipping APIs.

---

# PRODUCT TABLE

The product table must support unlimited products. Columns: Product, Description, SKU (future), Quantity, Unit Price, Discount, Line Total. Each row should support Duplicate, Delete, Reorder, Inline Editing. The table should update totals instantly.

---

# PRODUCT CATALOG

Create a reusable product catalog structure. Example products: Glow70, PT-141, Tesamorelin, Retatrutide, Tirzepatide, Semaglutide, NAD+, Epithalon, Syringes, Shipping. Future products should be easy to add without editing the invoice engine.

---

# PROMOTIONS

Allow unlimited promotions. Each promotion should contain Name, Description, Type, Dollar Amount, Percentage, Expiration (future). Examples: FF, Birthday, Holiday Sale, Referral, Gift, Coupon, Wholesale Discount. Stacking multiple promotions should work correctly.

---

# AUTOMATIC CALCULATIONS

The application must automatically calculate: Subtotal, Shipping, Taxes (future), Discounts, Promotions, Credits, Final Total, Amount Paid, Remaining Balance, Outstanding Balance. Never require manual calculations. All calculations should be centralized in reusable utility functions.

---

# PAYMENT MANAGEMENT

Support: Pending, Paid, Partial, Refunded, Cancelled, Chargeback (future). Store: Amount Paid, Balance Due, Payment Date, Payment Method, Reference Number. Future methods: Cash, Credit Card, Square, Stripe, Cash App, Venmo, Zelle, ACH, Wire, Check, Crypto (future).

---

# STATUS MANAGEMENT

Invoice Status: Draft, Pending, Approved, Paid, Partially Paid, Cancelled, Refunded. Shipping Status: Preparing, Packed, Shipped, In Transit, Delivered, Returned, Lost, Damaged. Separate payment status from shipping status.

---

# LIVE PREVIEW

As information is entered, display a real-time invoice preview. No refresh. No page reload. The preview should match the generated PDF as closely as possible.

---

# PDF GENERATION

Generate two professional PDFs.

**MASTER INVOICE** — Includes internal payment history, internal notes, Balance Due, administrative details.

**RECIPIENT RECEIPT** — Customer-facing only. Hide Internal Notes, administrative comments, internal payment tracking.

Maintain identical branding between both documents.

---

# TEMPLATE PLACEHOLDERS

Do NOT hardcode assets. Create configurable placeholders with comments such as:
```
// INSERT PEPSCORE LOGO PATH HERE
// INSERT MASTER INVOICE TEMPLATE HERE
// INSERT RECIPIENT TEMPLATE HERE
```
These should be easily replaceable later.

---

# PDF DESIGN

Use professional typography, balanced spacing, consistent margins, centered logo, luxury white space, modern tables, clear hierarchy. Do not crowd information. Keep PDFs printer-friendly. Support Letter and A4 paper sizes where practical.

---

# PRINTING

Optimize for PDF download, home printer, commercial printer, black & white readability, color readability.

---

# SAVE & EDIT

Invoices should be saved locally for now. Architecture should allow replacement with SQLite, PostgreSQL, Supabase, Firebase, MongoDB. Future cloud storage should require minimal code changes. Allow Create, Read, Update, Delete, Duplicate, Archive, Restore, Search, Filter, Sort.

---

# SEARCH

Support searching by Customer, Invoice Number, Tracking Number, Product, Email, Status, Date, Carrier, Payment Status.

---

# EXPORTS

Support PDF, Print, JSON (future), CSV (future), Excel (future).

---

# VALIDATION

Validate: Required fields, Email format, ZIP Codes, Currency values, Negative totals, Payment exceeding invoice amount, Duplicate invoice numbers, Missing products, Missing customer name. Prevent invalid invoices from being generated.

---

# LOGGING

Include meaningful console logging during development. Remove unnecessary logs before production.

---

# TESTING

Structure code so it can easily support Unit Tests, Integration Tests, Component Tests, End-to-End Tests, future CI/CD pipelines.

---

# DOCUMENTATION

Create a comprehensive README explaining folder structure, installation, dependencies, running locally, generating PDFs, future customization, troubleshooting. Include concise inline code comments throughout the codebase explaining the purpose of important components, hooks, utilities, calculations, and architectural decisions.

---

# SAMPLE DATA

Use the following sample invoice for development.

**Customer**: Marvin Alexander
**Shipping Address**: 650 S Spring Street Apt 702, Los Angeles, CA 90014

**Items**: Glow70 ×1 — $89, PT-141 ×1 — $89, Tesamorelin (Box of 10) ×1 — $750
**Shipping**: $25
**Subtotal**: $953
**Discounts**: FF (-$50), Gift (-$89)
**Final Total**: $814
**Carrier**: USPS
**Tracking**: 9500 1145 0917 6195 8813 92
**Status**: Shipped • Delivered 18/7/26
**Paid**: $600
**Balance Due**: $214

---

# QUALITY CHECKLIST

Before considering the feature complete, verify: No TypeScript errors; No ESLint warnings; Responsive on desktop, tablet, and mobile; Accessible form controls; Accurate calculations; Correct PDF rendering; Working print layout; Saved invoices reload correctly; Invoice numbers remain unique; Code is modular and reusable; Strong typing throughout; Helpful inline code comments included; README documentation completed; Follows the design language of Pepscore-landing.vercel.app; Uses configurable placeholders for the logo and invoice template; Ready to commit directly to GitHub.

---

# FINAL INSTRUCTION

Think like a senior engineer building software that will power Pepscore for years to come. Prioritize readability, maintainability, scalability, performance, accessibility, and user experience. Do not build a one-off invoice page. Build a professional invoice management system that serves as the foundation for future Pepscore business operations. Generate clean, production-ready code with meaningful comments and a structure that another experienced developer can immediately understand and extend.
