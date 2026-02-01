/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Enable standalone output for optimized Docker builds

  // Don't fail build on ESLint errors (show warnings instead)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Generate unique build ID to force cache invalidation on deployment
  generateBuildId: async () => {
    // Use timestamp for production builds to ensure cache busting
    if (process.env.NODE_ENV === 'production') {
      return `${Date.now()}`;
    }
    // Use 'development' for local dev
    return 'development';
  },

  // Optimize images
  images: {
    unoptimized: false,
  },

  // Enable SWC minification (faster than Terser)
  swcMinify: true,

  // Add cache control headers to prevent aggressive browser caching of HTML
  async headers() {
    return [
      {
        // Apply to all pages (not static assets)
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            // Cache HTML for 5 minutes, then revalidate
            // Static assets (JS/CSS) still get long cache via _next/ prefix
            value: 'public, max-age=300, must-revalidate',
          },
        ],
      },
      {
        // TEMPORARILY DISABLE CACHING for static assets until cache-busting works reliably
        // TODO: Re-enable long caching once we implement proper versioning
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig
