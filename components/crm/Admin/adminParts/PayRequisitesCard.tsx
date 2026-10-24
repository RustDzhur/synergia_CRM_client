"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { apiCall } from "@/store/crmApi";
import { cardClass, inputClass } from "./model";

interface Req {
	de: { name: string; address: string; iban: string; bic: string; bank: string; vatId: string; vatNote: string };
	ua: { name: string; address: string; iban: string; bank: string; mfo: string; edrpou: string; vatNote: string };
	usdt: { address: string; network: string; perEur: number };
	uahPrices: Record<"standard" | "professional", { month: number; year: number }>;
}

// Реквизиты платформы для оплаты тарифов переводом: Германия (евро, IBAN), Украина (гривна, IBAN, ЄДРПОУ, цены в ₴) и кошелёк USDT (TRC-20).
// По ним клиенту выписывается счёт с QR-кодом; рынок клиента определяется по стране его фирмы.
export default function PayRequisitesCard() {
	const t = useTranslations("admin");
	const [open, setOpen] = useState(false);
	const [r, setR] = useState<Req | null>(null);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (!open || r) return;
		apiCall<Req>("/api/admin/pay-requisites").then((res) => res.data && setR(res.data));
	}, [open, r]);

	const set = (group: "de" | "ua" | "usdt", key: string, value: string | number) => setR((v) => (v ? ({ ...v, [group]: { ...v[group], [key]: value } } as Req) : v));
	const price = (plan: "standard" | "professional", key: "month" | "year", value: string) => setR((v) => (v ? { ...v, uahPrices: { ...v.uahPrices, [plan]: { ...v.uahPrices[plan], [key]: Number(value) || 0 } } } : v));

	async function save() {
		if (!r) return;
		setSaving(true);
		const res = await apiCall<Req>("/api/admin/pay-requisites", "PUT", r);
		setSaving(false);
		if (res.ok && res.data) { setR(res.data); toast.success(t("saved")); } else toast.error(res.message);
	}

	const field = (label: string, value: string | number, on: (v: string) => void, extra: { wide?: boolean; type?: string } = {}) => (
		<label className={`flex flex-col gap-4 text-11 text-[#8c948b] ${extra.wide ? "sm:col-span-2" : ""}`}>
			{label}
			<input value={value} type={extra.type ?? "text"} onChange={(e) => on(e.target.value)} className={`${inputClass} w-full`} />
		</label>
	);

	return (
		<div className={`${cardClass} mb-24`}>
			<button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-12 text-left">
				<span><span className="block text-14 font-medium text-[#f1f4ee]">{t("reqTitle")}</span><span className="block text-12 text-[#8c948b]">{t("reqHelp")}</span></span>
				<span className="text-12 text-[#c6ff4d]">{open ? t("reqHide") : t("reqShow")}</span>
			</button>
			{open && r && (
				<div className="mt-16 flex flex-col gap-20">
					<section>
						<h3 className="mb-8 text-13 font-semibold text-[#f1f4ee]">{t("reqDe")}</h3>
						<div className="grid gap-10 sm:grid-cols-2">
							{field(t("reqName"), r.de.name, (v) => set("de", "name", v))}
							{field(t("reqVatId"), r.de.vatId, (v) => set("de", "vatId", v))}
							{field(t("reqAddress"), r.de.address, (v) => set("de", "address", v), { wide: true })}
							{field("IBAN", r.de.iban, (v) => set("de", "iban", v))}
							{field("BIC", r.de.bic, (v) => set("de", "bic", v))}
							{field(t("reqBank"), r.de.bank, (v) => set("de", "bank", v))}
							{field(t("reqVatNote"), r.de.vatNote, (v) => set("de", "vatNote", v))}
						</div>
					</section>
					<section>
						<h3 className="mb-8 text-13 font-semibold text-[#f1f4ee]">{t("reqUa")}</h3>
						<div className="grid gap-10 sm:grid-cols-2">
							{field(t("reqName"), r.ua.name, (v) => set("ua", "name", v))}
							{field("ЄДРПОУ / РНОКПП", r.ua.edrpou, (v) => set("ua", "edrpou", v))}
							{field(t("reqAddress"), r.ua.address, (v) => set("ua", "address", v), { wide: true })}
							{field("IBAN (UA…)", r.ua.iban, (v) => set("ua", "iban", v))}
							{field(t("reqBank"), r.ua.bank, (v) => set("ua", "bank", v))}
							{field("МФО", r.ua.mfo, (v) => set("ua", "mfo", v))}
							{field(t("reqVatNote"), r.ua.vatNote, (v) => set("ua", "vatNote", v))}
						</div>
						<p className="mb-6 mt-12 text-12 text-[#8c948b]">{t("reqUahPrices")}</p>
						<div className="grid gap-10 sm:grid-cols-4">
							{field(`Company · ${t("month")}, ₴`, r.uahPrices.standard.month, (v) => price("standard", "month", v), { type: "number" })}
							{field(`Company · ${t("year")}, ₴`, r.uahPrices.standard.year, (v) => price("standard", "year", v), { type: "number" })}
							{field(`Professional · ${t("month")}, ₴`, r.uahPrices.professional.month, (v) => price("professional", "month", v), { type: "number" })}
							{field(`Professional · ${t("year")}, ₴`, r.uahPrices.professional.year, (v) => price("professional", "year", v), { type: "number" })}
						</div>
					</section>
					<section>
						<h3 className="mb-8 text-13 font-semibold text-[#f1f4ee]">{t("reqUsdt")}</h3>
						<div className="grid gap-10 sm:grid-cols-2">
							{field(t("reqWallet"), r.usdt.address, (v) => set("usdt", "address", v), { wide: true })}
							{field(t("reqRate"), r.usdt.perEur, (v) => set("usdt", "perEur", Number(v) || 0), { type: "number" })}
						</div>
					</section>
					<div><button type="button" onClick={save} disabled={saving} className="fs-btn fs-btn-primary h-36 disabled:opacity-60">{saving ? "…" : t("reqSave")}</button></div>
				</div>
			)}
		</div>
	);
}
