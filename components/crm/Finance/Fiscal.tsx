"use client";
import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbAlertTriangle, TbCheck, TbExternalLink, TbReceipt, TbRefresh } from "react-icons/tb";
import ConfirmDialog from "../shared/ConfirmDialog";
import { apiCall } from "@/store/crmApi";
import { money } from "./format";

// ПРРО (Украина): чеки и смены кассы Checkbox. Чек по счёту пробивается здесь или сам при оплате
// картой (lib/finance/fiscal.ts, правило «нужен ли чек»); смена открывается первым чеком, а
// закрывается Z-отчётом — по нему видно итоги дня. Ошибочные чеки остаются в списке с текстом
// отказа: их видит бухгалтер, и они не теряются.

interface ReceiptRow {
	id: string;
	number: string;
	kind: string;
	customerName: string;
	status: string;
	currency: string;
	paidAmount: number;
	fiscalCode: string;
	fiscalUrl: string;
	fiscalAt: string;
	fiscalError: string;
	fiscalPayType: string;
	fiscalReturnCode: string;
	fiscalReturnUrl: string;
	fiscalReturnAt: string;
	fiscalReturnError: string;
	/** номер кредит-ноты, если по этому чеку был возврат: чек помечается «Повернено» */
	returnedBy: string;
	needed: boolean;
	reason: string;
}

interface FiscalState {
	connected: boolean;
	auto: boolean;
	shift: { open: { id: string } | null; recent: Array<{ id: string; openedAt: string | null; closedAt: string | null; receipts: number; turnover: number }> };
	receipts: ReceiptRow[];
}

