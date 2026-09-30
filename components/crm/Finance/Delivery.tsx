"use client";
import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbExternalLink, TbPrinter, TbRefresh, TbTrash } from "react-icons/tb";
import ConfirmDialog from "../shared/ConfirmDialog";
import Modal from "../shared/Modal";
import { apiCall } from "@/store/crmApi";
import { money } from "./format";

// Доставка (Украина): отправления «Новою Поштою» и Укрпоштою — одним списком по заказам.
// Здесь всё, что происходит после оплаты: печать маркировки и накладной, расчёт стоимости,
// статусы, возврат/перенаправление у Новой Пошты и создание/отмена отправления у Укрпошты.
//
// Создание ТТН остаётся в карточке заказа (окно ТТН): там видно позиции и сумму заказа.

interface OrderRow {
	id: string;
	number: string;
	customerName: string;
	currency: string;
	waybill?: { number?: string; ref?: string; status?: string; statusAt?: string; cost?: number; city?: string; warehouse?: string; street?: string; house?: string; flat?: string; recipient?: string; returnNumber?: string };
	ukrposhta?: { uuid?: string; barcode?: string; status?: string; postOffice?: string };
}

interface UaState { connected: boolean; counterparty: { uuid: string; name: string } | null; addresses: Array<{ id: string; name: string; postcode?: string }> }

