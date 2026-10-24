"use client";
import { useTranslations } from "next-intl";

// Сколько места занято и сколько выделено у одного из двух хранилищ раздела: у своего (тариф CRM)
// и у подключённого (квота Google Диска). Значения — в мегабайтах; лимит 0 означает «неизвестен»
// (у безлимитных аккаунтов Google его может не быть), тогда показываем только занятое.
function size(mb: number, gb: string, mbLabel: string): string {
	return mb >= 1024 ? `${(mb / 1024).toFixed(1)} ${gb}` : `${mb} ${mbLabel}`;
}

export default function VolumeLine({ label, used, limit, hint }: { label: string; used: number | null; limit: number; hint?: string }) {
	const t = useTranslations("collab");
	if (hint) return <p className="text-12 text-[#8c948b]">{hint}</p>;
	// used === null — объём ещё не спрошен (или запрос не удался): показываем «…», а не ложный ноль
	if (used === null) return <p className="text-12 text-[#8c948b]">{label}: <span className="text-[#f1f4ee]">…</span></p>;
	const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
	return (
		<div className="min-w-[220px]">
			<p className="text-12 text-[#8c948b]">
				{label}:{" "}
				<span className="text-[#f1f4ee]">{size(used, t("gb"), t("mb"))}</span>
				{limit > 0 && <span> {t("ofLimit", { limit: size(limit, t("gb"), t("mb")) })}</span>}
			</p>
			{limit > 0 && (
				<div className="mt-6 h-4 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]" title={`${percent}%`}>
					<div className={`h-full rounded-full ${percent >= 90 ? "bg-[#EB5757]" : "bg-[#c6ff4d]"}`} style={{ width: `${percent}%` }} />
				</div>
			)}
		</div>
	);
}
