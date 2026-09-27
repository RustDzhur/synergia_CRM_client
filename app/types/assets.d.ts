// Импорт .ttf отдаёт data-URI (next.config.js, правило asset/inline) — см. lib/finance/pdf.ts
declare module "*.ttf" {
    const url: string;
    export default url;
}
