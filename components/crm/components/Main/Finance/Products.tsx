"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdAdd, MdDelete, MdWarning } from "react-icons/md";
import { useFinanceStore } from "@/app/store/useFinanceStore";
import Modal from "../shared/Modal";
import ConfirmDialog from "../shared/ConfirmDialog";
import FormField from "../shared/FormField";
import SearchBox from "../shared/SearchBox";
import { money } from "./format";

const EMPTY = { name: "", sku: "", type: "service" as "good" | "service", unit: "pcs", purchasePrice: "0", salePrice: "0", taxRate: "", stockQty: "0", reorderLevel: "0" };

// Каталог товаров и услуг: то же, что раньше было вкладкой «Products» в Inventory Management, но остаток теперь настоящий —
// меняется только через движения склада (заказы), не правкой числа в этой форме.
export default function Products() {
	const t = useTranslations("finance");
	const locale = useLocale();
	const { products, loadProducts, createProduct, updateProduct, deleteProduct, settings } = useFinanceStore();
	const [query, setQuery] = useState("");
	const [open, setOpen] = useState(false);
	const [editId, setEditId] = useState<string | null>(null);
	const [form, setForm] = useState(EMPTY);
	const [toDelete, setToDelete] = useState<string | null>(null);

	useEffect(() => { loadProducts(); }, [loadProducts]);

	const visible = useMemo(() => {
		const q = query.trim().toLowerCase();
		return products.filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
	}, [products, query]);

	function openNew() { setEditId(null); setForm(EMPTY); setOpen(true); }
	function openEdit(id: string) {
		const p = products.find((x) => x.id === id);
		if (!p) return;
		setEditId(id);
		setForm({ name: p.name, sku: p.sku, type: p.type, unit: p.unit, purchasePrice: String(p.purchasePrice), salePrice: String(p.salePrice), taxRate: p.taxRate === null ? "" : String(p.taxRate), stockQty: String(p.stockQty), reorderLevel: String(p.reorderLevel) });
		setOpen(true);
	}
	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!form.name.trim()) return toast.error(t("nameRequired"));
		const data = {
			name: form.name.trim(), sku: form.sku.trim(), type: form.type, unit: form.unit.trim() || "pcs",
			purchasePrice: Number(form.purchasePrice) || 0, salePrice: Number(form.salePrice) || 0,
			taxRate: form.taxRate === "" ? null : Number(form.taxRate),
			...(editId ? {} : { stockQty: Number(form.stockQty) || 0 }),
			reorderLevel: Number(form.reorderLevel) || 0,
		};
		const err = editId ? await updateProduct(editId, data) : await createProduct(data);
		if (err) return toast.error(err);
		toast.success(t("saved"));
		setOpen(false);
	}

	return (
		<div>
			<div className="mb-20 flex flex-wrap items-center justify-between gap-12">
				<SearchBox value={query} onChange={setQuery} placeholder={t("search")} className="w-full md:w-[280px]" />
				<button type="button" onClick={openNew} className="flex h-[44px] items-center gap-6 rounded-8 bg-primaryColor px-20 text-16 font-medium text-white shadow-custom hover:opacity-80">
					<MdAdd size={20} /> {t("newProduct")}
				</button>
			</div>
			{visible.length === 0 ? (
				<p className="rounded-16 bg-[#F5F7FC] p-30 text-center text-16 text-[#999999]">{t("empty")}</p>
			) : (
				<div className="overflow-x-auto rounded-16 bg-white shadow-heroImage">
					<table className="w-full min-w-[640px] text-left text-14">
						<thead><tr className="text-12 text-[#999999]"><th className="px-16 py-12 font-normal">{t("itemDescription")}</th><th className="px-10 py-12 font-normal">SKU</th><th className="px-10 py-12 font-normal">{t("colType")}</th><th className="px-10 py-12 text-right font-normal">{t("colPrice")}</th><th className="px-10 py-12 text-right font-normal">{t("colStock")}</th><th className="px-10 py-12" /></tr></thead>
						<tbody>
							{visible.map((p) => (
								<tr key={p.id} className="cursor-pointer border-t border-[#F0F0F0] hover:bg-gray" onClick={() => openEdit(p.id)}>
									<td className="px-16 py-12 font-medium text-[#333333]">{p.name}</td>
									<td className="px-10 py-12 text-[#999999]">{p.sku}</td>
									<td className="px-10 py-12 text-[#999999]">{t(p.type === "good" ? "typeGood" : "typeService")}</td>
									<td className="px-10 py-12 text-right">{money(p.salePrice, settings?.currency ?? "EUR", locale)}</td>
									<td className="px-10 py-12 text-right">
										{p.type === "good" ? (
											<span className={`inline-flex items-center gap-[4px] ${p.stockQty <= p.reorderLevel ? "text-danger" : "text-[#333333]"}`}>
												{p.stockQty <= p.reorderLevel && <MdWarning size={14} />} {p.stockQty} {p.unit}
											</span>
										) : "—"}
									</td>
									<td className="px-10 py-12 text-right">
										<button type="button" onClick={(e) => { e.stopPropagation(); setToDelete(p.id); }} aria-label={t("delete")} className="text-[#B3B3B3] hover:text-danger"><MdDelete size={18} /></button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			<Modal open={open} onClose={() => setOpen(false)} label={editId ? t("editProduct") : t("newProduct")} className="w-full max-w-[480px]">
				<form onSubmit={submit} className="rounded-16 border border-[#E2F1F5] bg-white p-24 shadow-heroImage">
					<h2 className="mb-16 text-20 font-medium text-black">{editId ? t("editProduct") : t("newProduct")}</h2>
					<div className="flex flex-col gap-14">
						<FormField label={t("itemDescription")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={200} autoFocus />
						<div className="grid grid-cols-2 gap-14">
							<FormField label="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} maxLength={60} />
							<label className="block">
								<span className="mb-6 block text-16 text-[#999999]">{t("colType")}</span>
								<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "good" | "service" })} className="h-[40px] w-full rounded-8 border border-[#EFEFEF] bg-[#FAFAFA] px-10 text-16 text-[#666666] outline-none focus:border-[#5EA8F5]">
									<option value="service">{t("typeService")}</option>
									<option value="good">{t("typeGood")}</option>
								</select>
							</label>
						</div>
						<div className="grid grid-cols-2 gap-14">
							<FormField label={t("purchasePrice")} type="number" step="0.01" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
							<FormField label={t("salePrice")} type="number" step="0.01" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} />
						</div>
						<div className="grid grid-cols-2 gap-14">
							<FormField label={t("itemTax")} type="number" step="0.1" placeholder={t("taxDefault")} value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} />
							<FormField label={t("unit")} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} maxLength={20} />
						</div>
						{form.type === "good" && (
							<div className="grid grid-cols-2 gap-14">
								<FormField label={t("colStock")} type="number" value={form.stockQty} onChange={(e) => setForm({ ...form, stockQty: e.target.value })} disabled={!!editId} />
								<FormField label={t("reorderLevel")} type="number" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} />
							</div>
						)}
						{form.type === "good" && editId && <p className="text-12 text-[#B3B3B3]">{t("stockHint")}</p>}
					</div>
					<div className="mt-24 flex justify-end gap-12">
						<button type="button" onClick={() => setOpen(false)} className="h-[44px] rounded-8 border border-[#E6E6E6] px-20 text-16 font-medium text-[#666666] hover:bg-gray">{t("cancel")}</button>
						<button type="submit" className="h-[44px] rounded-8 bg-primaryColor px-24 text-16 font-medium text-white shadow-custom hover:opacity-80">{t("save")}</button>
					</div>
				</form>
			</Modal>

			<ConfirmDialog open={!!toDelete} title={t("delete")} text={t("confirmDeleteProduct")} onCancel={() => setToDelete(null)} onConfirm={() => { if (toDelete) deleteProduct(toDelete); setToDelete(null); }} />
		</div>
	);
}
