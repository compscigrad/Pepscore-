// Terms of Service -- pre-launch draft (2026-08-12 homepage revision pass
// #2, section 15). Marked internally as OWNER/LEGAL REVIEW REQUIRED
// (docs/PendingOwnerActions.md) -- this content is a production-draft
// starting point based on the actual current business model and app
// behavior, not a claim of legal sufficiency. No public "under
// construction" banner per the owner's explicit instruction not to show
// an ugly dev warning to customers.
import type { Metadata } from 'next'
import { Header } from '@/components/storefront/Header'
import { Footer } from '@/components/storefront/Footer'
import { CartSidebar } from '@/components/storefront/CartSidebar'
import { PolicyPageLayout, PolicyHeading } from '@/components/storefront/PolicyPageLayout'

export const metadata: Metadata = {
  title: 'Terms of Service | Pepscore Lab',
  description: 'Pepscore Lab Terms of Service.',
  robots: { index: false, follow: true },
  alternates: { canonical: '/terms' },
}

export default function TermsPage() {
  return (
    <>
      <CartSidebar />
      <Header />
      <PolicyPageLayout title="Terms of Service" updated="August 12, 2026">
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the Pepscore Lab website and
          storefront (&ldquo;Site&rdquo;) and any products you purchase through it. By accessing the Site or placing an
          order, you agree to these Terms.
        </p>

        <PolicyHeading>Research Use Only</PolicyHeading>
        <p>
          All products sold by Pepscore Lab are intended for laboratory research use only (&ldquo;RUO&rdquo;). They are
          not drugs, dietary supplements, cosmetics, or medical devices, and are not intended for human or veterinary
          use, human consumption, diagnostic use, or therapeutic use. Pepscore Lab does not provide dosing,
          administration, treatment, or medical guidance of any kind, and requests seeking such guidance violate
          these Terms. You must review and affirmatively accept the current RUO acknowledgment before completing a
          purchase.
        </p>

        <PolicyHeading>Eligibility</PolicyHeading>
        <p>
          You must be at least 18 years old and legally able to enter into a binding contract to use the Site or
          place an order. By placing an order, you represent that you are purchasing products for legitimate research
          purposes and that you will handle all products in accordance with applicable laws and regulations in your
          jurisdiction.
        </p>

        <PolicyHeading>Accounts and Guest Checkout</PolicyHeading>
        <p>
          You may browse, search, and check out as a guest without creating an account. Creating a Customer Portal
          account lets you view order history, invoices, and shipment tracking in one place. You are responsible for
          maintaining the confidentiality of your account credentials and for all activity under your account.
        </p>

        <PolicyHeading>Orders, Pricing, and Payment</PolicyHeading>
        <p>
          All prices are listed in U.S. dollars and are subject to change without notice; the price charged is the
          price displayed at the time your order is placed and confirmed at checkout. We reserve the right to refuse
          or cancel any order, including for suspected fraud, pricing errors, or eligibility concerns. Payment is
          processed through our third-party payment provider; Pepscore Lab does not store your full card or bank
          account number.
        </p>

        <PolicyHeading>Promotions and Discount Codes</PolicyHeading>
        <p>
          Promotional codes and first-order offers are subject to the eligibility terms, redemption limits, and
          expiration dates stated at the time of issuance, and may be modified or discontinued at any time.
          Promotional codes have no cash value and cannot be combined except where explicitly stated.
        </p>

        <PolicyHeading>Shipping and Backorders</PolicyHeading>
        <p>
          Shipping timelines and backorder handling are described in our{' '}
          <a href="/shipping" className="text-[#D4AF37] hover:underline">Shipping Policy</a>. A backordered item may
          qualify for automatic compensation under our existing policy, as described there.
        </p>

        <PolicyHeading>Returns and Refunds</PolicyHeading>
        <p>
          Our current return and refund practices are described in our{' '}
          <a href="/returns" className="text-[#D4AF37] hover:underline">Returns &amp; Refunds</a> page.
        </p>

        <PolicyHeading>Prohibited Conduct</PolicyHeading>
        <p>You agree not to:</p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>Use any product for human or veterinary consumption, diagnosis, treatment, or any non-research purpose;</li>
          <li>Request dosing, administration, therapeutic, or human-use guidance from Pepscore Lab or its staff;</li>
          <li>Misrepresent your identity, age, or purpose in purchasing;</li>
          <li>Attempt to circumvent security, rate-limiting, or fraud-prevention measures on the Site;</li>
          <li>Use the Site for any unlawful purpose or in violation of these Terms.</li>
        </ul>
        <p>
          Violating these Terms may result in restriction, suspension, or termination of your account and order
          privileges, at our discretion.
        </p>

        <PolicyHeading>Intellectual Property</PolicyHeading>
        <p>
          All content on the Site — including text, graphics, logos, and the Pepscore Lab name and branding — is the
          property of Pepscore Lab or its licensors and may not be used without prior written permission.
        </p>

        <PolicyHeading>Disclaimers and Limitation of Liability</PolicyHeading>
        <p>
          The Site and products are provided &ldquo;as is&rdquo; for research use only, without warranties of any kind
          beyond what is expressly stated in our product documentation. To the fullest extent permitted by law,
          Pepscore Lab is not liable for indirect, incidental, or consequential damages arising from use of the Site
          or products, including any use inconsistent with their Research Use Only designation.
        </p>

        <PolicyHeading>Governing Law</PolicyHeading>
        <p>
          <em>
            [Governing-law jurisdiction to be confirmed by the business owner against Pepscore Lab&rsquo;s actual
            registered entity and state of formation before this page is finalized.]
          </em>
        </p>

        <PolicyHeading>Electronic Communications and Changes to These Terms</PolicyHeading>
        <p>
          By providing your email address or phone number, you consent to receive order- and account-related
          communications electronically. We may update these Terms from time to time; continued use of the Site
          after changes take effect constitutes acceptance of the revised Terms.
        </p>

        <PolicyHeading>Privacy</PolicyHeading>
        <p>
          Our collection and use of your information is described in our{' '}
          <a href="/privacy" className="text-[#D4AF37] hover:underline">Privacy Policy</a>.
        </p>

        <PolicyHeading>Contact</PolicyHeading>
        <p>
          Questions about these Terms can be sent to{' '}
          <a href="mailto:contact@pepscorelab.com" className="text-[#D4AF37] hover:underline">contact@pepscorelab.com</a>.
        </p>
      </PolicyPageLayout>
      <Footer />
    </>
  )
}
