"use client";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { apiCall } from "@/store/crmApi";
import { fieldOf, labelOf, tokensIn, type CatalogField } from "@/lib/finance/contractFields";
import { trFor } from "./contractUi";

// «Данные для договора» в форме договора: перечень меток из выбранного текста. Что есть в карточке клиента и в настройках фирмы — уже стоит в полях;
// пустое подсвечено. Поправленное здесь печатается в этом договоре (важнее карточки); галочка сохраняет реквизиты клиента в его карточку.

export interface TemplateField { key: string; label: string; type: string; source: string }
export interface ClientData { vars: Record<string, string>; extra: Record<string, string>; firm: Record<string, string> }

const PERSONAL_GROUPS = new Set(["person", "idDoc"]);
const PERSONAL_BASES = new Set(["rnokpp", "pinfl", "steuerId", "socialNumber", "mobilePhone", "telegram"]);
/** Реквизит человека (контакт) или организации (компания) — куда сохранять при «в карточку клиента». */
export const belongsToContact = (f: CatalogField) => PERSONAL_GROUPS.has(f.group) || PERSONAL_BASES.has(f.base);

export default function ContractDataPanel({ body, customFields, link, customerName, values, onChange, saveToCard, onSaveToCard }: {
	body: string;
	customFields: TemplateField[];
	link: { contact?: string; company?: string };
	customerName: string;
	values: Record<string, string>;
	onChange: (key: string, value: string) => void;
	saveToCard: boolean;
	onSaveToCard: (v: boolean) => void;
}) {
	const locale = useLocale();
	const tr = trFor(locale);
	const [data, setData] = useState<ClientData | null>(null);

	// Данные карточек клиента и фирмы: обновляются при смене клиента
	useEffect(() => {
		const q = new URLSearchParams();
		if (link.contact) q.set("contact", link.contact);
		if (link.company) q.set("company", link.company);
		if (customerName) q.set("name", customerName);
		let alive = true;
		void apiCall<ClientData>(`/api/contract-templates/client-data?${q.toString()}`).then((r) => { if (alive && r.ok && r.data) setData(r.data); });
		return () => { alive = false; };
	}, [link.contact, link.company, customerName]);

	const rows = useMemo(() => {
		const out: { key: string; label: string; type: string; field?: CatalogField; custom?: boolean }[] = [];
		const seen = new Set<string>();
		for (const token of tokensIn(body)) {
			const lower = token.toLowerCase();
			const custom = customFields.find((c) => c.key.toLowerCase() === lower);
			const f = fieldOf(token);
			if (custom) { if (!seen.has(lower)) { seen.add(lower); out.push({ key: custom.key, label: custom.label || custom.key, type: custom.type, custom: true }); } continue; }
			if (!f || f.system || f.computed) continue; // номер, дата, сумма, ФИО целиком и т.п. подставляются сами
			if (seen.has(f.key.toLowerCase())) continue;
			seen.add(f.key.toLowerCase());
			out.push({ key: f.key, label: labelOf(f, locale), type: f.type, field: f });
		}
		return out;
	}, [body, customFields, locale]);

	if (!rows.length) return null;
	const current = (r: { key: string; custom?: boolean }) => {
		if (values[r.key] !== undefined) return values[r.key];
		if (r.custom) return data?.extra?.[r.key] ?? "";
		return data?.vars?.[r.key] ?? "";
	};
	const hasCustomer = rows.some((r) => r.field?.side === "customer");

	return (
		<div className="rounded-12 border border-inkLine p-12">
			<span className="mb-2 block text-12 font-medium text-[#f1f4ee]">{tr("dataTitle")}</span>
			<p className="mb-8 text-11 text-[#8c948b]">{tr("dataHint")}</p>
			<div className="grid grid-cols-1 gap-8 md:grid-cols-2">
				{rows.map((r) => {
					const v = current(r);
					const empty = !v.trim();
					return (
						<label key={r.key} className="block">
							<span className="mb-4 flex items-center justify-between gap-6 text-11 text-[#8c948b]">
								<span className="truncate">{r.label}</span>
								{empty && <span className="shrink-0 text-[#F4A100]">{tr("missing")}</span>}
							</span>
							<input
								type={r.type === "date" ? "date" : r.type === "number" ? "number" : "text"}
								value={v}
								onChange={(e) => onChange(r.key, e.target.value)}
								className={`fs-field w-full px-8 py-6 text-12 outline-none ${empty ? "border-[rgba(244,161,0,0.55)]" : ""}`}
							/>
						</label>
					);
				})}
			</div>
			{hasCustomer && (link.contact || link.company) && (
				<label className="mt-10 flex cursor-pointer items-center gap-8 text-12 text-[#cfd4cb]">
					<input type="checkbox" checked={saveToCard} onChange={(e) => onSaveToCard(e.target.checked)} className="accent-[#C6FF4D]" />
					{tr("saveToCard")}
				</label>
			)}
		</div>
	);
}
