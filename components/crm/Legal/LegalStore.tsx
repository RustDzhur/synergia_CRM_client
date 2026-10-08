"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { apiCall } from "@/store/crmApi";
import PageHeader from "@/components/crm/shared/PageHeader";
import SettingsTabs from "@/components/crm/Settings/SettingsTabs";

interface Doc { id: string; title: string; counterparty: string; status: string; dueDate: string; currentVersion: number; checklist: Record<string, boolean> | null }
interface Version { n: number; body: string; note: string; aiDraft: boolean; createdByName: string; createdAt: string }
interface Tpl { id: string; name: string; vars: string[] }
interface DiffLine { type: "same" | "add" | "del"; text: string }
const NEXT: Record<string, string[]> = { draft: ["in_review", "archived"], in_review: ["approved", "rejected", "draft"], approved: ["signed", "in_review", "archived"], rejected: ["draft", "archived"], signed: ["archived"], archived: [] };

// Хранилище договоров клиента (юрист): версии, статусы согласования, шаблоны с переменными, срок → календарь, сравнение, чек-лист.
// Чек-лист — памятка специалисту, не юридическое заключение; текст ИИ всегда помечен как черновик для проверки.
export default function LegalStore() {
	const t = useTranslations("legal");
	const [docs, setDocs] = useState<Doc[]>([]);
	const [tpls, setTpls] = useState<Tpl[]>([]);
	const [open, setOpen] = useState<{ doc: Doc; versions: Version[]; items: string[] } | null>(null);
	const [diff, setDiff] = useState<DiffLine[] | null>(null);
	const [form, setForm] = useState({ title: "", counterparty: "", body: "", dueDate: "" });
	const [tplForm, setTplForm] = useState({ name: "", body: "" });
	const [newBody, setNewBody] = useState("");

	const load = useCallback(async () => {
		const [d, tp] = await Promise.all([apiCall<{ docs: Doc[] }>("/api/legal/docs", "GET", undefined, { cache: "no-store" }), apiCall<{ templates: Tpl[] }>("/api/legal/templates", "GET", undefined, { cache: "no-store" })]);
		if (d.ok && d.data) setDocs(d.data.docs);
		if (tp.ok && tp.data) setTpls(tp.data.templates);
	}, []);
	useEffect(() => { void load(); }, [load]);

	const show = useCallback(async (id: string) => {
		const r = await apiCall<{ doc: Doc; versions: Version[]; checklistItems: string[] }>(`/api/legal/docs/${id}`, "GET", undefined, { cache: "no-store" });
		if (r.ok && r.data) { setOpen({ doc: r.data.doc, versions: r.data.versions, items: r.data.checklistItems }); setNewBody(r.data.versions[0]?.body ?? ""); setDiff(null); }
	}, []);

	async function run(fn: () => Promise<{ ok: boolean; message: string }>, done: string, after?: () => void) {
		const r = await fn();
		if (!r.ok) return void toast.error(r.message);
		toast.success(done);
		after?.();
		void load();
		if (open) void show(open.doc.id);
	}

	return (
		<div className="px-16 py-20 md:px-24 md:py-24 lg:px-32">
			<PageHeader />
			<div className="flex flex-col gap-20 lg:flex-row">
				<SettingsTabs className="shrink-0 md:self-start" />
				<div className="min-w-0 flex-1">
					<h2 className="text-15 font-semibold text-[#f1f4ee]">{t("title")}</h2>
					<p className="mt-6 max-w-[640px] text-12 leading-[1.5] text-[#8c948b]">{t("hint")}</p>

					<ul className="mt-14 flex flex-col gap-8">
						{docs.length === 0 && <li className="text-12 text-[#8c948b]">{t("empty")}</li>}
						{docs.map((d) => (
							<li key={d.id} className="fs-card flex flex-wrap items-center gap-x-12 gap-y-4 p-12 text-13 text-[#f1f4ee]">
								<button type="button" className="min-w-0 flex-1 truncate text-left hover:underline" onClick={() => void show(d.id)}>{d.title}{d.counterparty ? ` · ${d.counterparty}` : ""}</button>
								<span className="fs-chip h-22 px-8 text-10">{t(`status_${d.status}` as never)}</span>
								<span className="text-12 text-[#8c948b]">v{d.currentVersion}{d.dueDate ? ` · ${d.dueDate}` : ""}</span>
							</li>
						))}
					</ul>

					{open && (
						<section className="fs-card mt-16 p-16">
							<div className="flex flex-wrap items-center gap-10">
								<h3 className="text-14 font-semibold text-[#f1f4ee]">{open.doc.title}</h3>
								<span className="fs-chip h-22 px-8 text-10">{t(`status_${open.doc.status}` as never)}</span>
								{NEXT[open.doc.status]?.map((s) => <button key={s} type="button" className="text-12 text-[#c6ff4d] hover:underline" onClick={() => void run(() => apiCall(`/api/legal/docs/${open.doc.id}`, "PATCH", { status: s }), t("statusChanged"))}>→ {t(`status_${s}` as never)}</button>)}
								<label className="ml-auto flex items-center gap-6 text-12 text-[#8c948b]">{t("due")}<input type="date" className="fs-field h-32 px-8 text-12" value={open.doc.dueDate} onChange={(e) => void run(() => apiCall(`/api/legal/docs/${open.doc.id}`, "PATCH", { dueDate: e.target.value }), t("dueSaved"))} /></label>
							</div>
							<h4 className="mb-6 mt-14 text-12 font-semibold text-[#cfd4cb]">{t("checklist")}</h4>
							<p className="mb-6 text-11 text-[#8c948b]">{t("checklistNote")}</p>
							<div className="flex flex-wrap gap-x-16 gap-y-6">
								{open.items.map((k) => <label key={k} className="flex items-center gap-6 text-12 text-[#cfd4cb]"><input type="checkbox" checked={!!open.doc.checklist?.[k]} onChange={(e) => void run(() => apiCall(`/api/legal/docs/${open.doc.id}`, "PATCH", { checklist: { ...(open.doc.checklist ?? {}), [k]: e.target.checked } }), t("checklistSaved"))} />{t(`check_${k}` as never)}</label>)}
							</div>
							<h4 className="mb-6 mt-14 text-12 font-semibold text-[#cfd4cb]">{t("versions")}</h4>
							<ul className="flex flex-col gap-6">
								{open.versions.map((v, i) => (
									<li key={v.n} className="text-12 text-[#cfd4cb]">
										v{v.n} · {v.createdByName} · {new Date(v.createdAt).toLocaleString()}
										{v.aiDraft && <span className="ml-8 rounded-6 bg-[rgba(244,161,0,0.15)] px-6 py-2 text-[#F4A100]">{t("aiDraft")}</span>}
										{i < open.versions.length - 1 && <button type="button" className="ml-10 text-[#c6ff4d] hover:underline" onClick={() => void apiCall<{ lines: DiffLine[] }>(`/api/legal/docs/${open.doc.id}/diff?a=${open.versions[i + 1].n}&b=${v.n}`).then((r) => r.ok && r.data && setDiff(r.data.lines))}>{t("compare", { a: open.versions[i + 1].n, b: v.n })}</button>}
									</li>
								))}
							</ul>
							{diff && <pre className="mt-10 max-h-[260px] overflow-auto rounded-10 bg-[rgba(255,255,255,0.03)] p-10 text-12 leading-[1.5]">{diff.map((l, i) => <div key={i} className={l.type === "add" ? "text-[#c6ff4d]" : l.type === "del" ? "text-[#ff9f9f] line-through" : "text-[#8c948b]"}>{l.type === "add" ? "+ " : l.type === "del" ? "− " : "  "}{l.text}</div>)}</pre>}
							{!["signed", "archived"].includes(open.doc.status) && (
								<div className="mt-14">
									<textarea className="fs-field min-h-[140px] w-full p-12 text-13 outline-none" value={newBody} onChange={(e) => setNewBody(e.target.value)} />
									<button type="button" className="fs-btn fs-btn-primary mt-8 h-38" onClick={() => void run(() => apiCall(`/api/legal/docs/${open.doc.id}/versions`, "POST", { body: newBody }), t("versionSaved"))}>{t("saveVersion")}</button>
								</div>
							)}
						</section>
					)}

					<section className="fs-card mt-16 p-16">
						<h3 className="text-14 font-semibold text-[#f1f4ee]">{t("newDoc")}</h3>
						<div className="mt-10 grid gap-8 md:grid-cols-3">
							<input className="fs-field h-38 px-12 text-13 outline-none" placeholder={t("docTitle")} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
							<input className="fs-field h-38 px-12 text-13 outline-none" placeholder={t("counterparty")} value={form.counterparty} onChange={(e) => setForm({ ...form, counterparty: e.target.value })} />
							<input type="date" className="fs-field h-38 px-12 text-13 outline-none" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
						</div>
						<textarea className="fs-field mt-8 min-h-[110px] w-full p-12 text-13 outline-none" placeholder={t("docBody")} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
						<button type="button" disabled={form.title.trim().length < 2 || !form.body.trim()} className="fs-btn fs-btn-primary mt-8 h-38 disabled:opacity-50" onClick={() => void run(() => apiCall("/api/legal/docs", "POST", form), t("docCreated"), () => setForm({ title: "", counterparty: "", body: "", dueDate: "" }))}>{t("create")}</button>
					</section>

					<section className="fs-card mt-16 p-16">
						<h3 className="text-14 font-semibold text-[#f1f4ee]">{t("templates")}</h3>
						<p className="mt-4 text-11 text-[#8c948b]">{t("templatesHint")}</p>
						<ul className="mt-10 flex flex-col gap-6">
							{tpls.map((tp) => (
								<li key={tp.id} className="flex flex-wrap items-center gap-x-12 text-13 text-[#f1f4ee]">
									<span>{tp.name}</span><span className="text-12 text-[#8c948b]">{tp.vars.map((v) => `{{${v}}}`).join(" ")}</span>
									<button type="button" className="text-12 text-[#c6ff4d] hover:underline" onClick={() => { const values: Record<string, string> = {}; for (const v of tp.vars) values[v] = window.prompt(v) ?? ""; void run(() => apiCall(`/api/legal/templates/${tp.id}`, "POST", { values }), t("docCreated")); }}>{t("useTemplate")}</button>
									<button type="button" className="text-12 text-[#ff9f9f] hover:underline" onClick={() => void run(() => apiCall(`/api/legal/templates/${tp.id}`, "DELETE"), t("templateRemoved"))}>{t("remove")}</button>
								</li>
							))}
						</ul>
						<div className="mt-10 grid gap-8">
							<input className="fs-field h-38 px-12 text-13 outline-none" placeholder={t("templateName")} value={tplForm.name} onChange={(e) => setTplForm({ ...tplForm, name: e.target.value })} />
							<textarea className="fs-field min-h-[90px] p-12 text-13 outline-none" placeholder={t("templateBody")} value={tplForm.body} onChange={(e) => setTplForm({ ...tplForm, body: e.target.value })} />
							<button type="button" disabled={tplForm.name.trim().length < 2 || !tplForm.body.trim()} className="fs-btn fs-btn-ghost h-38 w-fit disabled:opacity-50" onClick={() => void run(() => apiCall("/api/legal/templates", "POST", tplForm), t("templateSaved"), () => setTplForm({ name: "", body: "" }))}>{t("saveTemplate")}</button>
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}
