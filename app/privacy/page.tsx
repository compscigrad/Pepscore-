// Privacy Policy -- pre-launch draft (2026-08-12 homepage revision pass
// #2, section 16). Describes only what the system actually does today,
// grounded in the real architecture (Clerk auth, Stripe payments,
// tokenized card/bank data never stored raw, Vercel Analytics, Resend
// email, Twilio SMS with STOP/START consent). Marked internally as
// OWNER/LEGAL REVIEW REQUIRED (docs/PendingOwnerActions.md) -- no
// compliance-framework claims are made without support.
import type { Metadata } from 'next'
import { Header } from '@/components/storefront/Header'
import { Footer } from '@/components/storefront/Footer'
import { CartSidebar } from '@/components/storefront/CartSidebar'
import { PolicyPageLayout, PolicyHeading } from '@/components/storefront/PolicyPageLayout'

export const metadata: Metadata = {
  title: 'Privacy Policy | Pepscore Lab',
  description: 'Pepscore Lab Privacy Policy.',
  robots: { index: false, follow: true },
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  return (
    <>
      <CartSidebar />
      <Header />
      <PolicyPageLayout title="Privacy Policy" updated="August 12, 2026">
        <p>
          This Privacy Policy describes how Pepscore Lab (&ldquo;we,&rdquo; &ldquo;us&rdquo;) collects, uses, and
          protects information when you use our website and storefront.
        </p>

        <PolicyHeading>Information We Collect</PolicyHeading>
        <ul className="list-disc pl-6 space-y-1.5">
          <li><strong>Account information</strong> — if you create a Customer Portal account, we collect the email address and authentication details managed by our authentication provider, Clerk.</li>
          <li><strong>Contact and order information</strong> — name, email, phone number, and shipping/billing address you provide at checkout or through an intake form.</li>
          <li><strong>Order and payment metadata</strong> — items purchased, order totals, and payment status. Payment card and bank account details are collected and tokenized directly by our payment processor, Stripe; Pepscore Lab does not receive or store your full card number, CVC, or bank account/routing number.</li>
          <li><strong>Shipment and tracking information</strong> — provided to our shipping/tracking providers to fulfill and track your order.</li>
          <li><strong>Communications</strong> — a record of transactional emails and, where you&rsquo;ve opted in, SMS messages sent to you (order confirmations, invoices, shipment updates).</li>
          <li><strong>Usage/analytics data</strong> — non-identifying page-view and interaction events collected via Vercel Analytics and our own first-party event log (e.g. product views, searches, checkout starts). These events are designed not to include personally identifying content.</li>
          <li><strong>Cookies and session technologies</strong> — used to keep you signed in, maintain your cart, and support basic site functionality.</li>
        </ul>

        <PolicyHeading>How We Use Information</PolicyHeading>
        <p>We use the information above to:</p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>Process and fulfill your orders, including payment, shipping, and tracking;</li>
          <li>Provide the Customer Portal and account features;</li>
          <li>Send transactional communications (order/invoice/shipment/payment updates);</li>
          <li>Send marketing communications only where you&rsquo;ve given affirmative, opt-in consent (e.g. SMS marketing requires explicit double opt-in and can be stopped at any time by replying STOP);</li>
          <li>Maintain the security and integrity of the Site, including fraud and abuse prevention;</li>
          <li>Measure aggregate, non-identifying usage trends to improve the Site.</li>
        </ul>

        <PolicyHeading>Third-Party Service Providers</PolicyHeading>
        <p>We share information with the following categories of service providers, only as needed to provide our services:</p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li><strong>Clerk</strong> — authentication and account management.</li>
          <li><strong>Stripe</strong> — payment processing (card, ACH/bank pay, and other supported methods). Stripe, not Pepscore Lab, handles and tokenizes your raw payment details.</li>
          <li><strong>Shipping/tracking providers</strong> — to generate labels and provide tracking updates.</li>
          <li><strong>Resend</strong> — transactional email delivery.</li>
          <li><strong>Twilio</strong> — SMS delivery, where you have opted in.</li>
          <li><strong>Vercel</strong> — website hosting and aggregate analytics.</li>
        </ul>
        <p>We do not sell your personal information.</p>

        <PolicyHeading>Data Retention</PolicyHeading>
        <p>
          We retain order, invoice, and communication records for as long as needed for legitimate business,
          accounting, and legal purposes. Account information is retained while your account remains active.
        </p>

        <PolicyHeading>Your Choices</PolicyHeading>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>You may check out as a guest without creating an account.</li>
          <li>You can opt out of SMS at any time by replying STOP; you can request marketing-related communication preferences via email.</li>
          <li>You may request access to, correction of, or deletion of your account information by contacting us (subject to records we&rsquo;re required to retain for order/tax/legal purposes).</li>
        </ul>

        <PolicyHeading>Security</PolicyHeading>
        <p>
          We use industry-standard practices to protect your information, including encrypted connections,
          authentication via a dedicated identity provider, and tokenized payment handling so raw card/bank details
          never pass through or are stored on our own servers.
        </p>

        <PolicyHeading>Children&rsquo;s Privacy</PolicyHeading>
        <p>The Site is not directed to individuals under 18, and we do not knowingly collect information from them.</p>

        <PolicyHeading>Changes to This Policy</PolicyHeading>
        <p>We may update this Privacy Policy from time to time; the &ldquo;Last updated&rdquo; date above reflects the most recent revision.</p>

        <PolicyHeading>Contact</PolicyHeading>
        <p>
          Questions about this Privacy Policy can be sent to{' '}
          <a href="mailto:contact@pepscorelab.com" className="text-[#D4AF37] hover:underline">contact@pepscorelab.com</a>.
        </p>
      </PolicyPageLayout>
      <Footer />
    </>
  )
}
