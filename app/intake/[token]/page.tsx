// Public, unauthenticated customer intake page — the landing spot for a
// link generated via the "Request Customer Information" admin action
// (components/invoices/IntakeLinkSection.tsx). Calls validateIntakeLink()
// directly (a Server Component can safely import lib/intakeLinks.ts; only
// client components need the dependency-free lib/intakeLinkState.ts split).
//
// Section 9: once the associated invoice has moved past Draft, this same
// link stops showing the intake form as the primary action and shows the
// issued invoice (+ payment selection / arrangement request when a balance
// remains) instead — see IssuedInvoiceView. A still-DRAFT invoice (or no
// invoice at all yet) keeps today's behavior unchanged.
import { validateIntakeLink } from '@/lib/intakeLinks'
import { prisma } from '@/lib/prisma'
import { IntakeForm } from '@/components/intake/IntakeForm'
import { IntakeStatusMessage } from '@/components/intake/IntakeStatusMessage'
import { IssuedInvoiceView, type IssuedInvoiceData } from '@/components/intake/IssuedInvoiceView'

export default async function IntakePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const validation = await validateIntakeLink(token)

  if (!validation.valid) {
    return <IntakeStatusMessage reason={validation.reason} />
  }

  const { link } = validation

  if (link.invoiceId) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: link.invoiceId },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        discounts: true,
        paymentArrangement: { include: { installments: { orderBy: { installmentNumber: 'asc' } } } },
      },
    })

    if (invoice && invoice.status !== 'DRAFT') {
      const data: IssuedInvoiceData = {
        token,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
        status: invoice.status,
        paymentStatus: invoice.paymentStatus,
        paymentIntentStatus: invoice.paymentIntentStatus,
        items: invoice.items.map((i) => ({
          id: i.id,
          name: i.name,
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          total: i.total,
        })),
        discounts: invoice.discounts.map((d) => ({ id: d.id, label: d.label, appliedAmount: d.appliedAmount })),
        subtotal: invoice.subtotal,
        shippingCost: invoice.shippingCost,
        discountTotal: invoice.discountTotal,
        total: invoice.total,
        amountPaid: invoice.amountPaid,
        balanceDue: invoice.balanceDue,
        overpaidAmount: invoice.overpaidAmount,
        selectedPaymentMethod: invoice.selectedPaymentMethod,
        arrangement: invoice.paymentArrangement
          ? {
              status: invoice.paymentArrangement.status,
              frequency: invoice.paymentArrangement.frequency,
              denialReason: invoice.paymentArrangement.denialReason,
              installments: invoice.paymentArrangement.installments.map((i) => ({
                id: i.id,
                installmentNumber: i.installmentNumber,
                dueDate: i.dueDate.toISOString(),
                amount: i.amount,
                status: i.status,
              })),
            }
          : null,
      }
      return <IssuedInvoiceView data={data} />
    }
  }

  return (
    <IntakeForm
      token={token}
      alreadySubmittedAt={validation.link.submittedAt ? validation.link.submittedAt.toISOString() : null}
    />
  )
}
