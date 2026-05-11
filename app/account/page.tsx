// Customer account dashboard — shows order history, invoices, tracking numbers
// Protected by Clerk middleware

export const dynamic = 'force-dynamic'

import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Header } from '@/components/storefront/Header'
import { Footer } from '@/components/storefront/Footer'
import { CartSidebar } from '@/components/storefront/CartSidebar'
import { formatCurrency } from '@/lib/orders'

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  PAID: 'bg-blue-100 text-blue-700',
  PROCESSING: 'bg-yellow-100 text-yellow-700',
  SHIPPED: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
  REFUNDED: 'bg-orange-100 text-orange-600',
}

export default async function AccountPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const clerkUser = await currentUser()

  // Ensure user record exists in our DB
  const user = await prisma.user.upsert({
    where: { clerkId: userId },
    update: {},
    create: {
      clerkId: userId,
      email: clerkUser?.emailAddresses[0]?.emailAddress ?? '',
      name: clerkUser?.fullName ?? undefined,
    },
  })

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    include: {
      items: true,
      invoice: { select: { invoiceNumber: true, status: true } },
      shippingLabel: { select: { trackingNumber: true, carrier: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return (
    <>
      <CartSidebar />
      <Header />
      <main className="bg-cream min-h-screen py-12 px-6">
        <div className="max-w-[900px] mx-auto">
          <div className="mb-8">
            <h1 className="font-heading text-3xl font-bold text-dark">My Account</h1>
            <p className="text-g500 mt-1">Welcome back, {clerkUser?.firstName ?? 'Researcher'}</p>
          </div>

          {orders.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center shadow-sh">
              <div className="text-4xl mb-4">🧪</div>
              <h2 className="font-heading text-xl font-bold mb-2">No orders yet</h2>
              <p className="text-g500 mb-6">Place your first order to get started.</p>
              <Link
                href="/#products"
                className="inline-block bg-gold hover:bg-gold-dark text-white font-heading text-[13px] font-bold tracking-[0.08em] uppercase px-6 py-3 rounded-md transition-colors"
              >
                Shop Products
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map(order => (
                <div key={order.id} className="bg-white rounded-2xl p-6 shadow-sh">
                  <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
                    <div>
                      <p className="font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-g500 mb-0.5">Order Number</p>
                      <p className="font-heading text-[17px] font-bold text-dark">{order.orderNumber}</p>
                      <p className="text-[12px] text-g500 mt-0.5">
                        {new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`font-heading text-[11px] font-bold tracking-[0.06em] uppercase px-3 py-1 rounded-full ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {order.status}
                      </span>
                      <span className="font-heading text-[17px] font-bold text-gold-dark">
                        {formatCurrency(order.total)}
                      </span>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="border-t border-g100 pt-4 mb-4">
                    <ul className="space-y-1">
                      {order.items.map(item => (
                        <li key={item.id} className="flex justify-between text-[13px]">
                          <span className="text-g700">{item.name} <span className="text-g500">({item.size})</span> × {item.quantity}</span>
                          <span className="font-semibold text-dark">{formatCurrency(item.total)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Invoice + Tracking */}
                  <div className="flex flex-wrap gap-4 pt-3 border-t border-g100">
                    {order.invoice && (
                      <div className="text-[12px]">
                        <span className="text-g500">Invoice: </span>
                        <span className="font-heading font-bold text-dark">{order.invoice.invoiceNumber}</span>
                        <span className={`ml-2 text-[10px] font-bold tracking-[0.06em] uppercase px-2 py-0.5 rounded-full ${order.invoice.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {order.invoice.status}
                        </span>
                      </div>
                    )}
                    {order.shippingLabel && (
                      <div className="text-[12px]">
                        <span className="text-g500">Tracking: </span>
                        <span className="font-heading font-bold text-dark">
                          {order.shippingLabel.carrier} — {order.shippingLabel.trackingNumber}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* RUO Reminder */}
          <div className="mt-10 bg-amber-50 border border-amber-200 rounded-xl p-4 text-[12px] text-g700 leading-relaxed">
            ⚠️ <strong>Research Use Only:</strong> All Pepscore products are for research purposes only. Not intended for human use, consumption, diagnostic use, therapeutic use, or veterinary use.
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
