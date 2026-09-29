"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { apiCall } from "@/store/crmApi";
import type { Check } from "./model";

export default function SystemCheckCard() {
	const t = useTranslations("admin");
	const [checks, setChecks] = useState<Check[] | null>(null);
	const [checking, setChecking] = useState(false);

	async function runCheck() {
		setChecking(true);
		const res = await apiCall<Check[]>("/api/admin/system");
		setChecking(false);
		if (res.data) setChecks(res.data);
		else toast.error(res.message);
	}

	return (
		<div className="fs-card mb-24 p-16">
			<div className="flex flex-wrap items-center justify-between gap-12">
				<div><p className="text-14 font-medium text-[#f1f4ee]">{t("sysTitle")}</p><p className="text-12 text-[#8c948b]">{t("sysHelp")}</p></div>
				<button type="button" onClick={runCheck} disabled={checking} className="fs-btn fs-btn-primary h-36 disabled:opacity-60">{checking ? "…" : t("sysRun")}</button>
			</div>
			{checks && (
				<ul className="mt-12 flex flex-col gap-6">
					{checks.map((c) => (
						<li key={c.id} className="flex items-start gap-8 text-13">
							<span className={`mt-2 shrink-0 font-semibold ${c.ok ? "text-[#2DDEB6]" : "text-danger"}`}>{c.ok ? "✓" : "✗"}</span>
							<span><span className="font-medium text-[#f1f4ee]">{t(`sys_${c.id}`)}</span> <span className="text-[#8c948b]">{c.message}</span></span>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
