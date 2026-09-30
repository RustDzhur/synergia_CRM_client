"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbAlertTriangle, TbPlus, TbTrash } from "react-icons/tb";
import { useFinanceStore } from "@/store/useFinanceStore";
import Modal from "../shared/Modal";
import ConfirmDialog from "../shared/ConfirmDialog";
import FormField from "../shared/FormField";
import SearchBox from "../shared/SearchBox";
import { money } from "./format";
import Stock from "./Stock";

const EMPTY = { name: "", sku: "", type: "service" as "good" | "service", unit: "pcs", purchasePrice: "0", salePrice: "0", taxRate: "", stockQty: "0", reorderLevel: "0", image: "", prices: [] as Array<{ type: string; price: string; minQty: string }>, hsCode: "", weightKg: "0", originCountry: "" };

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
		setForm({
			name: p.name, sku: p.sku, type: p.type, unit: p.unit,
			purchasePrice: String(p.purchasePrice), salePrice: String(p.salePrice),
			taxRate: p.taxRate === null ? "" : String(p.taxRate), stockQty: String(p.stockQty), reorderLevel: String(p.reorderLevel),
			image: p.image ?? "",
			prices: (p.prices ?? []).map((x) => ({ type: x.type ?? "", price: String(x.price ?? ""), minQty: String(x.minQty ?? 1) })),
			hsCode: p.hsCode ?? "",
			weightKg: String(p.weightKg ?? 0),
			originCountry: p.originCountry ?? "",
		});
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
			image: form.image.trim(),
			// Прайс: строки с пустой или нулевой ценой отбрасываются на сервере — здесь отправляем как есть
			prices: form.prices.map((x) => ({ type: x.type.trim(), price: Number(x.price) || 0, minQty: Number(x.minQty) || 1 })),
			hsCode: form.hsCode.trim(),
			weightKg: Number(form.weightKg) || 0,
			originCountry: form.originCountry.trim().toUpperCase(),
		};
		const err = editId ? await updateProduct(editId, data) : await createProduct(data);
		if (err) return toast.error(err);
		toast.success(t("saved"));
		setOpen(false);
	}

	// Разделы «Товары» и «Склад»: каталог и складская работа (документы, остатки, отчёты) — одна
	// вкладка навигации «Товари/склад» (ТЗ §12)
	const [view, setView] = useState<"products" | "stock">("products");

	return (
		<div>
			{/* Переключатель: каталог или складская работа */}
			<div className="mb-16 flex flex-wrap gap-8">
				{(["products", "stock"] as const).map((v) => (
					<button
						key={v}
						type="button"
						onClick={() => setView(v)}
						className={`rounded-10 border px-12 py-7 text-12 font-medium transition-colors ${view === v ? "border-[rgba(198,255,77,0.55)] bg-[rgba(198,255,77,0.10)] text-[#f1f4ee]" : "border-inkLine text-[#8c948b] hover:text-[#f1f4ee]"}`}>
						{t(`stockTab_${v}`)}
					</button>
				))}
			</div>
			{view === "stock" ? <Stock /> : (
			<>
			<div className="mb-16 flex flex-wrap items-center justify-between gap-12">
				<SearchBox value={query} onChange={setQuery} placeholder={t("search")} className="w-full md:w-[280px]" />
				<button type="button" onClick={openNew} className="fs-btn fs-btn-primary h-40">
					<TbPlus size={16} /> {t("newProduct")}
				</button>
			</div>
			{visible.length === 0 ? (
				<p className="fs-card p-30 text-center text-13 text-[#8c948b]">{t("empty")}</p>
			) : (
				<div className="fs-card overflow-x-auto">
					<table className="fs-table min-w-[640px] text-left">
						<thead><tr><th className="px-16">{t("itemDescription")}</th><th className="px-10">SKU</th><th className="px-10">{t("colType")}</th><th className="px-10 text-right">{t("colPrice")}</th><th className="px-10 text-right">{t("colStock")}</th><th className="px-10" /></tr></thead>
						<tbody>
							{visible.map((p) => (
								<tr key={p.id} className="cursor-pointer" onClick={() => openEdit(p.id)}>
									<td className="px-16 text-13 font-medium text-[#f1f4ee]">{p.name}</td>
									<td className="px-10 text-13 text-[#8c948b]">{p.sku}</td>
									<td className="px-10 text-13 text-[#8c948b]">{t(p.type === "good" ? "typeGood" : "typeService")}</td>
									<td className="px-10 text-right text-13">{money(p.salePrice, settings?.currency ?? "EUR", locale)}</td>
									<td className="px-10 text-right text-13">
										{p.type === "good" ? (
											<span className={`inline-flex items-center gap-[4px] ${p.stockQty <= p.reorderLevel ? "text-danger" : "text-[#f1f4ee]"}`}>
												{p.stockQty <= p.reorderLevel && <TbAlertTriangle size={14} />} {p.stockQty} {p.unit}
											</span>
										) : "—"}
									</td>
									<td className="px-10 text-right">
										<button type="button" onClick={(e) => { e.stopPropagation(); setToDelete(p.id); }} aria-label={t("delete")} className="text-[#9AA396] transition-colors hover:text-danger"><TbTrash size={16} /></button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			</>
			)}

			<Modal open={open} onClose={() => setOpen(false)} label={editId ? t("editProduct") : t("newProduct")} className="w-full max-w-[480px]">
				<form onSubmit={submit} className="fs-popover fs-scroll max-h-[90vh] overflow-y-auto p-20 md:p-24">
					<h2 className="mb-14 text-16 font-semibold text-[#f1f4ee]">{editId ? t("editProduct") : t("newProduct")}</h2>
					<div className="flex flex-col gap-12">
						<FormField label={t("itemDescription")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={200} autoFocus />
						<div className="grid grid-cols-2 gap-12">
							<FormField label="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} maxLength={60} />
							<label className="block">
								<span className="mb-6 block text-12 text-[#8c948b]">{t("colType")}</span>
								<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "good" | "service" })} className="fs-field h-40 w-full px-12 text-13 outline-none">
									<option value="service">{t("typeService")}</option>
									<option value="good">{t("typeGood")}</option>
								</select>
							</label>
						</div>
						<div className="grid grid-cols-2 gap-12">
							<FormField label={t("purchasePrice")} type="number" step="0.01" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
							<FormField label={t("salePrice")} type="number" step="0.01" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} />
						</div>
						<div className="grid grid-cols-2 gap-12">
							<FormField label={t("itemTax")} type="number" step="0.1" placeholder={t("taxDefault")} value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} />
							<FormField label={t("unit")} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} maxLength={20} />
						</div>
						{form.type === "good" && (
							<div className="grid grid-cols-2 gap-12">
								<FormField label={t("colStock")} type="number" value={form.stockQty} onChange={(e) => setForm({ ...form, stockQty: e.target.value })} disabled={!!editId} />
								<FormField label={t("reorderLevel")} type="number" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} />
							</div>
						)}
						{form.type === "good" && editId && <p className="text-11 text-[#9AA396]">{t("stockHint")}</p>}
						<FormField label={t("productImage")} value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} maxLength={500} placeholder="https://…" />
						{/* ВЭД (ТЗ §12): код УКТ ЗЕД/HS, вес единицы и страна происхождения — для пакувального листа */}
						<div className="grid grid-cols-3 gap-12">
							<FormField label={t("productHsCode")} value={form.hsCode} onChange={(e) => setForm({ ...form, hsCode: e.target.value })} maxLength={20} placeholder="8517 62 00 00" />
							<FormField label={t("productWeight")} value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value.replace(/[^\d.]/g, "") })} maxLength={8} />
							<FormField label={t("productOrigin")} value={form.originCountry} onChange={(e) => setForm({ ...form, originCountry: e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2) })} maxLength={2} placeholder="UA" />
						</div>
						{/* Прайс: типы цен и ступени по количеству (ТЗ §12, «Опт») */}
						<div>
							<span className="mb-6 block text-12 text-[#8c948b]">{t("productPrices")}</span>
							<div className="flex flex-col gap-8">
								{form.prices.map((row, i) => (
									<div key={i} className="grid grid-cols-[1fr_90px_90px_32px] items-center gap-8">
										<input value={row.type} onChange={(e) => setForm({ ...form, prices: form.prices.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)) })} placeholder={t("priceTypePlaceholder")} className="fs-field h-34 w-full px-10 text-12 outline-none" />
										<input value={row.price} onChange={(e) => setForm({ ...form, prices: form.prices.map((x, j) => (j === i ? { ...x, price: e.target.value.replace(/[^\d.]/g, "") } : x)) })} placeholder={t("colPrice")} className="fs-field h-34 w-full px-10 text-12 outline-none" />
										<input value={row.minQty} onChange={(e) => setForm({ ...form, prices: form.prices.map((x, j) => (j === i ? { ...x, minQty: e.target.value.replace(/[^\d]/g, "") } : x)) })} placeholder={t("priceFromQty")} className="fs-field h-34 w-full px-10 text-12 outline-none" />
										<button type="button" onClick={() => setForm({ ...form, prices: form.prices.filter((_, j) => j !== i) })} aria-label={t("delete")} className="text-[#8c948b] transition-colors hover:text-danger">
											<TbTrash size={14} />
										</button>
									</div>
								))}
								<button type="button" onClick={() => setForm({ ...form, prices: [...form.prices, { type: "", price: "", minQty: "1" }] })} className="fs-link text-left">{t("priceAddRow")}</button>
							</div>
						</div>
					</div>
					<div className="mt-20 flex justify-end gap-10">
						<button type="button" onClick={() => setOpen(false)} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
						<button type="submit" className="fs-btn fs-btn-primary h-40">{t("save")}</button>
					</div>
				</form>
			</Modal>

			<ConfirmDialog open={!!toDelete} title={t("delete")} text={t("confirmDeleteProduct")} onCancel={() => setToDelete(null)} onConfirm={() => { if (toDelete) deleteProduct(toDelete); setToDelete(null); }} />
		</div>
	);
}
