/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  // Optimize for Vercel deployment
  output: 'standalone',
  poweredByHeader: false,
  compress: true,
}

module.exports = nextConfig