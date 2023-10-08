/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['avataaars.io'],
  },
}

const withNextIntl = require('next-intl/plugin')(
    './i18n.ts'
  );

module.exports = withNextIntl(nextConfig)



