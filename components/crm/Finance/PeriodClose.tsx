"use client";
import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbLock, TbLockOpen } from "react-icons/tb";
import { apiCall } from "@/store/crmApi";
import { downloadAuthed } from "./download";
import { useActiveOrg } from "@/store/useOrgStore";

// «Закрытие периода»: чек-лист, закрытие и повторное открытие (с причиной), очередь проверки документов и запросы специалиста клиенту.
// Закрытый период защищён на сервере (lib/finance/periodGuard.ts): здесь только управление им.

interface Lock { id: string; from: string; to: string; note: string; lockedByName: string; lockedAt: string; reopenedAt: string | null; reopenReason: string }
interface Item { code: string; count: number; severity: "blocker" | "warning" }
interface QueueRow { id: string; title: string; party: string; date: string; currency: string; amount?: number; review: { status: string; byName: string; note: string } | null }
interface Req { id: string; subject: string; body: string; createdName: string; status: string; answer: string; createdAt: string }

const monthRange = (offset: number) => {
	const now = new Date();
	const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
	const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
	const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
	return { from: iso(first), to: iso(last) };
};

export default function PeriodClose() {
	const t = useTranslations("finance");
	const locale = useLocale();
	const role = useActiveOrg()?.role ?? "";
	const reviewer = ["owner", "admin", "advisor", "counsel"].includes(role);
	const [range, setRange] = useState(monthRange(-1));
	const [locks, setLocks] = useState<Lock[]>([]);
	const [checklist, setChecklist] = useState<Item[]>([]);
	const [queue, setQueue] = useState<QueueRow[]>([]);
	const [expQueue, setExpQueue] = useState<QueueRow[]>([]);
	const [requests, setRequests] = useState<Req[]>([]);
	const [busy, setBusy] = useState(false);
	const [subject, setSubject] = useState("");
	const [answers, setAnswers] = useState<Record<string, string>>({});

	const load = useCallback(async () => {
		const [p, q, e, r] = await Promise.all([
			apiCall<{ periods: Lock[]; checklist?: Item[] }>(`/api/review/periods?from=${range.from}&to=${range.to}`, "GET", undefined, { cache: "no-store" }),
			apiCall<{ items: QueueRow[] }>("/api/review/queue?kind=invoices", "GET", undefined, { cache: "no-store" }),
			apiCall<{ items: QueueRow[] }>("/api/review/queue?kind=expenses", "GET", undefined, { cache: "no-store" }),
			apiCall<{ requests: Req[] }>("/api/review/requests", "GET", undefined, { cache: "no-store" }),
		]);
		if (p.ok && p.data) { setLocks(p.data.periods); setChecklist(p.data.checklist ?? []); }
		if (q.ok && q.data) setQueue(q.data.items);
		if (e.ok && e.data) setExpQueue(e.data.items);
		if (r.ok && r.data) setRequests(r.data.requests);
	}, [range.from, range.to]);
	useEffect(() => { void load(); }, [load]);

	async function act(fn: () => Promise<{ ok: boolean; message: string }>, done: string) {
		if (busy) return;
		setBusy(true);
		const r = await fn();
		setBusy(false);
		if (!r.ok) return void toast.error(r.message);
		toast.success(done);
		void load();
	}
	const blockers = checklist.some((i) => i.severity === "blocker");
	const date = (iso: string) => new Date(iso).toLocaleDateString(locale === "ua" ? "uk" : locale);
	const active = locks.filter((l) => !l.reopenedAt);
	const already = active.some((l) => l.from <= range.to && l.to >= range.from);
	const kinds = [["invoices", queue], ["expenses", expQueue]] as const;

	return (
		<div className="flex flex-col gap-20">
			<section className="fs-card p-16 md:p-20">
				<h2 className="text-16 font-semibold text-[#f1f4ee]">{t("closeTitle")}</h2>
				<p className="mt-6 max-w-[640px] text-12 leading-[1.5] text-[#8c948b]">{t("closeHint")}</p>
				<div className="mt-14 flex flex-wrap items-end gap-10">
					<label className="text-12 text-[#8c948b]">{t("closeFrom")}<input type="date" className="fs-field mt-6 h-40 px-12 text-13 outline-none" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label>
					<label className="text-12 text-[#8c948b]">{t("closeTo")}<input type="date" className="fs-field mt-6 h-40 px-12 text-13 outline-none" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label>
					<button type="button" className="fs-btn fs-btn-ghost h-40" onClick={() => setRange(monthRange(-1))}>{t("closePrevMonth")}</button>
				</div>
				{checklist.length > 0 ? (
					<ul className="mt-14 flex flex-col gap-6">
						{checklist.map((i) => <li key={i.code} className={`text-13 ${i.severity === "blocker" ? "text-[#ff9f9f]" : "text-[#F4A100]"}`}>{i.severity === "blocker" ? "✕" : "!"} {t(`closeItem_${i.code}` as never, { n: i.count })}</li>)}
					</ul>
				) : <p className="mt-14 text-13 text-[#c6ff4d]">{t("closeClean")}</p>}
				{reviewer && (
					<button type="button" disabled={busy || already} onClick={() => void act(() => apiCall("/api/review/periods", "POST", { action: "close", from: range.from, to: range.to, acknowledge: blockers }), t("closeDone"))} className="fs-btn fs-btn-primary mt-14 h-40 disabled:opacity-50">
						<TbLock size={15} /> {blockers ? t("closeAnyway") : t("closeBtn")}
					</button>
				)}
				<button type="button" className="fs-btn fs-btn-ghost mt-14 ml-8 h-40" onClick={() => void downloadAuthed(`/api/finance/handoff?from=${range.from}&to=${range.to}`, `handoff-${range.from}_${range.to}.zip`, t("closeHandoffError"))}>{t("closeHandoff")}</button>
				{already && <p className="mt-8 text-12 text-[#9AA396]">{t("closeAlready")}</p>}
			</section>

			<section>
				<h3 className="mb-8 text-14 font-semibold text-[#f1f4ee]">{t("closeLocks")}</h3>
				<ul className="flex flex-col gap-8">
					{locks.length === 0 && <li className="text-12 text-[#8c948b]">{t("empty")}</li>}
					{locks.map((l) => (
						<li key={l.id} className="fs-card flex flex-wrap items-center gap-x-14 gap-y-6 p-12 text-13">
							<span className="font-medium text-[#f1f4ee]">{l.from} – {l.to}</span>
							<span className="text-12 text-[#8c948b]">{l.lockedByName} · {date(l.lockedAt)}</span>
							{l.reopenedAt ? <span className="text-12 text-[#F4A100]">{t("closeReopened", { reason: l.reopenReason })}</span> : <span className="fs-chip h-22 px-8 text-10 text-[#c6ff4d]">{t("closeLocked")}</span>}
							{!l.reopenedAt && reviewer && (
								<button type="button" disabled={busy} className="ml-auto flex items-center gap-4 text-12 text-[#F4A100] hover:underline" onClick={() => { const reason = window.prompt(t("closeReopenReason")); if (reason) void act(() => apiCall("/api/review/periods", "POST", { action: "reopen", id: l.id, reason }), t("closeReopenDone")); }}>
									<TbLockOpen size={14} /> {t("closeReopen")}
								</button>
							)}
						</li>
					))}
				</ul>
			</section>

			<section>
				<h3 className="mb-8 text-14 font-semibold text-[#f1f4ee]">{t("reviewTitle")}</h3>
				{kinds.every(([, rows]) => rows.length === 0) && <p className="text-12 text-[#8c948b]">{t("reviewEmpty")}</p>}
				{kinds.map(([kind, rows]) => rows.length > 0 && (
					<div key={kind} className="mb-12">
						<div className="mb-6 flex items-center justify-between">
							<p className="text-12 text-[#8c948b]">{t(`review_${kind}`)}</p>
							{reviewer && <button type="button" disabled={busy} className="text-12 text-[#c6ff4d] hover:underline" onClick={() => void act(() => apiCall("/api/review/bulk", "POST", { kind, ids: rows.filter((r) => r.review?.status === "needs_review").map((r) => r.id) }), t("reviewApproved"))}>{t("reviewApproveAll")}</button>}
						</div>
						<ul className="flex flex-col gap-6">
							{rows.map((r) => (
								<li key={r.id} className="fs-card flex flex-wrap items-center gap-x-14 gap-y-4 p-12 text-13">
									<span className="font-medium text-[#f1f4ee]">{r.title}</span><span className="text-[#8c948b]">{r.party} · {r.date}</span>
									<span className={`fs-chip h-22 px-8 text-10 ${r.review?.status === "needs_fix" ? "text-[#ff9f9f]" : "text-[#F4A100]"}`}>{t(`reviewStatus_${r.review?.status ?? "needs_review"}` as never)}</span>
									{reviewer && (
										<span className="ml-auto flex gap-12 text-12">
											<button type="button" className="text-[#c6ff4d] hover:underline" onClick={() => void act(() => apiCall(`/api/review/${kind}/${r.id}`, "PATCH", { status: "approved" }), t("reviewApproved"))}>{t("reviewApprove")}</button>
											<button type="button" className="text-[#ff9f9f] hover:underline" onClick={() => { const note = window.prompt(t("reviewFixNote")) ?? ""; void act(() => apiCall(`/api/review/${kind}/${r.id}`, "PATCH", { status: "needs_fix", note }), t("reviewReturned")); }}>{t("reviewReturn")}</button>
										</span>
									)}
								</li>
							))}
						</ul>
					</div>
				))}
			</section>

			<section>
				<h3 className="mb-8 text-14 font-semibold text-[#f1f4ee]">{t("requestsTitle")}</h3>
				{reviewer && (
					<div className="mb-12 flex flex-wrap gap-10">
						<input className="fs-field h-40 min-w-[260px] flex-1 px-12 text-13 outline-none" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("requestsPlaceholder")} maxLength={200} />
						<button type="button" disabled={busy || subject.trim().length < 3} onClick={() => void act(() => apiCall("/api/review/requests", "POST", { subject }), t("requestsSent"))} className="fs-btn fs-btn-ghost h-40 disabled:opacity-50">{t("requestsSend")}</button>
					</div>
				)}
				<ul className="flex flex-col gap-8">
					{requests.length === 0 && <li className="text-12 text-[#8c948b]">{t("empty")}</li>}
					{requests.map((r) => (
						<li key={r.id} className="fs-card p-12 text-13">
							<div className="flex flex-wrap items-center gap-x-12 gap-y-4"><span className="font-medium text-[#f1f4ee]">{r.subject}</span><span className="text-12 text-[#8c948b]">{r.createdName} · {date(r.createdAt)}</span><span className="fs-chip h-22 px-8 text-10">{t(`requestsStatus_${r.status}` as never)}</span></div>
							{r.status === "answered" && <p className="mt-6 text-12 text-[#cfd4cb]">{r.answer}</p>}
							{r.status === "open" && (
								<div className="mt-8 flex flex-wrap gap-10">
									<input className="fs-field h-36 min-w-[240px] flex-1 px-12 text-13 outline-none" value={answers[r.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [r.id]: e.target.value })} placeholder={t("requestsAnswer")} maxLength={500} />
									<button type="button" disabled={busy || !(answers[r.id] ?? "").trim()} className="fs-btn fs-btn-primary h-36 disabled:opacity-50" onClick={() => void act(() => apiCall(`/api/review/requests/${r.id}`, "PATCH", { answer: answers[r.id] }), t("requestsAnswered"))}>{t("requestsReply")}</button>
									<button type="button" disabled={busy} className="text-12 text-[#ff9f9f] hover:underline" onClick={() => void act(() => apiCall(`/api/review/requests/${r.id}`, "PATCH", { cancel: true }), t("requestsCancelled"))}>{t("cancel")}</button>
								</div>
							)}
						</li>
					))}
				</ul>
			</section>
		</div>
	);
}
