"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { apiCall } from "@/store/crmApi";

interface Batch { id: string; status: string; count: number; skipped: number; createdByName: string }
interface Rule { id: string; field: string; pattern: string; category: string; hits: number; createdByName: string }

// Правила сверки: «контрагент/назначение содержит … → статья». Явные и видимые, без самообучения; плюс «обновить все банки».
export default function BankRules({ canEdit }: { canEdit: boolean }) {
	const t = useTranslations("finance");
	const [rules, setRules] = useState<Rule[]>([]);
	const [field, setField] = useState("counterparty");
	const [pattern, setPattern] = useState("");
	const [category, setCategory] = useState("");
	const [busy, setBusy] = useState(false);
	const [batches, setBatches] = useState<Batch[]>([]);

	const load = useCallback(async () => {
		const r = await apiCall<{ rules: Rule[] }>("/api/review/rules", "GET", undefined, { cache: "no-store" });
		if (r.ok && r.data) setRules(r.data.rules);
		const bt = await apiCall<{ batches: Batch[] }>("/api/review/batches", "GET", undefined, { cache: "no-store" });
		if (bt.ok && bt.data) setBatches(bt.data.batches);
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
	async function batch(action: "propose" | "apply" | "rollback" | "dismiss", id?: string) {
		setBusy(true);
		const r = action === "propose" ? await apiCall("/api/review/batches", "POST", {}) : await apiCall(`/api/review/batches/${id}`, "POST", { action });
		setBusy(false);
		if (!r.ok) return void toast.error(r.message);
		toast.success(t(`batchDone_${action}` as never));
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
			{canEdit && (
				<div className="mt-16 border-t border-inkLineSoft pt-12">
					<div className="flex flex-wrap items-center gap-10">
						<h4 className="text-13 font-semibold text-[#f1f4ee]">{t("batchTitle")}</h4>
						<button type="button" disabled={busy || rules.length === 0} onClick={() => void batch("propose")} className="fs-btn fs-btn-ghost h-34 text-12 disabled:opacity-50">{t("batchPropose")}</button>
					</div>
					<p className="mt-4 text-11 text-[#8c948b]">{t("batchHint")}</p>
					<ul className="mt-8 flex flex-col gap-6">
						{batches.slice(0, 5).map((b) => (
							<li key={b.id} className="flex flex-wrap items-center gap-x-12 text-12 text-[#cfd4cb]">
								<span>{t(`batchStatus_${b.status}` as never)}</span><span>{t("batchCount", { n: b.count })}{b.skipped ? ` · ${t("batchSkipped", { n: b.skipped })}` : ""}</span><span className="text-[#8c948b]">{b.createdByName}</span>
								{b.status === "proposed" && <><button type="button" className="text-[#c6ff4d] hover:underline" onClick={() => void batch("apply", b.id)}>{t("batchApply")}</button><button type="button" className="text-[#ff9f9f] hover:underline" onClick={() => void batch("dismiss", b.id)}>{t("batchDismiss")}</button></>}
								{b.status === "applied" && <button type="button" className="text-[#F4A100] hover:underline" onClick={() => void batch("rollback", b.id)}>{t("batchRollback")}</button>}
							</li>
						))}
					</ul>
				</div>
			)}
		</section>
	);
}
