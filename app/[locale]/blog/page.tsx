import Image from "next/image";
import Link from "next/link";
import "react";
import { asLocale, JsonLd, sitePath } from "@/lib/seo";
import { blogImage, blogText, type BlogPostDTO } from "@/lib/blog";
import { getPublishedPosts } from "@/lib/blogPosts";
import PageShell from "@/components/website/PageShell";
import { BLOG } from "@/content/sitePages";
import { tx } from "@/content/i18n";
import { pageJsonLd } from "./metadata";
import { Footer, Navigation } from "../../../components/website";

export { generateMetadata } from "./metadata";

// Блог — серверный компонент: статьи приходят из БД и уже есть в HTML (раньше список тянулся
// клиентским fetch("/api/blog"), и для поисковика страница была пустой).
export const dynamic = "force-dynamic";

// Blog: сетка карточек 3×2 (десктоп), по две на планшете, по одной на телефоне. «Read More» ведёт на статью.
export default async function Blog({ params }: { params: { locale: string } }) {
	const locale = asLocale(params.locale);

	let posts: BlogPostDTO[] = [];
	try {
		posts = await getPublishedPosts();
	} catch {
		// БД недоступна — отдаём пустое состояние, как раньше делал клиентский catch.
		posts = [];
	}

	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<PageShell title={tx(BLOG.title, locale)} center>
				{/* Полоса снизу карточки — отдельным слоем, а не через border-b цветом: `border-transparent`
				    в собранном CSS идёт позже цветной рамки и погасил бы её вместе с тонким контуром карточки */}
				{posts.length === 0 ? (
					<p className="py-30 text-center text-16 text-[#999999]">—</p>
				) : (
					<ul className="grid gap-20 md:grid-cols-2 lg:grid-cols-3">
						{posts.map((post) => (
							<li key={post.slug} className="group relative flex flex-col overflow-hidden rounded-8 border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.03)]">
								<Link href={sitePath(locale, `/blog/${post.slug}`)} className="block">
									<Image src={blogImage(post.image)} alt="" width={400} height={276} className="h-[210px] w-full object-cover lg:h-[276px]" unoptimized={post.image.startsWith("http")} />
								</Link>
								<div className="flex flex-1 flex-col px-20 pb-24 pt-20">
									<h2 className="mb-12 text-18 lg:text-20 font-medium tracking-[0.4px] text-[#f1f4ee]">{blogText(post.title, locale)}</h2>
									<p className="text-14 lg:text-16 leading-[1.7] tracking-[0.3px] text-[#8c948b]">{blogText(post.excerpt, locale)}</p>
								</div>
								<Link href={sitePath(locale, `/blog/${post.slug}`)} className="border-t border-[rgba(255,255,255,0.10)] px-20 py-16 text-16 font-medium text-[#8c948b] transition-colors group-hover:text-authBtn">
									{tx(BLOG.readMore, locale)}
								</Link>
								<span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-transparent transition-colors duration-200 group-hover:bg-authBtn" />
							</li>
						))}
					</ul>
				)}
			</PageShell>
			<JsonLd data={pageJsonLd(locale)} />
			<Footer />
		</div>
	);
}
