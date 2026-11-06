export default {
  plugins: {
    // Tailwind 4 is a PostCSS plugin of its own now (@tailwindcss/postcss) and handles the
    // vendor prefixing autoprefixer did, so neither `tailwindcss` nor `autoprefixer` belongs here.
    '@tailwindcss/postcss': {},
  },
}
