"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { PromoInfo } from "@/config/promo";

// Карточка программы «первые 500 клиентов — год бесплатно» над тарифами (лендинг и раздел Upgrade): условия, как получить и счётчик мест
export default function PromoBanner({ compact = false }: { compact?: boolean }) {
	const t = useTranslations("promo");
	const locale = useLocale();
	const [info, setInfo] = useState<PromoInfo | null>(null);

	useEffect(() => {
		fetch("/api/promo").then((r) => (r.ok ? r.json() : null)).then((d) => d && setInfo(d)).catch(() => {});
	}, []);

	const seats = info?.seats ?? 500;
	const taken = info?.taken ?? 0;
	const left = info?.left ?? seats;
	const percent = Math.min(100, Math.round((taken / seats) * 100));

	return (
		<div className={`${compact ? "mb-20" : "mb-30 lg:mb-40"} rounded-16 border border-[rgba(198,255,77,0.45)] bg-[rgba(198,255,77,0.07)] p-20 text-left lg:p-25`}>
			<div className="flex flex-wrap items-start justify-between gap-12">
				<div className="max-w-[760px]">
					<p className="text-20 font-semibold text-[#c6ff4d] lg:text-24">🎁 {t("title", { seats })}</p>
					<p className="mt-8 text-15 leading-[22px] text-[#d8ddd5] lg:text-16">{t("body", { seats, months: info?.months ?? 12 })}</p>
				</div>
				<div className="min-w-[200px] text-right">
					<p className="text-28 font-bold leading-none text-white">{left}<span className="ml-4 text-14 font-normal text-[#9AA396]">/ {seats}</span></p>
					<p className="mt-4 text-12 text-[#9AA396]">{left > 0 ? t("left") : t("full")}</p>
				</div>
			</div>
			<div className="mt-12 h-8 w-full overflow-hidden rounded-4 bg-[rgba(255,255,255,0.1)]">
				<div className="h-full rounded-4 bg-[#c6ff4d] transition-all" style={{ width: `${percent}%` }} />
			</div>
			<div className="mt-16 grid gap-16 md:grid-cols-2">
				<div>
					<p className="text-14 font-medium text-white">{t("howTitle")}</p>
					<ol className="mt-6 list-decimal pl-20 text-14 leading-[21px] text-[#d8ddd5]">
						<li>{t("how1")}</li>
						<li>
							{info?.email ? (
								<>{t("how2", { email: "" })}<a href={`mailto:${info.email}?subject=${encodeURIComponent(t("mailSubject"))}`} className="font-medium text-[#c6ff4d] underline">{info.email}</a></>
							) : (
								<>{t("how2NoMail", { email: "" })}<a href={`/${locale}/contacts`} className="font-medium text-[#c6ff4d] underline">{t("contacts")}</a></>
							)}
						</li>
						<li>{t("how3", { months: info?.months ?? 12 })}</li>
					</ol>
				</div>
				<div>
					<p className="text-14 font-medium text-white">{t("termsTitle")}</p>
					<ul className="mt-6 list-disc pl-20 text-14 leading-[21px] text-[#d8ddd5]">
						<li>{t("term1")}</li>
						<li>{t("term2")}</li>
					</ul>
				</div>
			</div>
		</div>
	);
}
