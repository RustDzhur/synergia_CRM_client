/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "avataaars.io" }],
  },
  webpack: (config) => {
    // Шрифт документов (assets/fonts/*.ttf) кладём в бандл как data-URI: у pdfkit данные его собственной
    // гарнитуры подгружаются в рантайме через createRequire("#standard-fonts/...") относительно
    // node_modules/pdfkit, а в функциях на Vercel этих файлов нет — генерация PDF падала с
    // "Cannot find module '#standard-fonts/Helvetica'". Со встроенным шрифтом файловых зависимостей нет.
    // Правило намеренно узкое (только assets/fonts) — остальные .ttf в проекте оно не затрагивает.
    config.module.rules.push({
      test: /[\\/]assets[\\/]fonts[\\/][^\\/]+\.ttf$/,
      type: "javascript/auto",
      use: [{ loader: require.resolve("./scripts/ttf-data-uri-loader.js") }],
    });
    return config;
  },
}

const withNextIntl = require('next-intl/plugin')(
    './i18n.ts'
  );

module.exports = withNextIntl(nextConfig)



