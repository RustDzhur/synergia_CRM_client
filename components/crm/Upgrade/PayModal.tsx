"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbBuildingBank, TbCopy, TbCurrencyDollar, TbDownload } from "react-icons/tb";
import { apiCall, authHeaders } from "@/store/crmApi";
import type { PlanId } from "@/config/plans";
import Modal from "../shared/Modal";

export interface OrderView {
	order: { id: string; number: string; plan: string; interval: string; method: "bank" | "usdt"; amount: number; usdtAmount: number; currency: string; status: "new" | "claimed" | "paid" | "cancelled" };
	seller: { name: string; address: string; taxId: string; note: string };
	lines: { label: string; value: string }[];
	payTo: string;
	qr: string;
}

interface Props {
	open: boolean;
	onClose: () => void;
	plan: Exclude<PlanId, "free"> | null;
	interval: "month" | "year";
	/** способы, которые настроил администратор платформы */
	methods: { bank: boolean; usdt: boolean };
	/** уже оформленный счёт (из списка «неоплаченные») — открывается сразу на реквизитах */
	orderId?: string | null;
	onChanged: () => void;
}

// Оплата тарифа переводом: выбор способа (банк / USDT) → оформленный счёт с реквизитами и QR-кодом → «Я оплатил».
// Страна и валюта подставляются сами (Германия — евро, Украина — гривна), деньги идут напрямую на реквизиты платформы.
export default function PayModal({ open, onClose, plan, interval, methods, orderId, onChanged }: Props) {
	const t = useTranslations("upgrade");
	const locale = useLocale();
	const [view, setView] = useState<OrderView | null>(null);
	const [method, setMethod] = useState<"bank" | "usdt">("bank");
	const [company, setCompany] = useState("");
	const [vatId, setVatId] = useState("");
	const [payerRef, setPayerRef] = useState("");
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (!open) return;
		setView(null);
		setPayerRef("");
		setMethod(methods.bank ? "bank" : "usdt");
		if (orderId) apiCall<OrderView>(`/api/billing/transfer/${orderId}`).then((r) => r.data && setView(r.data));
	}, [open, orderId, methods.bank]);

	async function create(e: React.FormEvent) {
		e.preventDefault();
		if (busy || !plan) return;
		setBusy(true);
		const res = await apiCall<OrderView>("/api/billing/transfer", "POST", { plan, interval, method, company, vatId, locale });
		setBusy(false);
		if (res.ok && res.data) {
			setView(res.data);
			onChanged();
		} else toast.error(res.status === 503 ? t("methodUnavailable") : res.message || t("checkoutFailed"));
	}

	async function claim() {
		if (busy || !view) return;
		setBusy(true);
		const res = await apiCall<OrderView>(`/api/billing/transfer/${view.order.id}`, "POST", { payerRef });
		setBusy(false);
		if (res.ok && res.data) {
			setView(res.data);
			onChanged();
			toast.success(t("claimed"));
		} else toast.error(res.message);
	}

	async function pdf() {
		if (!view) return;
		const r = await fetch(`/api/billing/transfer/${view.order.id}/pdf`, { headers: authHeaders(false) });
		if (!r.ok) return void toast.error(t("checkoutFailed"));
		const url = URL.createObjectURL(await r.blob());
		const a = document.createElement("a");
		a.href = url;
		a.download = `${view.order.number}.pdf`;
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 5000);
	}

	const copy = (v: string) => navigator.clipboard?.writeText(v).then(() => toast.success(t("copied")), () => undefined);
	const seg = (on: boolean) => `flex flex-1 items-center justify-center gap-8 rounded-10 border px-12 py-12 text-13 font-medium transition-colors ${on ? "border-[#c6ff4d] bg-[rgba(198,255,77,0.06)] text-[#c6ff4d]" : "border-inkLine text-[#8c948b] hover:text-[#f1f4ee]"}`;

	return (
		<Modal open={open} onClose={onClose} label={t("payTitle")} className="w-full max-w-[520px]">
			<div className="fs-popover fs-scroll max-h-[88vh] overflow-y-auto p-20">
				<h2 className="mb-8 text-16 font-semibold text-[#f1f4ee]">{view ? `${t("invoiceNo")} ${view.order.number}` : t("payTitle")}</h2>

				{!view && (
					<form onSubmit={create} className="flex flex-col gap-12">
						<p className="text-13 text-[#8c948b]">{t("payText")}</p>
						<div className="flex gap-8" role="radiogroup" aria-label={t("payTitle")}>
							{methods.bank && <button type="button" role="radio" aria-checked={method === "bank"} onClick={() => setMethod("bank")} className={seg(method === "bank")}><TbBuildingBank size={18} aria-hidden />{t("viaBank")}</button>}
							{methods.usdt && <button type="button" role="radio" aria-checked={method === "usdt"} onClick={() => setMethod("usdt")} className={seg(method === "usdt")}><TbCurrencyDollar size={18} aria-hidden />USDT</button>}
						</div>
						<textarea required value={company} onChange={(e) => setCompany(e.target.value)} maxLength={200} rows={3} placeholder={t("invoiceCompany")} aria-label={t("invoiceCompany")} className="fs-field fs-scroll w-full p-10 text-13 outline-none" />
						<input value={vatId} onChange={(e) => setVatId(e.target.value)} maxLength={40} placeholder={t("invoiceVat")} aria-label={t("invoiceVat")} className="fs-field h-40 px-12 text-13 outline-none" />
						<div className="mt-4 flex justify-end gap-12">
							<button type="button" onClick={onClose} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
							<button type="submit" disabled={busy || (!methods.bank && !methods.usdt)} className="fs-btn fs-btn-primary h-40 disabled:opacity-60">{busy ? "…" : t("makeInvoice")}</button>
						</div>
					</form>
				)}

				{view && (
					<div className="flex flex-col gap-14">
						<p className="text-13 text-[#8c948b]">{view.order.method === "usdt" ? t("usdtText") : t("bankText")}</p>
						<p className="text-22 font-bold text-[#c6ff4d]">{view.payTo}</p>
						<div className="flex flex-col items-center gap-12 sm:flex-row sm:items-start">
							{/* SVG собирает сервер из матрицы QR (lib/transferPay.ts qrSvg): в нём только фигуры, пользовательского текста нет */}
							<div className="h-[168px] w-[168px] shrink-0 overflow-hidden rounded-10 bg-white p-6" role="img" aria-label="QR" dangerouslySetInnerHTML={{ __html: view.qr }} />
							<dl className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] gap-x-10 gap-y-6 text-12">
								{view.lines.map((l, i) =>
									l.label ? (
										<div key={i} className="contents">
											<dt className="text-[#8c948b]">{l.label}</dt>
											<dd className="flex min-w-0 items-start gap-6 break-all text-[#f1f4ee]">
												{l.value}
												<button type="button" onClick={() => copy(l.value)} aria-label={t("copy")} title={t("copy")} className="shrink-0 text-[#8c948b] hover:text-[#c6ff4d]"><TbCopy size={14} aria-hidden /></button>
											</dd>
										</div>
									) : (
										<p key={i} className="col-span-2 text-[#F4A100]">{l.value}</p>
									)
								)}
							</dl>
						</div>
						<button type="button" onClick={pdf} className="fs-btn fs-btn-ghost h-38 self-start"><TbDownload size={16} aria-hidden />{t("downloadPdf")}</button>

						{view.order.status === "claimed" || view.order.status === "paid" ? (
							<p role="status" className="rounded-10 bg-[rgba(198,255,77,0.08)] px-14 py-10 text-13 text-[#c6ff4d]">{view.order.status === "paid" ? t("paidDone") : t("claimed")}</p>
						) : (
							<div className="flex flex-col gap-8 border-t border-inkLine pt-14">
								<input value={payerRef} onChange={(e) => setPayerRef(e.target.value)} maxLength={300} placeholder={view.order.method === "usdt" ? t("payerRefUsdt") : t("payerRefBank")} aria-label={t("payerRefBank")} className="fs-field h-40 px-12 text-13 outline-none" />
								<button type="button" onClick={claim} disabled={busy} className="fs-btn fs-btn-primary h-40 disabled:opacity-60">{busy ? "…" : t("iPaid")}</button>
								<p className="text-11 text-[#9AA396]">{t("iPaidHint")}</p>
							</div>
						)}
						<div className="flex justify-end"><button type="button" onClick={onClose} className="fs-btn fs-btn-ghost h-36">{t("close")}</button></div>
					</div>
				)}
			</div>
		</Modal>
	);
}
