module.exports = {
  plugins: {
    // Tailwind v4 ships its own PostCSS plugin and handles vendor prefixing
    // internally, so `autoprefixer` is no longer part of the chain.
    '@tailwindcss/postcss': {},
  },
};
