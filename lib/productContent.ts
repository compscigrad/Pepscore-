// Admin storefront SEO/content editing (Phase 2B item 6) -- the single
// place that updates a Product's public-facing content fields. Never
// touches pricing/inventory fields (lib/pricing/service.ts and
// lib/inventory/actions.ts own those).
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export interface FaqEntry {
  question: string
  answer: string
}

export interface ProductContentInput {
  slug?: string
  name?: string
  category?: string
  description?: string
  fullDescription?: string | null
  seoTitle?: string | null
  metaDescription?: string | null
  imageAltText?: string | null
  searchSynonyms?: string | null
  faq?: FaqEntry[] | null
  relatedProductSlugs?: string[]
  featured?: boolean
  noindex?: boolean
  availabilityMessageOverride?: string | null
}

export class ProductContentError extends Error {}

export async function updateProductContent(productId: string, input: ProductContentInput, actor: { userId: string; reason?: string }) {
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } })

  const data: Prisma.ProductUpdateInput = {}
  if (input.name !== undefined) data.name = input.name
  if (input.category !== undefined) data.category = input.category
  if (input.description !== undefined) data.description = input.description
  if (input.fullDescription !== undefined) data.fullDescription = input.fullDescription
  if (input.seoTitle !== undefined) data.seoTitle = input.seoTitle
  if (input.metaDescription !== undefined) data.metaDescription = input.metaDescription
  if (input.imageAltText !== undefined) data.imageAltText = input.imageAltText
  if (input.searchSynonyms !== undefined) data.searchSynonyms = input.searchSynonyms
  if (input.faq !== undefined) data.faq = input.faq === null ? Prisma.JsonNull : (input.faq as unknown as Prisma.InputJsonValue)
  if (input.relatedProductSlugs !== undefined) data.relatedProductSlugs = input.relatedProductSlugs
  if (input.featured !== undefined) data.featured = input.featured
  if (input.noindex !== undefined) data.noindex = input.noindex
  if (input.availabilityMessageOverride !== undefined) data.availabilityMessageOverride = input.availabilityMessageOverride

  return prisma.$transaction(async (tx) => {
    // Slug change: preserve the prior canonical URL as a redirect before
    // applying the new one, so an already-indexed/bookmarked/linked URL
    // never just 404s. A redirect row is immutable once created (never
    // deleted or repointed) -- if a slug bounces back to a value that was
    // previously redirected away from, the old redirect row simply becomes
    // stale/unreachable (the live product now owns that slug directly
    // again), not a conflict, since ProductSlugRedirect.oldSlug is unique
    // per string, not per (string, product).
    if (input.slug !== undefined && input.slug !== product.slug) {
      const claimedBySomeoneElse = await tx.product.findUnique({ where: { slug: input.slug } })
      if (claimedBySomeoneElse) throw new ProductContentError(`Slug "${input.slug}" is already in use by another product.`)

      await tx.productSlugRedirect.deleteMany({ where: { oldSlug: input.slug } })
      await tx.productSlugRedirect.create({ data: { oldSlug: product.slug, productId: product.id } })
      data.slug = input.slug
    }

    const updated = await tx.product.update({ where: { id: productId }, data })

    await tx.adminAuditLog.create({
      data: {
        action: 'UPDATE_PRODUCT_CONTENT',
        entity: 'Product',
        entityId: productId,
        adminId: actor.userId,
        details: { changedFields: Object.keys(data), reason: actor.reason ?? null, slugChanged: input.slug !== undefined && input.slug !== product.slug },
      },
    })

    return updated
  })
}
