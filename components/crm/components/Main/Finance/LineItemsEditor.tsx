"use client";
import React from "react";
import { useTranslations } from "next-intl";
import { MdAdd, MdDelete } from "react-icons/md";
import type { LineItem, Product } from "@/app/store/useFinanceStore";
import { computeTotals } from "./format";

const EMPTY_ITEM: LineItem = { description: "", qty: 1, unitPrice: 0, taxRate: 0 };
const cell = "h-[40px] w-full rounded-8 border border-[#E6E6E6] bg-white px-8 text-14 text-[#4D4D4D] outline-none focus:border-[#5EA8F5]";

// Строки заказа/счёта: описание, количество, цена, налог — с итогами внизу. Выбор товара из каталога подставляет
// название и цену; строку всегда можно вписать и вручную (например разовую услугу, которой нет в каталоге).
export default function LineItemsEditor({ items, onChange, products, currency }: { items: LineItem[]; onChange: (items: LineItem[]) => void; products: Product[]; currency: string }) {
	const t = useTranslations("finance");
	const set = (i: number, patch: Partial<LineItem>) => onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
	const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
	const add = () => onChange([...items, { ...EMPTY_ITEM }]);
	const pickProduct = (i: number, productId: string) => {
		const p = products.find((x) => x.id === productId);
		if (!p) return set(i, { product: undefined });
		set(i, { product: p.id, description: p.name, unitPrice: p.salePrice, taxRate: p.taxRate ?? items[i].taxRate });
	};
	const totals = computeTotals(items);

	return (
		<div>
			<div className="hidden gap-8 px-2 pb-6 text-12 text-[#999999] md:grid md:grid-cols-[1fr_120px_70px_100px_90px_32px]">
				<span>{t("itemDescription")}</span><span>{t("itemProduct")}</span><span>{t("itemQty")}</span><span>{t("itemPrice")}</span><span>{t("itemTax")}</span><span />
			</div>
			<div className="flex flex-col gap-8">
				{items.map((it, i) => (
					<div key={i} className="grid grid-cols-2 gap-6 rounded-8 border border-[#F0F0F0] p-8 md:grid-cols-[1fr_120px_70px_100px_90px_32px] md:border-0 md:p-0">
						<input className={`${cell} col-span-2 md:col-span-1`} value={it.description} onChange={(e) => set(i, { description: e.target.value })} placeholder={t("itemDescription")} maxLength={300} />
						<select className={cell} value={it.product ?? ""} onChange={(e) => pickProduct(i, e.target.value)}>
							<option value="">{t("itemCustom")}</option>
							{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
						</select>
						<input className={cell} type="number" min={0} step="0.01" value={it.qty} onChange={(e) => set(i, { qty: Number(e.target.value) })} />
						<input className={cell} type="number" min={0} step="0.01" value={it.unitPrice} onChange={(e) => set(i, { unitPrice: Number(e.target.value) })} />
						<input className={cell} type="number" min={0} max={100} step="0.1" value={it.taxRate} onChange={(e) => set(i, { taxRate: Number(e.target.value) })} />
						<button type="button" onClick={() => remove(i)} aria-label={t("itemRemove")} className="flex h-[40px] w-[32px] shrink-0 items-center justify-center text-[#B3B3B3] transition-colors hover:text-danger">
							<MdDelete size={18} />
						</button>
					</div>
				))}
			</div>
			<button type="button" onClick={add} className="mt-8 flex items-center gap-6 text-14 font-medium text-primaryColor hover:opacity-80">
				<MdAdd size={18} /> {t("itemAdd")}
			</button>
			<div className="mt-14 flex flex-col items-end gap-2 text-14 text-[#666666]">
				<p>{t("net")}: {totals.net.toFixed(2)} {currency}</p>
				<p>{t("taxTotal")}: {totals.tax.toFixed(2)} {currency}</p>
				<p className="text-16 font-semibold text-[#333333]">{t("gross")}: {totals.gross.toFixed(2)} {currency}</p>
			</div>
		</div>
	);
}
