// Вынесено из app/api/blog/route.ts: файл route.ts может экспортировать только обработчики HTTP-методов и несколько
// специальных констант (dynamic, revalidate…) — любой другой именованный экспорт иногда ломает проверку типов Next.js
// при сборке ("does not match the required types of a Next.js Route").
export const toBlogDTO = (p: any) => ({
    id: String(p._id), slug: p.slug, image: p.image,
    title: p.title, excerpt: p.excerpt, body: p.body,
    publishedAt: p.publishedAt.toISOString().slice(0, 10),
});
