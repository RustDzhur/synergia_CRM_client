// Данные блога вынесены из app/api/blog/route.ts: файл route.ts может экспортировать только обработчики
// HTTP-методов и несколько специальных констант (dynamic, revalidate…) — любой другой именованный экспорт
// иногда ломает проверку типов Next.js при сборке ("does not match the required types of a Next.js Route").
//
// Этими же помощниками пользуются серверные страницы лендинга (app/[locale]/blog): они рендерят статьи
// сразу в HTML, без клиентского fetch("/api/blog").

// Тексты статьи в БД — Json с ключами языков (de/en/ua). Описываем только то, что реально нужно лендингу.
export type BlogPostText = Record<string, string> | null;

export interface BlogPostDTO {
	id: string;
	slug: string;
	image: string;
	title: BlogPostText;
	excerpt: BlogPostText;
	body: BlogPostText[] | null;
	publishedAt: string; // YYYY-MM-DD
}

export const toBlogDTO = (p: any): BlogPostDTO => ({
	id: p.id, slug: p.slug, image: p.image,
	title: p.title, excerpt: p.excerpt, body: p.body,
	publishedAt: p.publishedAt.toISOString().slice(0, 10),
});

// Картинки постов лежат в public/images/blog, либо это произвольный URL, заданный в админке.
export const blogImage = (name: string) => (name.startsWith("http") || name.startsWith("/") ? name : `/images/blog/${name}.jpg`);

// Текст на нужном языке с фолбэком на английский, затем на de/ua — как было в прежнем клиентском компоненте.
export function blogText(value: unknown, locale: string): string {
	if (!value || typeof value !== "object") return "";
	const record = value as Record<string, unknown>;
	const raw = record[locale] ?? record.en ?? record.de ?? record.ua;
	return typeof raw === "string" ? raw : "";
}
