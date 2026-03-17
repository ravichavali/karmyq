/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  // styled-jsx gets hoisted to root node_modules (React 18) by npm workspace deduplication.
  // transpilePackages forces webpack to bundle it instead of externalizing it, so it uses
  // Next.js's compiled React rather than root React 18 — prevents dispatcher conflicts in
  // both App Router pages (/404) and Pages Router error pages (/500).
  transpilePackages: ['styled-jsx'],
};

module.exports = nextConfig;
