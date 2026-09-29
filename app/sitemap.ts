import type { MetadataRoute } from "next";
import { connectDB } from "@/lib/mongodb";
import BlogPost from "@/models/BlogPost";

export const revalidate = 3600;

const SITE = (process.env.APP_URL ?? "https://www.firmspace.de").replace(/\/+$/, "");
const PAGES = ["", "/about", "/services", "/features", "/blog", "/contacts", "/team", "/support", "/careers", "/documentation", "/referral", "/privacypolicy", "/agb", "/impressum"];
// de — язык по умолчанию и работает без префикса; en и ua — с префиксом
const PREFIXES = ["", "/en", "/ua"];

const entries = (path: string, lastModified?: Date): MetadataRoute.Sitemap =>
	PREFIXES.map((prefix) => ({ url: `${SITE}${prefix}${path}` || SITE, lastModified }));

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const pages = PAGES.flatMap((p) => entries(p));
	try {
		await connectDB();
		const posts = await BlogPost.find({ published: true }).select("slug publishedAt").lean<{ slug: string; publishedAt: Date }[]>();
		return [...pages, ...posts.flatMap((p) => entries(`/blog/${p.slug}`, p.publishedAt))];
	} catch {
		return pages;
	}
}