export default function Delivery() {
	const t = useTranslations("finance");
	const locale = useLocale();
	const [orders, setOrders] = useState<OrderRow[]>([]);
	const [npConnected, setNpConnected] = useState<boolean | null>(null);
	const [upState, setUpState] = useState<UaState | null>(null);
	const [busy, setBusy] = useState("");
	const [removeFor, setRemoveFor] = useState<OrderRow | null>(null);
	const [returnFor, setReturnFor] = useState<OrderRow | null>(null);

	const load = useCallback(async () => {
		const [ordersRes, npRes, upRes] = await Promise.all([
			apiCall<OrderRow[]>("/api/orders"),
			apiCall<{ connected: boolean }>("/api/novaposhta"),
			apiCall<UaState>("/api/ukrposhta").catch(() => null as never),
		]);
		if (ordersRes.ok && ordersRes.data) setOrders(ordersRes.data);
		setNpConnected(npRes.ok ? !!npRes.data?.connected : false);
		setUpState(upRes && (upRes as { ok: boolean }).ok ? ((upRes as { data: UaState }).data ?? null) : null);
	}, []);
	useEffect(() => { void load(); }, [load]);

	const withWaybill = orders.filter((o) => o.waybill?.number);
	const withUkrposhta = orders.filter((o) => o.ukrposhta?.barcode);

	async function refreshStatus(order: OrderRow, provider: "np" | "up") {
		setBusy(order.id + provider);
		const res = provider === "np" ? await apiCall(`/api/orders/${order.id}/waybill`, "GET") : await apiCall(`/api/orders/${order.id}/ukrposhta`, "POST", {});
		setBusy("");
		if (!res.ok) return void toast.error(res.message);
		void load();
	}

	async function removeWaybill(order: OrderRow) {
		setRemoveFor(null);
		setBusy(order.id + "del");
		const res = await apiCall(`/api/orders/${order.id}/waybill`, "DELETE");
		setBusy("");
		if (!res.ok) return void toast.error(res.message);
		toast.success(t("npDeleted"));
		void load();
	}

	async function cancelUkrposhta(order: OrderRow) {
		setBusy(order.id + "updel");
		const res = await apiCall(`/api/orders/${order.id}/ukrposhta`, "DELETE");
		setBusy("");
		if (!res.ok) return void toast.error(res.message);
		toast.success(t("upCancelled"));
		void load();
	}

	const addressOf = (o: OrderRow) =>
		o.waybill?.street ? `${o.waybill.street} ${o.waybill.house}${o.waybill.flat ? `, кв. ${o.waybill.flat}` : ""}` : [o.waybill?.city, o.waybill?.warehouse].filter(Boolean).join(" · ");

	return (
		<div className="flex flex-col gap-16">
			<h2 className="text-16 font-semibold text-[#f1f4ee]">{t("deliveryTitle")}</h2>

			{/* Нова Пошта: маркировка, накладная, стоимость, статусы, возврат */}
			<div className="fs-card p-16 md:p-20">
				<div className="mb-12 flex flex-wrap items-center justify-between gap-10">
					<p className="text-14 font-semibold text-[#f1f4ee]">{t("deliveryNpTitle")}</p>
					{npConnected === false && <span className="rounded-8 border border-inkLine px-10 py-5 text-12 text-[#F4A100]">{t("deliveryNpNotConnected")}</span>}
				</div>
				{withWaybill.length === 0 ? (
					<p className="text-12 text-[#8c948b]">{t("deliveryNpEmpty")}</p>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full min-w-[760px] text-12">
							<thead>
								<tr className="text-left text-11 uppercase tracking-[0.06em] text-[#8c948b]">
									<th className="pb-8 font-medium">{t("deliveryColOrder")}</th>
									<th className="pb-8 font-medium">ТТН</th>
									<th className="pb-8 font-medium">{t("deliveryColRecipient")}</th>
									<th className="pb-8 font-medium">{t("deliveryColStatus")}</th>
									<th className="pb-8 font-medium">{t("deliveryColCost")}</th>
									<th className="pb-8" />
								</tr>
							</thead>
							<tbody>
								{withWaybill.map((o) => (
									<tr key={o.id} className="border-t border-inkLine text-[#cfd4cb]">
										<td className="py-8 text-[#f1f4ee]">{o.number}<span className="ml-6 text-11 text-[#8c948b]">{o.customerName}</span></td>
										<td className="py-8">{o.waybill?.number}</td>
										<td className="py-8">{o.waybill?.recipient}<span className="ml-6 text-11 text-[#8c948b]">{addressOf(o)}</span></td>
										<td className="py-8">{o.waybill?.status || "—"}</td>
										<td className="py-8">{money(Number(o.waybill?.cost) || 0, "UAH", locale)}</td>
										<td className="py-8">
											<div className="flex items-center justify-end gap-6">
												<button type="button" disabled={busy !== ""} onClick={() => void refreshStatus(o, "np")} title={t("deliveryRefresh")} className="fs-btn fs-btn-ghost h-30 disabled:opacity-50">
													<TbRefresh size={13} />
												</button>
												<a href={`/api/orders/${o.id}/waybill/label?kind=marking`} target="_blank" rel="noreferrer" title={t("deliveryMarking")} className="fs-btn fs-btn-ghost inline-flex h-30 items-center">
													<TbPrinter size={13} />
												</a>
												<a href={`/api/orders/${o.id}/waybill/label?kind=document`} target="_blank" rel="noreferrer" title={t("deliveryDocument")} className="fs-btn fs-btn-ghost inline-flex h-30 items-center">
													<TbExternalLink size={13} />
												</a>
												{o.waybill?.returnNumber ? (
													<span className="text-11 text-[#2DDEB6]">{t("deliveryReturned", { number: o.waybill.returnNumber })}</span>
												) : (
													<button type="button" disabled={busy !== ""} onClick={() => setReturnFor(o)} className="fs-btn fs-btn-ghost h-30 disabled:opacity-50">
														{t("deliveryReturn")}
													</button>
												)}
												<button type="button" disabled={busy !== ""} onClick={() => setRemoveFor(o)} title={t("deliveryDelete")} className="fs-btn fs-btn-ghost h-30 text-[#ff9f9f] disabled:opacity-50">
													<TbTrash size={13} />
												</button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
				<p className="mt-10 text-11 text-[#9AA396]">{t("deliveryNpHint")}</p>
			</div>

			{/* Укрпошта: создание отправления, форма 100×100, статус, отмена */}
			<div className="fs-card p-16 md:p-20">
				<div className="mb-12 flex flex-wrap items-center justify-between gap-10">
					<p className="text-14 font-semibold text-[#f1f4ee]">{t("deliveryUpTitle")}</p>
					{!upState?.connected && <span className="rounded-8 border border-inkLine px-10 py-5 text-12 text-[#F4A100]">{t("deliveryUpNotConnected")}</span>}
				</div>
				{withUkrposhta.length === 0 ? (
					<p className="text-12 text-[#8c948b]">{t("deliveryUpEmpty")}</p>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full min-w-[640px] text-12">
							<thead>
								<tr className="text-left text-11 uppercase tracking-[0.06em] text-[#8c948b]">
									<th className="pb-8 font-medium">{t("deliveryColOrder")}</th>
									<th className="pb-8 font-medium">ШКІ</th>
									<th className="pb-8 font-medium">{t("deliveryColStatus")}</th>
									<th className="pb-8" />
								</tr>
							</thead>
							<tbody>
								{withUkrposhta.map((o) => (
									<tr key={o.id} className="border-t border-inkLine text-[#cfd4cb]">
										<td className="py-8 text-[#f1f4ee]">{o.number}<span className="ml-6 text-11 text-[#8c948b]">{o.customerName}</span></td>
										<td className="py-8">{o.ukrposhta?.barcode}</td>
										<td className="py-8">{o.ukrposhta?.status || "—"}</td>
										<td className="py-8">
											<div className="flex items-center justify-end gap-6">
												<button type="button" disabled={busy !== ""} onClick={() => void refreshStatus(o, "up")} title={t("deliveryRefresh")} className="fs-btn fs-btn-ghost h-30 disabled:opacity-50">
													<TbRefresh size={13} />
												</button>
												{o.ukrposhta?.uuid && (
													<a href={`/api/orders/${o.id}/ukrposhta/form`} target="_blank" rel="noreferrer" title={t("deliveryForm")} className="fs-btn fs-btn-ghost inline-flex h-30 items-center">
														<TbPrinter size={13} />
													</a>
												)}
												{o.ukrposhta?.uuid && (
													<button type="button" disabled={busy !== ""} onClick={() => void cancelUkrposhta(o)} title={t("upCancel")} className="fs-btn fs-btn-ghost h-30 text-[#ff9f9f] disabled:opacity-50">
														<TbTrash size={13} />
													</button>
												)}
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
				<p className="mt-12 text-11 text-[#9AA396]">{t("deliveryUpHint")}</p>
			</div>

			<ConfirmDialog
				open={!!removeFor}
				onCancel={() => setRemoveFor(null)}
				onConfirm={() => removeFor && void removeWaybill(removeFor)}
				title={t("deliveryDelete")}
				text={t("deliveryDeleteConfirm")}
				confirmLabel={t("deliveryDelete")}
			/>
			{returnFor && <ReturnDialog order={returnFor} onClose={() => setReturnFor(null)} onDone={() => { setReturnFor(null); void load(); }} />}
		</div>
	);
}

// Возврат/перенаправление: причины приходят от Новой Пошты по конкретной ТТН
function ReturnDialog({ order, onClose, onDone }: { order: OrderRow; onClose: () => void; onDone: () => void }) {
	const t = useTranslations("finance");
	const [state, setState] = useState<{ possible: boolean; reason?: string; reasons: Array<{ ref: string; name: string }> } | null>(null);
	const [reasonRef, setReasonRef] = useState("");
	const [type, setType] = useState<"Return" | "Redelivery">("Return");
	const [note, setNote] = useState("");
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		void apiCall<{ possible: boolean; reason?: string; reasons: Array<{ ref: string; name: string }> }>(`/api/orders/${order.id}/waybill/return`).then((res) => {
			if (res.ok && res.data) {
				setState(res.data);
				setReasonRef(res.data.reasons[0]?.ref ?? "");
			} else setState({ possible: false, reason: res.message, reasons: [] });
		});
	}, [order.id]);

	async function submit() {
		setBusy(true);
		const res = await apiCall(`/api/orders/${order.id}/waybill/return`, "POST", { reasonRef, type, note });
		setBusy(false);
		if (!res.ok) return void toast.error(res.message);
		toast.success(t("deliveryReturnDone"));
		onDone();
	}

	return (
		<Modal open onClose={onClose} label={t("deliveryReturn")} className="w-full max-w-[480px]">
			<div className="fs-popover flex flex-col gap-12 p-20">
				<h2 className="text-15 font-semibold text-[#f1f4ee]">{t("deliveryReturn")} · {order.waybill?.number}</h2>
				{!state ? (
					<p className="text-13 text-[#8c948b]">…</p>
				) : !state.possible ? (
					<p className="text-13 text-[#F4A100]">{state.reason || t("deliveryReturnNotPossible")}</p>
				) : (
					<>
						<label className="block">
							<span className="mb-6 block text-12 text-[#8c948b]">{t("deliveryReturnType")}</span>
							<select value={type} onChange={(e) => setType(e.target.value === "Redelivery" ? "Redelivery" : "Return")} className="fs-field h-40 w-full px-12 text-13 outline-none">
								<option value="Return">{t("deliveryReturnTypeReturn")}</option>
								<option value="Redelivery">{t("deliveryReturnTypeRedirect")}</option>
							</select>
						</label>
						<label className="block">
							<span className="mb-6 block text-12 text-[#8c948b]">{t("deliveryReturnReason")}</span>
							<select value={reasonRef} onChange={(e) => setReasonRef(e.target.value)} className="fs-field h-40 w-full px-12 text-13 outline-none">
								{state.reasons.map((r) => <option key={r.ref} value={r.ref}>{r.name}</option>)}
							</select>
						</label>
						<label className="block">
							<span className="mb-6 block text-12 text-[#8c948b]">{t("deliveryReturnNote")}</span>
							<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className="fs-field h-40 w-full px-12 text-13 outline-none" />
						</label>
					</>
				)}
				<div className="mt-4 flex justify-end gap-10">
					<button type="button" onClick={onClose} className="fs-btn fs-btn-ghost h-38">{t("cancel")}</button>
					<button type="button" disabled={busy || !state?.possible || !reasonRef} onClick={submit} className="fs-btn fs-btn-primary h-38 disabled:opacity-50">
						{t("deliveryReturn")}
					</button>
				</div>
			</div>
		</Modal>
	);
}
