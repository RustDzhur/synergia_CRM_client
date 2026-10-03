import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import "react";
import { asLocale, JsonLd, sitePath } from "@/lib/seo";
import { blogImage, blogText } from "@/lib/blog";
import { getPublishedPost } from "@/lib/blogPosts";
import PageShell from "@/components/website/PageShell";
import { BLOG } from "@/content/sitePages";
import { tx } from "@/content/i18n";
import { Footer, Navigation } from "@/components/website";
import { pageJsonLd, postHeading } from "./metadata";

export { generateMetadata } from "./metadata";

// Статья — серверный компонент: заголовок, дата, картинка и абзацы приходят из БД и уже есть в HTML.
// Неопубликованные и несуществующие адреса отдают 404, чтобы в индексе не появлялись пустые страницы.
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { locale: string; slug: string } }) {
	const locale = asLocale(params.locale);
	const post = await getPublishedPost(params.slug).catch(() => null);

	if (!post) notFound();

	const date = new Date(post.publishedAt).toLocaleDateString(
		locale === "ua" ? "uk-UA" : locale === "de" ? "de-DE" : "en-GB",
		{ day: "numeric", month: "long", year: "numeric" }
	);
	const body = Array.isArray(post.body) ? post.body : [];

	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<PageShell title={postHeading(post, locale)}>
				<p className="-mt-10 mb-24 text-14 text-[#999999]">{date}</p>
				<Image src={blogImage(post.image)} alt="" width={400} height={276} className="mb-30 h-auto w-full max-w-[800px] rounded-16 object-cover" unoptimized={post.image.startsWith("http")} />
				<div className="max-w-[760px]">
					{body.map((paragraph, index) => (
						<p key={index} className="mb-20 text-16 lg:text-18 leading-[1.7] tracking-[0.4px] text-[#f1f4ee]">{blogText(paragraph, locale)}</p>
					))}
				</div>
				<Link href={sitePath(locale, "/blog")} className="mt-20 inline-block text-16 font-medium text-authBtn hover:opacity-80">← {tx(BLOG.back, locale)}</Link>
			</PageShell>
			<JsonLd data={pageJsonLd(post, locale)} />
			<div className="overflow-hidden">
				<Footer />
			</div>
		</div>
	);
}
