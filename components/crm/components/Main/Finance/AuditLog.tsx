"use client";
import React, { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { apiCall } from "@/app/store/crmApi";

interface Entry { id: string; action: string; entityType: string; summary: string; userName: string; createdAt: string }

// Журнал финансово значимых действий (кто отправил счёт, отметил оплаченным, подписал договор, удалил расход) —
// см. lib/audit.ts. Не полный аудит всего подряд, только точки, где важно знать "кто и когда", а не только "что сейчас".
export default function AuditLog() {
	const t = useTranslations("finance");
	const locale = useLocale();
	const [entries, setEntries] = useState<Entry[] | null>(null);

	useEffect(() => {
		apiCall<Entry[]>("/api/finance/audit").then((r) => r.ok && r.data && setEntries(r.data));
	}, []);

	if (entries === null) return null;
	if (entries.length === 0) return <p className="rounded-16 bg-[#F5F7FC] p-30 text-center text-16 text-[#999999]">{t("auditEmpty")}</p>;

	return (
		<ul className="flex flex-col gap-8">
			{entries.map((e) => (
				<li key={e.id} className="flex flex-wrap items-center justify-between gap-8 rounded-12 bg-white px-16 py-12 shadow-heroImage">
					<p className="text-14 text-[#333333]">{e.summary}</p>
					<p className="shrink-0 text-12 text-[#999999]">{e.userName || "—"} · {new Date(e.createdAt).toLocaleString(locale === "ua" ? "uk" : locale)}</p>
				</li>
			))}
		</ul>
	);
}
