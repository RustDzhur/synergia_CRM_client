// Серверный доступ к статьям блога для лендинга.
//
// Запросы те же, что в app/api/blog/route.ts и app/api/blog/[slug]/route.ts, но выполняются прямо
// во время рендера страницы — поэтому заголовок и текст статьи попадают в первую HTML-отдачу,
// а не появляются после клиентского fetch. API-маршруты при этом остаются рабочими и не меняются.

import { prisma } from "@/lib/prisma";
import { toBlogDTO, type BlogPostDTO } from "@/lib/blog";

export async function getPublishedPosts(take = 200): Promise<BlogPostDTO[]> {
	const posts = await prisma.blogPost.findMany({
		where: { published: true },
		orderBy: { publishedAt: "desc" },
		take,
	});
	return posts.map(toBlogDTO);
}

export async function getPublishedPost(slug: string): Promise<BlogPostDTO | null> {
	const post = await prisma.blogPost.findUnique({ where: { slug } });
	return post && post.published ? toBlogDTO(post) : null;
}
