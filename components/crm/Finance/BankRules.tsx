"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { apiCall } from "@/store/crmApi";

interface Rule { id: string; field: string; pattern: string; category: string; hits: number; createdByName: string }

// Правила сверки: «контрагент/назначение содержит … → статья». Явные и видимые, без самообучения; плюс «обновить все банки».
export default function BankRules({ canEdit }: { canEdit: boolean }) {
	const t = useTranslations("finance");
	const [rules, setRules] = useState<Rule[]>([]);
	const [field, setField] = useState("counterparty");
	const [pattern, setPattern] = useState("");
	const [category, setCategory] = useState("");
	const [busy, setBusy] = useState(false);

	const load = useCallback(async () => {
		const r = await apiCall<{ rules: Rule[] }>("/api/review/rules", "GET", undefined, { cache: "no-store" });
		if (r.ok && r.data) setRules(r.data.rules);
	}, []);
	useEffect(() => { void load(); }, [load]);

	async function add() {
		setBusy(true);
		const r = await apiCall<{ applied: number }>("/api/review/rules", "POST", { field, pattern, category });
		setBusy(false);
		if (!r.ok) return void toast.error(r.message);
		toast.success(t("rulesAdded", { n: r.data?.applied ?? 0 }));
		setPattern(""); setCategory("");
		void load();
	}
	async function syncBanks() {
		setBusy(true);
		const r = await apiCall<{ accounts: { ok: boolean }[] }>("/api/bank/sync", "POST", {});
		setBusy(false);
		if (!r.ok) return void toast.error(r.message);
		const list = r.data?.accounts ?? [];
		toast(t("bankSyncDone", { ok: list.filter((a) => a.ok).length, failed: list.filter((a) => !a.ok).length }));
	}

	return (
		<section className="fs-card mt-16 p-18">
			<div className="flex flex-wrap items-center gap-12">
				<h3 className="text-14 font-semibold text-[#f1f4ee]">{t("rulesTitle")}</h3>
				<button type="button" disabled={busy} onClick={() => void syncBanks()} className="fs-btn fs-btn-ghost ml-auto h-34 text-12 disabled:opacity-50">{t("bankSyncAll")}</button>
			</div>
			<p className="mt-6 max-w-[640px] text-12 leading-[1.5] text-[#8c948b]">{t("rulesHint")}</p>
			<ul className="mt-12 flex flex-col gap-6">
				{rules.length === 0 && <li className="text-12 text-[#8c948b]">{t("rulesEmpty")}</li>}
				{rules.map((r) => (
					<li key={r.id} className="flex flex-wrap items-center gap-x-12 gap-y-4 text-13 text-[#f1f4ee]">
						<span className="text-[#8c948b]">{t(`rulesField_${r.field}` as never)}</span>
						<span>“{r.pattern}” →</span>
						<span className="fs-chip h-22 px-8 text-11">{r.category}</span>
						<span className="text-12 text-[#8c948b]">{t("rulesHits", { n: r.hits })} · {r.createdByName}</span>
						{canEdit && <button type="button" className="ml-auto text-12 text-[#ff9f9f] hover:underline" onClick={() => void apiCall(`/api/review/rules/${r.id}`, "DELETE").then((x) => { if (!x.ok) toast.error(x.message); else void load(); })}>{t("cancel")}</button>}
					</li>
				))}
			</ul>
			{canEdit && (
				<div className="mt-12 flex flex-wrap gap-8">
					<select className="fs-field h-38 px-10 text-13" value={field} onChange={(e) => setField(e.target.value)}>
						<option value="counterparty">{t("rulesField_counterparty")}</option>
						<option value="reference">{t("rulesField_reference")}</option>
					</select>
					<input className="fs-field h-38 min-w-[180px] flex-1 px-12 text-13 outline-none" value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder={t("rulesPattern")} maxLength={80} />
					<input className="fs-field h-38 min-w-[160px] flex-1 px-12 text-13 outline-none" value={category} onChange={(e) => setCategory(e.target.value)} placeholder={t("rulesCategory")} maxLength={80} />
					<button type="button" disabled={busy || pattern.trim().length < 3 || !category.trim()} onClick={() => void add()} className="fs-btn fs-btn-primary h-38 disabled:opacity-50">{t("rulesAdd")}</button>
				</div>
			)}
		</section>
	);
}
