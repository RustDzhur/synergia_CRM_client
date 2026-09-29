"use client";
import React, { useEffect } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { TbSpeakerphone } from "react-icons/tb";
import { useFeedStore } from "@/store/useFeedStore";
import { relativeTime } from "@/utils/crmFormat";

// Объявления команды на дашборде: последние три записи ленты. Полная лента — в разделе
// «Сотрудничество → Лента»; здесь только то, что коллеги написали, чтобы это не искали.
export default function FeedCard({ enabled }: { enabled: boolean }) {
	const t = useTranslations("dashboard");
	const locale = useLocale();
	const { posts, load, loaded } = useFeedStore();

	useEffect(() => {
		if (enabled && !loaded) void load();
	}, [enabled, loaded, load]);

	if (!enabled) return null;
	const latest = posts.slice(0, 3);

	return (
		<div className="fs-card flex flex-col p-16">
			<div className="mb-12 flex items-center justify-between gap-12">
				<h2 className="flex items-center gap-8 text-14 font-semibold text-[#f1f4ee]">
					<TbSpeakerphone size={16} className="text-[#c6ff4d]" aria-hidden />
					{t("announcements")}
				</h2>
				<Link href={`/${locale}/crm/collaboration/feed`} className="text-12 font-semibold text-[#c6ff4d] transition-opacity hover:opacity-80">
					{t("openFeed")}
				</Link>
			</div>
			{latest.length === 0 ? (
				<p className="text-13 text-[#8c948b]">{t("noAnnouncements")}</p>
			) : (
				<ul className="flex flex-col gap-10">
					{latest.map((p) => (
						<li key={p.id} className="min-w-0 border-b border-[rgba(255,255,255,0.06)] pb-10 last:border-0 last:pb-0">
							<p className="line-clamp-2 text-13 [overflow-wrap:anywhere] text-[#f1f4ee]">{p.text || p.taskTitle}</p>
							<p className="mt-4 text-11 text-[#9AA396]">
								{p.author} · {relativeTime(p.at, locale, t("justNow"))}
							</p>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