export default function Fiscal() {
	const t = useTranslations("finance");
	const locale = useLocale();
	const [state, setState] = useState<FiscalState | null>(null);
	const [busy, setBusy] = useState("");
	const [confirmClose, setConfirmClose] = useState(false);
	const [payType, setPayType] = useState<Record<string, "CASH" | "CARD">>({});

	const load = useCallback(async () => {
		const res = await apiCall<FiscalState>("/api/finance/fiscal");
		if (res.ok && res.data) setState(res.data);
	}, []);
	useEffect(() => { void load(); }, [load]);

	async function shiftAction(action: "open" | "close") {
		setBusy(action);
		const res = await apiCall<{ receipts?: number; turnover?: number }>("/api/finance/fiscal", "POST", { action });
		setBusy("");
		if (!res.ok) return void toast.error(res.message);
		if (action === "close") toast.success(t("fiscalShiftClosed", { receipts: res.data?.receipts ?? 0, turnover: res.data?.turnover ?? 0 }));
		else toast.success(t("fiscalShiftOpened"));
		void load();
	}

	// Ссылка на чек не сохранилась (старый чек или ответ Checkbox без tax_url) — дотягиваем её
	// у провайдера: по ссылке чек открывают, скачивают и печатают
	async function fetchLink(row: ReceiptRow, which: "sale" | "return") {
		setBusy(row.id + "link" + which);
		const res = await apiCall<{ url: string; returnUrl: string }>(`/api/invoices/${row.id}/fiscal`, "POST", { action: "receipt-link" });
		setBusy("");
		if (!res.ok || !res.data) return void toast.error(res.message || t("fiscalLinkFailed"));
		const url = which === "sale" ? res.data.url : res.data.returnUrl;
		if (url) window.open(url, "_blank", "noopener");
		else toast.error(t("fiscalLinkFailed"));
		void load();
	}

	async function fire(row: ReceiptRow, action?: "return") {
		setBusy(row.id + (action ?? ""));
		const res = await apiCall(`/api/invoices/${row.id}/fiscal`, "POST", action === "return" ? { action: "return" } : { payType: payType[row.id] ?? (row.needed ? "CARD" : "CASH") });
		setBusy("");
		if (!res.ok) {
			toast.error(res.message || t("fiscalFailed"));
			void load();
			return;
		}
		toast.success(action === "return" ? t("fiscalReturnDone") : t("fiscalIssued"));
		void load();
	}

	const fmt = (iso: string) => (iso ? new Date(iso).toLocaleString(locale === "ua" ? "uk-UA" : locale === "de" ? "de-DE" : "en-GB") : "");

	if (!state) return <p className="text-13 text-[#8c948b]">{t("loading")}</p>;

	if (!state.connected) {
		return (
			<div className="fs-card max-w-[640px] p-16 md:p-20">
				<h2 className="text-15 font-semibold text-[#f1f4ee]">{t("fiscalTitle")}</h2>
				<p className="mt-8 text-13 leading-[1.6] text-[#8c948b]">{t("fiscalNotConnected")}</p>
				<p className="mt-6 text-12 text-[#9AA396]">{t("fiscalConnectHint")}</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-16">
			<div className="flex flex-wrap items-center justify-between gap-10">
				<h2 className="text-16 font-semibold text-[#f1f4ee]">{t("fiscalTitle")}</h2>
				<div className="flex items-center gap-10">
					{state.auto ? (
						<span className="inline-flex items-center gap-6 rounded-8 border border-[rgba(198,255,77,0.35)] bg-[rgba(198,255,77,0.10)] px-10 py-5 text-12 text-[#c6ff4d]">
							<TbCheck size={13} /> {t("fiscalAutoOn")}
						</span>
					) : (
						<span className="rounded-8 border border-inkLine px-10 py-5 text-12 text-[#9AA396]">{t("fiscalAutoOff")}</span>
					)}
				</div>
			</div>

			{/* Смена: открытие, закрытие Z-отчётом и последние закрытые смены */}
			<div className="fs-card p-16 md:p-20">
				<div className="flex flex-wrap items-center justify-between gap-10">
					<div>
						<p className="text-13 font-medium text-[#f1f4ee]">{state.shift.open ? t("fiscalShiftOpen", { id: state.shift.open.id.slice(0, 8) }) : t("fiscalShiftClosedState")}</p>
						<p className="mt-4 text-12 text-[#8c948b]">{t("fiscalShiftHint")}</p>
					</div>
					<div className="flex gap-10">
						{!state.shift.open && (
							<button type="button" disabled={busy !== ""} onClick={() => void shiftAction("open")} className="fs-btn fs-btn-ghost h-36 disabled:opacity-50">
								<TbReceipt size={14} /> {t("fiscalOpenShift")}
							</button>
						)}
						{state.shift.open && (
							<button type="button" disabled={busy !== ""} onClick={() => setConfirmClose(true)} className="fs-btn fs-btn-primary h-36 disabled:opacity-50">
								<TbRefresh size={14} /> {t("fiscalCloseShift")}
							</button>
						)}
					</div>
				</div>
				{state.shift.recent.length > 0 && (
					<div className="mt-14 overflow-x-auto">
						<table className="w-full min-w-[420px] text-12">
							<thead>
								<tr className="text-left text-11 uppercase tracking-[0.06em] text-[#8c948b]">
									<th className="pb-6 font-medium">{t("fiscalShiftClosedAt")}</th>
									<th className="pb-6 font-medium">{t("fiscalReceiptsCount")}</th>
									<th className="pb-6 text-right font-medium">{t("fiscalTurnover")}</th>
								</tr>
							</thead>
							<tbody>
								{state.shift.recent.slice(0, 5).map((s) => (
									<tr key={s.id} className="border-t border-inkLine text-[#cfd4cb]">
										<td className="py-6">{fmt(s.closedAt ?? "")}</td>
										<td className="py-6">{s.receipts}</td>
										<td className="py-6 text-right">{money(s.turnover, "UAH", locale)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{/* Чеки: продажи, возвраты и ошибки — одной лентой */}
			<div className="fs-card overflow-x-auto p-16 md:p-20">
				<p className="mb-12 text-13 font-medium text-[#f1f4ee]">{t("fiscalReceipts")}</p>
				{state.receipts.length === 0 ? (
					<p className="text-12 text-[#8c948b]">{t("fiscalEmpty")}</p>
				) : (
					<table className="w-full min-w-[720px] text-12">
						<thead>
							<tr className="text-left text-11 uppercase tracking-[0.06em] text-[#8c948b]">
								<th className="pb-8 font-medium">{t("fiscalColInvoice")}</th>
								<th className="pb-8 font-medium">{t("fiscalColAmount")}</th>
								<th className="pb-8 font-medium">{t("fiscalColPayType")}</th>
								<th className="pb-8 font-medium">{t("fiscalColReceipt")}</th>
								<th className="pb-8 font-medium">{t("fiscalColDate")}</th>
								<th className="pb-8" />
							</tr>
						</thead>
						<tbody>
							{state.receipts.map((row) => (
								<tr key={row.id} className="border-t border-inkLine align-top text-[#cfd4cb]">
									<td className="py-8">
										<span className="text-[#f1f4ee]">{row.number}</span>
										<span className="ml-6 text-11 text-[#8c948b]">{row.kind === "credit_note" ? t("creditNote") : row.customerName}</span>
									</td>
									<td className="py-8">{money(row.paidAmount, row.currency, locale)}</td>
									<td className="py-8">{row.fiscalPayType === "CASH" ? t("fiscalCash") : row.fiscalPayType === "CARD" ? t("fiscalCard") : "—"}</td>
									<td className="py-8">
										{row.fiscalCode ? (
											row.fiscalUrl ? (
												// Ссылка Checkbox: чек открывается на сайте налоговой — оттуда его скачивают и печатают
												<a href={row.fiscalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-4 text-[#c6ff4d] hover:underline" title={t("fiscalOpenHint")}>
													{row.fiscalCode} <TbExternalLink size={12} />
												</a>
											) : (
												<span className="inline-flex flex-wrap items-center gap-6 text-[#cfd4cb]">
													{row.fiscalCode}
													<button type="button" disabled={busy !== ""} onClick={() => void fetchLink(row, "sale")} className="text-11 text-[#c6ff4d] hover:underline disabled:opacity-50">
														{t("fiscalReceiptLink")}
													</button>
												</span>
											)
										) : row.fiscalError ? (
											<span className="inline-flex items-center gap-4 text-[#F4A100]"><TbAlertTriangle size={12} /> {row.fiscalError}</span>
										) : (
											<span className="text-[#9AA396]">{row.needed ? t("fiscalNeeded") : t("fiscalOptional")}</span>
										)}
										{/* Проданный чек с возвратом: отметка, чтобы в списке было видно, что товар вернули */}
										{row.returnedBy && row.kind === "invoice" && (
											<p className="mt-4 text-11 text-[#EB5757]">{t("fiscalReturnedChip", { number: row.returnedBy })}</p>
										)}
										{row.fiscalReturnCode && (
											<p className="mt-4 text-11 text-[#2DDEB6]">
												{row.fiscalReturnUrl ? (
													<a href={row.fiscalReturnUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-4 hover:underline" title={t("fiscalOpenHint")}>
														{t("fiscalReturnChip", { code: row.fiscalReturnCode })} <TbExternalLink size={11} />
													</a>
												) : (
													<span className="inline-flex flex-wrap items-center gap-6">
														{t("fiscalReturnChip", { code: row.fiscalReturnCode })}
														<button type="button" disabled={busy !== ""} onClick={() => void fetchLink(row, "return")} className="text-[#c6ff4d] hover:underline disabled:opacity-50">
															{t("fiscalReceiptLink")}
														</button>
													</span>
												)}
											</p>
										)}
										{row.fiscalReturnError && <p className="mt-4 text-11 text-[#F4A100]">{row.fiscalReturnError}</p>}
									</td>
									<td className="py-8 text-[#8c948b]">{fmt(row.fiscalAt || row.fiscalReturnAt)}</td>
									<td className="py-8 text-right">
										{!row.fiscalCode && (
											<div className="flex items-center justify-end gap-8">
												<select
													value={payType[row.id] ?? (row.needed ? "CARD" : "CASH")}
													onChange={(e) => setPayType((p) => ({ ...p, [row.id]: e.target.value as "CASH" | "CARD" }))}
													className="fs-field h-30 px-8 text-12">
													<option value="CARD">{t("fiscalCard")}</option>
													<option value="CASH">{t("fiscalCash")}</option>
												</select>
												<button type="button" disabled={busy !== ""} onClick={() => void fire(row)} className="fs-btn fs-btn-ghost h-30 disabled:opacity-50">
													{t("fiscalIssue")}
												</button>
											</div>
										)}
										{row.fiscalCode && row.kind === "credit_note" && !row.fiscalReturnCode && (
											<button type="button" disabled={busy !== ""} onClick={() => void fire(row, "return")} className="fs-btn fs-btn-ghost h-30 disabled:opacity-50">
												{t("fiscalReturn")}
											</button>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
				<p className="mt-12 text-11 text-[#9AA396]">{t("fiscalRuleHint")}</p>
			</div>

			<ConfirmDialog
				open={confirmClose}
				onCancel={() => setConfirmClose(false)}
				onConfirm={() => { setConfirmClose(false); void shiftAction("close"); }}
				title={t("fiscalCloseShift")}
				text={t("fiscalCloseConfirm")}
				confirmLabel={t("fiscalCloseShift")}
			/>
		</div>
	);
}
