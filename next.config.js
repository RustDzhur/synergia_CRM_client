/** @type {import('next').NextConfig} */
const nextConfig = {
  // Сборка для собственного сервера (Docker): Next кладёт в .next/standalone минимальный сервер.
  output: "standalone",
  // instrumentation.ts: запуск фоновых задач при старте сервера (опрос Telegram для управления Айрис)
  experimental: { instrumentationHook: true },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "avataaars.io" }],
  },
  // Раздел «Финансы» раньше жил по адресу /crm/inventory: старые закладки и ссылки в уведомлениях ведут на новый.
  // Параметры (?tab=…) Next переносит сам. Без префикса — язык по умолчанию (de).
  async redirects() {
    return [
      { source: "/crm/inventory", destination: "/crm/finance", permanent: true },
      { source: "/:locale(ua|en|de|uz)/crm/inventory", destination: "/:locale/crm/finance", permanent: true },
    ];
  },
  // Служебные разделы не должны попадать в поиск. Заголовок надёжнее метатега: app/[locale]/crm/layout.tsx —
  // клиентский компонент, из него нельзя экспортировать metadata. Дублирует запрет в app/robots.ts:
  // если URL уже попал в индекс, robots.txt его не уберёт, а X-Robots-Tag — да.
  async headers() {
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }];
    const closed = [
      "/crm", "/crm/:path*",
      "/en/crm", "/en/crm/:path*", "/ua/crm", "/ua/crm/:path*", "/de/crm", "/de/crm/:path*", "/uz/crm", "/uz/crm/:path*",
      // Персональные ссылки на документы клиента (страница /c/<token>).
      "/c/:path*", "/en/c/:path*", "/ua/c/:path*", "/de/c/:path*", "/uz/c/:path*",
    ];
    return closed.map((source) => ({ source, headers: noindex }));
  },
  webpack: (config) => {
    // Шрифт документов (assets/fonts/*.ttf) кладём в бандл как data-URI: у pdfkit данные его собственной
    // гарнитуры подгружаются в рантайме через createRequire("#standard-fonts/...") относительно
    // node_modules/pdfkit, а в serverless-функциях этих файлов нет — генерация PDF падала с
    // "Cannot find module '#standard-fonts/Helvetica'". Со встроенным шрифтом файловых зависимостей нет.
    // Правило намеренно узкое (только assets/fonts) — остальные .ttf в проекте оно не затрагивает.
    config.module.rules.push({
      test: /[\\/]assets[\\/]fonts[\\/][^\\/]+\.ttf$/,
      type: "javascript/auto",
      use: [{ loader: require.resolve("./scripts/ttf-data-uri-loader.js") }],
    });
    // .env/.env.local не разбираем как JS: у @prisma/client есть код, который ищет env-файлы рядом
    // со схемой. В бандле webpack превращает это в контекстный require, подхватывает .env.local и
    // пытается его распарсить — сборка падала с «Module parse failed ... ./.env.local».
    // Файлы читаются с диска в рантайме (Next и Prisma), в бандл их содержимое не нужно.
    config.module.rules.push({
      test: /[\\/]\.env(\..*)?$/,
      type: "asset/source",
    });
    return config;
  },
}

const withNextIntl = require('next-intl/plugin')(
    './i18n.ts'
  );

module.exports = withNextIntl(nextConfig)



