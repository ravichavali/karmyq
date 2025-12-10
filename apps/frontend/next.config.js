/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Enable standalone output for optimized Docker builds
  // Optimize images
  images: {
    unoptimized: false,
  },
  // Enable SWC minification (faster than Terser)
  swcMinify: true,
}

module.exports = nextConfig
