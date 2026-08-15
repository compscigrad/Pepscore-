// GET/PATCH /api/admin/inventory/[id]/content -- storefront SEO/content
// editor backend (Phase 2B item 6). See lib/productContent.ts.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { updateProductContent, ProductContentError } from '@/lib/productContent'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const product = await prisma.product.findUniqueOrThrow({
    where: { id },
    select: {
      slug: true,
      name: true,
      category: true,
      description: true,
      fullDescription: true,
      seoTitle: true,
      metaDescription: true,
      imageAltText: true,
      searchSynonyms: true,
      faq: true,
      relatedProductSlugs: true,
      featured: true,
      noindex: true,
      availabilityMessageOverride: true,
    },
  })
  const redirects = await prisma.productSlugRedirect.findMany({ where: { productId: id }, select: { oldSlug: true, createdAt: true } })

  return NextResponse.json({ product, redirects })
}

const faqEntrySchema = z.object({ question: z.string().min(1), answer: z.string().min(1) })

const patchSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug must be lowercase, alphanumeric, hyphen-separated').optional(),
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  fullDescription: z.string().nullable().optional(),
  seoTitle: z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
  imageAltText: z.string().nullable().optional(),
  searchSynonyms: z.string().nullable().optional(),
  faq: z.array(faqEntrySchema).nullable().optional(),
  relatedProductSlugs: z.array(z.string()).optional(),
  featured: z.boolean().optional(),
  noindex: z.boolean().optional(),
  availabilityMessageOverride: z.string().nullable().optional(),
  reason: z.string().optional(),
})

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const { reason, ...input } = patchSchema.parse(await req.json())
    const updated = await updateProductContent(id, input, { userId: userId!, reason })
    return NextResponse.json({ ok: true, product: updated })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    if (err instanceof ProductContentError) return NextResponse.json({ error: err.message }, { status: 400 })
    console.error('[admin/inventory/:id/content PATCH]', err)
    return NextResponse.json({ error: 'Failed to update product content' }, { status: 400 })
  }
}
