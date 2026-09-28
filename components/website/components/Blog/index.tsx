"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "next-intl";
import { tx } from "@/app/content/i18n";
import { BLOG } from "@/app/content/sitePages";
import { withLocale } from "@/app/utils/locale";
import PageShell from "../PageShell";

// Картинки постов лежат в public/images/blog, либо это произвольный URL, заданный в админке
export const blogImage = (name: string) => (name.startsWith("http") || name.startsWith("/") ? name : `/images/blog/${name}.jpg`);

export interface BlogPostDTO { id: string; slug: string; image: string; title: Record<string, string>; excerpt: Record<string, string>; body: Record<string, string>[]; publishedAt: string }

// Blog: сетка карточек 3×2 (десктоп), по две на планшете, по одной на телефоне. «Read More» ведёт на статью.
// Статьи теперь приходят из БД (/api/blog) — владелец платформы добавляет/удаляет их в /crm/admin, не в коде.
export default function BlogPage() {
	const locale = useLocale();
	const [posts, setPosts] = useState<BlogPostDTO[] | null>(null);

	useEffect(() => {
		fetch("/api/blog").then((r) => r.json()).then(setPosts).catch(() => setPosts([]));
	}, []);

	return (
		<PageShell title={tx(BLOG.title, locale)} center>
			{/* Полоса снизу карточки — отдельным слоем, а не через border-b цветом: `border-transparent`
			    в собранном CSS идёт позже цветной рамки и погасил бы её вместе с тонким контуром карточки */}
			{posts === null ? (
				<p className="py-30 text-center text-16 text-[#999999]">…</p>
			) : posts.length === 0 ? (
				<p className="py-30 text-center text-16 text-[#999999]">—</p>
			) : (
				<ul className="grid gap-20 md:grid-cols-2 lg:grid-cols-3">
					{posts.map((post) => (
						<li key={post.slug} className="group relative flex flex-col overflow-hidden rounded-8 border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.03)]">
							<Link href={withLocale(locale, `/blog/${post.slug}`)} className="block">
								<Image src={blogImage(post.image)} alt="" width={400} height={276} className="h-[210px] w-full object-cover lg:h-[276px]" unoptimized={post.image.startsWith("http")} />
							</Link>
							<div className="flex flex-1 flex-col px-20 pb-24 pt-20">
								<h2 className="mb-12 text-18 lg:text-20 font-medium tracking-[0.4px] text-[#f1f4ee]">{tx(post.title as any, locale)}</h2>
								<p className="text-14 lg:text-16 leading-[1.7] tracking-[0.3px] text-[#8c948b]">{tx(post.excerpt as any, locale)}</p>
							</div>
							<Link href={withLocale(locale, `/blog/${post.slug}`)} className="border-t border-[rgba(255,255,255,0.10)] px-20 py-16 text-16 font-medium text-[#8c948b] transition-colors group-hover:text-authBtn">
								{tx(BLOG.readMore, locale)}
							</Link>
							<span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-transparent transition-colors duration-200 group-hover:bg-authBtn" />
						</li>
					))}
				</ul>
			)}
		</PageShell>
	);
}
