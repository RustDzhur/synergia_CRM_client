/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "avataaars.io" }],
  },
}

const withNextIntl = require('next-intl/plugin')(
    './i18n.ts'
  );

module.exports = withNextIntl(nextConfig)



