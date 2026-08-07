// robots.txt -- allows the real public storefront (homepage, products,
// categories) to be crawled, blocks admin/account/checkout/API/search
// (thin/duplicate query-driven pages, same reasoning noindex already
// applies to /search's own metadata) from crawlers, and disallows
// everything entirely on non-production Vercel environments (previews)
// so a preview deploy is never indexed.
import type { MetadataRoute } from 'next'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pepscore-compscigrads-projects.vercel.app'
const IS_PRODUCTION = process.env.VERCEL_ENV === 'production'

export default function robots(): MetadataRoute.Robots {
  if (!IS_PRODUCTION) {
    return { rules: { userAgent: '*', disallow: '/' } }
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/account', '/checkout', '/api', '/search', '/sign-in', '/sign-up', '/intake'],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  }
}
