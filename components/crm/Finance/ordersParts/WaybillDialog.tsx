"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbRefresh } from "react-icons/tb";
import { apiCall } from "@/store/crmApi";
import Modal from "../../shared/Modal";
import FormField from "../../shared/FormField";

// ТТН «Нової Пошти» по заказу: выбираем город и отделение получателя (справочники подтягиваются
// с сервера по ключу фирмы), заполняем получателя и параметры посылки. Номер ТТН сохраняется
// в заказе — его называют клиенту, по нему же виден статус посылки.

interface City { ref: string; name: string; area: string }
interface Warehouse { ref: string; name: string; number: string }

export default function WaybillDialog({
	orderId,
	customer,
	phone,
	amount,
	open,
	onClose,
	onCreated,
}: {
	orderId: string;
	customer: string;
	phone: string;
	amount: number;
	open: boolean;
	onClose: () => void;
	onCreated: () => void;
}) {
	const t = useTranslations("finance");
	const [query, setQuery] = useState("");
	const [cities, setCities] = useState<City[] | null>(null);
	const [city, setCity] = useState<City | null>(null);
	const [warehouses, setWarehouses] = useState<Warehouse[] | null>(null);
	const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
	const [recipient, setRecipient] = useState(customer);
	const [recipientPhone, setRecipientPhone] = useState(phone);
	const [weight, setWeight] = useState("1");
	const [cod, setCod] = useState("0");
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (!open) return;
		setQuery("");
		setCities(null);
		setCity(null);
		setWarehouses(null);
		setWarehouse(null);
		setRecipient(customer);
		setRecipientPhone(phone);
		setWeight("1");
		setCod(String(Math.round(amount) || 0));
	}, [open, customer, phone, amount]);

	useEffect(() => {
		if (!open || query.trim().length < 2) { setCities(null); return; }
		let alive = true;
		const timer = window.setTimeout(async () => {
			const res = await apiCall<{ cities: City[] }>(`/api/novaposhta/cities?q=${encodeURIComponent(query.trim())}`);
			if (alive) setCities(res.ok ? res.data?.cities ?? [] : []);
		}, 350);
		return () => { alive = false; window.clearTimeout(timer); };
	}, [query, open]);

	async function pickCity(next: City) {
		setCity(next);
		setWarehouse(null);
		setWarehouses(null);
		const res = await apiCall<{ warehouses: Warehouse[] }>(`/api/novaposhta/cities?city=${encodeURIComponent(next.ref)}`);
		setWarehouses(res.ok ? res.data?.warehouses ?? [] : []);
	}

	async function submit() {
		if (!city) return void toast.error(t("npPickCity"));
		if (!warehouse) return void toast.error(t("npWarehouse"));
		if (!recipient.trim()) return void toast.error(t("npRecipient"));
		setBusy(true);
		const res = await apiCall<{ order: unknown }>(`/api/orders/${orderId}/waybill`, "POST", {
			cityRef: city.ref,
			cityName: city.name,
			warehouseRef: warehouse.ref,
			warehouseName: warehouse.name,
			recipient: recipient.trim(),
			phone: recipientPhone.trim(),
			weight: Number(weight) || 1,
			cost: Math.round(amount) || 1,
			cod: Number(cod) || 0,
		});
		setBusy(false);
		if (!res.ok) return void toast.error(res.message);
		toast.success(t("npCreated", { number: ((res.data?.order as { waybill?: { number?: string } })?.waybill?.number) ?? "" }));
		onCreated();
		onClose();
	}

	return (
		<Modal open={open} onClose={onClose} label={t("npWaybillTitle")} className="w-full max-w-[560px]">
			<div className="fs-popover flex max-h-[calc(100dvh-32px)] flex-col p-20">
				<h2 className="mb-14 text-16 font-semibold text-[#f1f4ee]">{t("npWaybillTitle")}</h2>

				<div className="fs-scroll min-h-0 flex-1 overflow-y-auto pr-4">
					<label className="mb-12 block">
						<span className="mb-6 block text-12 text-[#8c948b]">{t("npCity")}</span>
						<input value={city ? `${city.name}${city.area ? ` · ${city.area}` : ""}` : query} onChange={(e) => { setCity(null); setQuery(e.target.value); }} placeholder={t("npSearchCity")} className="fs-field h-40 w-full px-12 text-13 outline-none" />
					</label>
					{!city && cities && (
						<ul className="mb-12 max-h-[180px] overflow-y-auto rounded-10 border border-inkLineSoft">
							{cities.length === 0 ? (
								<li className="px-12 py-10 text-13 text-[#8c948b]">{t("npNoCities")}</li>
							) : cities.map((c) => (
								<li key={c.ref}>
									<button type="button" onClick={() => void pickCity(c)} className="w-full px-12 py-9 text-left text-13 text-[#f1f4ee] transition-colors hover:bg-[rgba(255,255,255,0.04)]">
										{c.name}{c.area ? <span className="text-[#8c948b]"> · {c.area}</span> : null}
									</button>
								</li>
							))}
						</ul>
					)}

					{city && (
						<label className="mb-12 block">
							<span className="mb-6 block text-12 text-[#8c948b]">{t("npWarehouse")}</span>
							{warehouses === null ? (
								<p className="text-13 text-[#8c948b]">…</p>
							) : (
								<select value={warehouse?.ref ?? ""} onChange={(e) => setWarehouse(warehouses.find((w) => w.ref === e.target.value) ?? null)} className="fs-field h-40 w-full px-12 text-13 outline-none">
									<option value="">—</option>
									{warehouses.map((w) => <option key={w.ref} value={w.ref}>{w.name}</option>)}
								</select>
							)}
						</label>
					)}

					<div className="mb-12 grid grid-cols-1 gap-12 md:grid-cols-2">
						<FormField label={t("npRecipient")} value={recipient} onChange={(e) => setRecipient(e.target.value)} maxLength={100} />
						<FormField label={t("npPhone")} value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} maxLength={20} />
					</div>
					<div className="grid grid-cols-1 gap-12 md:grid-cols-3">
						<FormField label={t("npWeight")} value={weight} onChange={(e) => setWeight(e.target.value.replace(/[^\d.]/g, ""))} maxLength={6} />
						<FormField label={t("npCod")} value={cod} onChange={(e) => setCod(e.target.value.replace(/[^\d]/g, ""))} maxLength={10} />
					</div>
					<p className="mt-10 flex items-start gap-8 text-11 leading-[1.5] text-[#9AA396]">
						<TbRefresh size={13} className="mt-[2px] shrink-0" aria-hidden />
						{t("npCodHint")}
					</p>
				</div>

				<div className="mt-16 flex items-center justify-end gap-10">
					<button type="button" onClick={onClose} className="fs-btn fs-btn-ghost h-38">{t("cancel")}</button>
					<button type="button" onClick={submit} disabled={busy} className="fs-btn fs-btn-primary h-38 disabled:opacity-60">{busy ? "…" : t("npCreate")}</button>
				</div>
			</div>
		</Modal>
	);
}
