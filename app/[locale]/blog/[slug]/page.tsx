import React from "react";
import { notFound } from "next/navigation";
import { Footer, Navigation } from "@/components/website";
import BlogPost from "@/components/website/components/Blog/BlogPost";
import { BLOG } from "@/app/content/sitePages";

export default function Page({ params }: { params: { slug: string } }) {
	if (!BLOG.posts.some((p) => p.slug === params.slug)) notFound();
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<BlogPost slug={params.slug} />
			<div className="overflow-hidden">
				<Footer />
			</div>
		</div>
	);
}
