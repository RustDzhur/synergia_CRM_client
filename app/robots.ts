import type { MetadataRoute } from "next";

const SITE = (process.env.APP_URL ?? "https://www.firmspace.de").replace(/\/+$/, "");

export default function robots(): MetadataRoute.Robots {
	return {
		rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/crm", "/en/crm", "/ua/crm"] },
		sitemap: `${SITE}/sitemap.xml`,
	};
}
