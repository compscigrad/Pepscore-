// Customer-facing emails for portal account claiming — the invite itself
// and the confirmation once claimed. Same plain-HTML-string pattern as
// emails/BackorderNotice.tsx. The invite email deliberately never mentions
// or embeds the raw token in a way that implies clicking alone grants
// access — the link still requires signing in with a matching verified
// email before anything is linked (see lib/portalInvites.ts's claim flow).
import { ORDERS_EMAIL, ADMIN_EMAIL } from '@/lib/resend'

function shell(bodyHtml: string): string {
  const year = new Date().getFullYear()
  return `<!DOCTYPE html>
<html>
<body style="font-family:Georgia,serif;background:#FAFAF5;color:#1A1A1A;margin:0;padding:0">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
    <div style="background:#1A1A1A;padding:28px 36px;text-align:center">
      <h1 style="color:#C49A1A;font-family:Helvetica,sans-serif;font-size:26px;margin:0;letter-spacing:0.1em">PEPSCORE</h1>
    </div>
    <div style="padding:32px 36px">${bodyHtml}</div>
    <div style="background:#1A1A1A;padding:20px 36px;text-align:center">
      <p style="color:rgba(255,255,255,0.4);font-size:11px;margin:0">© ${year} Pepscore · ${ORDERS_EMAIL}</p>
    </div>
  </div>
</body>
</html>`
}

export interface PortalInviteProps {
  customerName: string
  claimUrl: string
  expiresAt: Date
}

export function portalInviteSubject(): string {
  return `Set Up Your Pepscore Account`
}

export function buildPortalInviteHtml(props: PortalInviteProps): string {
  const expiresLabel = props.expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  return shell(`
    <h2 style="font-family:Helvetica,sans-serif;font-size:19px;margin:0 0 14px">Hi ${props.customerName},</h2>
    <p style="font-size:14px;line-height:1.7;color:#424242">
      You can now view your invoices, order status, tracking, and payment history online, anytime.
    </p>
    <p style="text-align:center;margin:24px 0">
      <a href="${props.claimUrl}" style="display:inline-block;background:#C49A1A;color:#1A1A1A;font-family:Helvetica,sans-serif;font-weight:bold;font-size:13px;text-decoration:none;padding:12px 28px;border-radius:8px">
        Set Up My Account
      </a>
    </p>
    <p style="font-size:13px;line-height:1.7;color:#757575">
      You'll be asked to sign in or create an account using this email address — that's how we confirm it's really
      you. This link expires ${expiresLabel} and can only be used once.
    </p>
    <p style="font-size:14px;line-height:1.7;color:#424242">
      Reach out anytime at ${ORDERS_EMAIL} with questions.
    </p>
  `)
}

export interface PortalInviteReminderProps {
  customerName: string
  claimUrl: string
  expiresAt: Date
}

export function portalInviteReminderSubject(): string {
  return `Your Pepscore Customer Profile Is Ready`
}

export function buildPortalInviteReminderHtml(props: PortalInviteReminderProps): string {
  const expiresLabel = props.expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  return shell(`
    <h2 style="font-family:Helvetica,sans-serif;font-size:19px;margin:0 0 14px">Hi ${props.customerName},</h2>
    <p style="font-size:14px;line-height:1.7;color:#424242">
      Your Pepscore customer profile is ready. Set up your secure account to view your invoices, payments,
      previous purchases, order status, tracking, and account communications. Pepscore's expanded online store
      and inventory features are still under construction and will become available through this same account
      as they launch.
    </p>
    <p style="text-align:center;margin:24px 0">
      <a href="${props.claimUrl}" style="display:inline-block;background:#C49A1A;color:#1A1A1A;font-family:Helvetica,sans-serif;font-weight:bold;font-size:13px;text-decoration:none;padding:12px 28px;border-radius:8px">
        Set Up My Account
      </a>
    </p>
    <p style="font-size:13px;line-height:1.7;color:#757575">
      This link expires ${expiresLabel} and can only be used once.
    </p>
    <p style="font-size:14px;line-height:1.7;color:#424242">
      Reach out anytime at ${ADMIN_EMAIL} with questions.
    </p>
  `)
}

// SMS bodies live alongside their email counterparts (same notification,
// two channels) rather than in a separate file. Deliberately terse and
// transactional per the compliance requirement — no invoice/balance/product
// detail, just enough to identify Pepscore and link to the secure setup
// flow. "Reply STOP" is required opt-out language for any Twilio send.
export function portalInviteSmsBody(claimUrl: string): string {
  return `Pepscore: Your customer profile is ready. Set up your secure account to view invoices, payments, purchases, tracking, and updates: ${claimUrl}. Reply STOP to opt out of texts.`
}

export interface PortalAccountClaimedProps {
  customerName: string
  portalUrl: string
}

export function portalAccountClaimedSubject(): string {
  return `Your Pepscore Account Is Ready`
}

export function buildPortalAccountClaimedHtml(props: PortalAccountClaimedProps): string {
  return shell(`
    <h2 style="font-family:Helvetica,sans-serif;font-size:19px;margin:0 0 14px">Hi ${props.customerName},</h2>
    <p style="font-size:14px;line-height:1.7;color:#424242">
      Your account is set up. You can now sign in anytime to view your invoices, tracking, and payment history.
    </p>
    <p style="text-align:center;margin:24px 0">
      <a href="${props.portalUrl}" style="display:inline-block;background:#C49A1A;color:#1A1A1A;font-family:Helvetica,sans-serif;font-weight:bold;font-size:13px;text-decoration:none;padding:12px 28px;border-radius:8px">
        Go to My Account
      </a>
    </p>
    <p style="font-size:14px;line-height:1.7;color:#424242">
      Reach out anytime at ${ORDERS_EMAIL} with questions.
    </p>
  `)
}
