"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { TbAlertTriangle } from "react-icons/tb";
import { apiCall } from "@/store/crmApi";

// Плашка рынка UZ: пока хотя бы одна налоговая запись не подтверждена специалистом, режим остаётся бетой (docs/TZ_MASTER.md §4.3).
export default function UzBetaBanner() {
	const t = useTranslations("finance");
	const [verified, setVerified] = useState<boolean | null>(null);
	useEffect(() => {
		let alive = true;
		void apiCall<{ verified: boolean }>("/api/finance/tax-rules?market=UZ").then((r) => { if (alive) setVerified(r.ok && r.data ? r.data.verified : false); });
		return () => { alive = false; };
	}, []);
	if (verified !== false) return null;
	return (
		<div className="mb-16 flex items-start gap-10 rounded-10 border border-[rgba(244,161,0,0.35)] bg-[rgba(244,161,0,0.08)] p-14" role="note">
			<TbAlertTriangle size={17} className="mt-[2px] shrink-0 text-[#F4A100]" aria-hidden />
			<div>
				<p className="text-13 font-semibold text-[#F4A100]">{t("uzBetaTitle")}</p>
				<p className="mt-4 text-12 leading-[1.5] text-[#cfd4cb]">{t("uzBetaText")}</p>
			</div>
		</div>
	);
}
