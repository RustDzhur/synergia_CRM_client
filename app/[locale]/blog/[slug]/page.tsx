import React from "react";
import { Footer, Navigation } from "@/components/website";
import BlogPost from "@/components/website/components/Blog/BlogPost";

export default function Page({ params }: { params: { slug: string } }) {
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
