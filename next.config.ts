import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'files.stripe.com' },
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
  // Stripe webhooks need raw body — handled via route config
}

export default nextConfig
