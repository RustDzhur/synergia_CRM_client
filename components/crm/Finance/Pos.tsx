"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbArrowBackUp, TbCash, TbCreditCard, TbReceipt, TbTrash } from "react-icons/tb";
import ConfirmDialog from "../shared/ConfirmDialog";
import { apiCall } from "@/store/crmApi";
import { money } from "./format";
import Link from "next/link";

// Касса (ТЗ §12, «Розница»): штрихкод (SKU), количество, скидка, готівка или картка. Продажа
// становится оплаченным счётом — попадает в книгу доходов и реестр ПН; склад списывается, чек ПРРО
// пробивается по правилам (готівка и картка — обязателен). Возврат — по чеку из списка: кредит-нота,
// возврат товара и чек возврата. DE без сертифицированной кассы продажу не проводит — маршрут ответит.

interface ProductRow { id: string; name: string; sku: string; barcode: string; price: number; unit: string; stockQty: number; image: string }
interface SaleRow { id: string; number: string; at: string; total: number; currency: string; fiscalCode: string; payType: string; customerName: string }
interface CartLine { product: string; name: string; price: number; qty: number }

export default function Pos() {
	const t = useTranslations("finance");
	const locale = useLocale();
	const [products, setProducts] = useState<ProductRow[]>([]);
	const [recent, setRecent] = useState<SaleRow[]>([]);
	const [query, setQuery] = useState("");
	const [cart, setCart] = useState<CartLine[]>([]);
	const [discount, setDiscount] = useState("0");
	const [busy, setBusy] = useState(false);
	const [returnFor, setReturnFor] = useState<SaleRow | null>(null);
	const [lastSale, setLastSale] = useState<{ number: string; fiscalCode: string; fiscalError: string; fiscalUrl: string } | null>(null);
	// Состояние ПРРО: без подключённого Checkbox продажа проходит без чека, и об этом надо сказать прямо
	const [fiscal, setFiscal] = useState<{ connected: boolean; auto: boolean; openShift: boolean } | null>(null);

	const load = useCallback(async () => {
		const [res, st] = await Promise.all([
			apiCall<{ products: ProductRow[]; recent: SaleRow[] }>("/api/pos"),
			apiCall<{ connected: boolean; auto: boolean; shift: { open: { id: string } | null } }>("/api/finance/fiscal"),
		]);
		if (res.ok && res.data) {
			setProducts(res.data.products);
			setRecent(res.data.recent);
		}
		if (st.ok && st.data) setFiscal({ connected: !!st.data.connected, auto: !!st.data.auto, openShift: !!st.data.shift?.open });
	}, []);
	useEffect(() => { void load(); }, [load]);

	// Поиск по штрихкоду, артикулу и названию: сканер вводит номер как текст — точное совпадение
	// штрихкода или SKU добавляет товар сразу, иначе показываем подсказки
	const found = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return [];
		return products.filter((p) => (p.sku ?? "").toLowerCase().includes(q) || (p.barcode ?? "").includes(q) || p.name.toLowerCase().includes(q)).slice(0, 8);
	}, [products, query]);

	function addToCart(p: ProductRow, qty = 1) {
		setCart((prev) => {
			const existing = prev.find((l) => l.product === p.id);
			if (existing) return prev.map((l) => (l.product === p.id ? { ...l, qty: l.qty + qty } : l));
			return [...prev, { product: p.id, name: p.name, price: p.price, qty }];
		});
		setQuery("");
	}

	function onQueryChange(v: string) {
		setQuery(v);
		// Точное совпадение со штрихкодом или артикулом — сразу в чек (так работает сканер)
		const probe = v.trim().toLowerCase();
		const exact = products.find((p) => (p.barcode && p.barcode.toLowerCase() === probe) || (p.sku && p.sku.toLowerCase() === probe));
		if (exact) addToCart(exact);
	}

	const discountValue = Math.max(0, Math.min(90, Number(discount) || 0));
	const total = cart.reduce((s, l) => s + l.qty * l.price, 0) * (1 - discountValue / 100);

	async function sell(payType: "cash" | "card") {
		if (!cart.length) return void toast.error(t("posEmpty"));
		setBusy(true);
		const res = await apiCall<{ invoice: { number: string }; fiscal: { fiscalCode: string; url: string } | null }>("/api/pos", "POST", {
			action: "sale",
			payType,
			discountPercent: discountValue,
			lines: cart.map((l) => ({ product: l.product, qty: l.qty, price: l.price })),
		});
		setBusy(false);
		if (!res.ok || !res.data) return void toast.error(res.message);
		const status = await apiCall<{ fiscalCode: string; fiscalError: string; fiscalUrl: string }>("/api/pos", "POST", { action: "sale-status", invoiceId: (res.data as unknown as { invoice: { id: string } }).invoice.id });
		setLastSale({ number: res.data.invoice.number, fiscalCode: res.data.fiscal?.fiscalCode ?? "", fiscalError: status.data?.fiscalError ?? "", fiscalUrl: res.data.fiscal?.url ?? "" });
		toast.success(t("posSold", { number: res.data.invoice.number }));
		setCart([]);
		setDiscount("0");
		void load();
	}

	async function doReturn(sale: SaleRow) {
		setReturnFor(null);
		setBusy(true);
		const res = await apiCall("/api/pos", "POST", { action: "return", invoiceId: sale.id });
		setBusy(false);
		if (!res.ok) return void toast.error(res.message);
		toast.success(t("posReturned"));
		void load();
	}

	const field = "fs-field h-40 w-full px-12 text-13 outline-none";

	return (
		<div className="flex flex-col gap-16">
			{/* Как это работает и что настроено: продажа — оплаченный счёт, чек ПРРО обязателен на
			    готівку и картку; без подключённого Checkbox чек не пробьётся, и это видно сразу */}
			<div className="rounded-10 border border-inkLine bg-[rgba(255,255,255,0.02)] p-12 text-12 text-[#8c948b]">
				{t("posHowto")}
				{fiscal && (
					<span className="mt-6 block">
						{fiscal.connected
							? `${t("fiscalShiftOpenShort")}: ${fiscal.openShift ? t("posShiftOpenYes") : t("posShiftOpenNo")}`
							: ""}
						{!fiscal.connected && (
							<>
								{t("posNoFiscal")}{" "}
								<Link href={`/${locale}/crm/settings/integration`} className="text-[#c6ff4d] hover:underline">{t("posFiscalLink")}</Link>
							</>
						)}
					</span>
				)}
			</div>

			{/* Последний чек: номер и фискальный код — их называют покупателю */}
			{lastSale && (
				<div className="rounded-10 border border-[rgba(198,255,77,0.35)] bg-[rgba(198,255,77,0.08)] p-12 text-12 text-[#cfd4cb]">
					{t("posLastSale", { number: lastSale.number })}
					{lastSale.fiscalCode ? ` · ${t("fiscalChip")}: ${lastSale.fiscalCode}` : lastSale.fiscalError ? ` · ${t("fiscalError")}: ${lastSale.fiscalError}` : ""}
					{lastSale.fiscalUrl && (
						<a href={lastSale.fiscalUrl} target="_blank" rel="noreferrer" className="ml-8 text-[#c6ff4d] hover:underline">{t("posOpenReceipt")}</a>
					)}
				</div>
			)}

			<div className="grid grid-cols-1 gap-16 xl:grid-cols-2">
				{/* Товар: поиск по штрихкоду и названию */}
				<section className="fs-card p-16 md:p-20">
					<h3 className="mb-10 text-14 font-semibold text-[#f1f4ee]">{t("posSearch")}</h3>
					<input value={query} onChange={(e) => onQueryChange(e.target.value)} placeholder={t("posSearchPlaceholder")} autoFocus className={field} />
					{found.length > 0 && query.trim() && (
						<ul className="mt-8 flex flex-col gap-4">
							{found.map((p) => (
								<li key={p.id}>
									<button type="button" onClick={() => addToCart(p)} className="flex w-full items-center justify-between gap-10 rounded-10 px-10 py-8 text-left text-13 transition-colors hover:bg-[rgba(255,255,255,0.04)]">
										<span className="text-[#f1f4ee]">{p.name}<span className="ml-6 text-11 text-[#8c948b]">{p.sku} · {p.stockQty} {p.unit}</span></span>
										<span className="text-[#cfd4cb]">{money(p.price, "UAH", locale)}</span>
									</button>
								</li>
							))}
						</ul>
					)}
					{products.length === 0 && <p className="mt-8 text-12 text-[#8c948b]">{t("posNoGoods")}</p>}
				</section>

				{/* Чек: строки, скидка, оплата */}
				<section className="fs-card p-16 md:p-20">
					<h3 className="mb-10 text-14 font-semibold text-[#f1f4ee]">{t("posCart")}</h3>
					{cart.length === 0 ? (
						<p className="text-12 text-[#8c948b]">{t("posEmpty")}</p>
					) : (
						<ul className="flex flex-col gap-8">
							{cart.map((l) => (
								<li key={l.product} className="flex items-center gap-10 border-t border-inkLine pt-8 text-13">
									<span className="min-w-0 flex-1 truncate text-[#f1f4ee]">{l.name}</span>
									<input
										value={String(l.qty)}
										onChange={(e) => setCart(cart.map((x) => (x.product === l.product ? { ...x, qty: Math.max(0.001, Number(e.target.value.replace(/[^\d.]/g, "")) || 1) } : x)))}
										className="fs-field h-30 w-64 px-8 text-12 outline-none"
									/>
									<span className="w-[90px] text-right text-[#cfd4cb]">{money(l.qty * l.price, "UAH", locale)}</span>
									<button type="button" onClick={() => setCart(cart.filter((x) => x.product !== l.product))} aria-label={t("delete")} className="text-[#8c948b] transition-colors hover:text-danger">
										<TbTrash size={14} />
									</button>
								</li>
							))}
						</ul>
					)}
					<div className="mt-12 flex items-center gap-10">
						<label className="flex items-center gap-8 text-12 text-[#8c948b]">
							{t("posDiscount")}
							<input value={discount} onChange={(e) => setDiscount(e.target.value.replace(/[^\d]/g, ""))} className="fs-field h-34 w-64 px-8 text-12 outline-none" />
							%
						</label>
						<span className="ml-auto text-15 font-semibold text-[#c6ff4d]">{money(total, "UAH", locale)}</span>
					</div>
					<div className="mt-12 flex flex-wrap gap-10">
						<button type="button" disabled={busy || !cart.length} onClick={() => void sell("cash")} className="fs-btn fs-btn-ghost h-40 flex-1 justify-center disabled:opacity-50">
							<TbCash size={16} /> {t("posCash")}
						</button>
						<button type="button" disabled={busy || !cart.length} onClick={() => void sell("card")} className="fs-btn fs-btn-primary h-40 flex-1 justify-center disabled:opacity-50">
							<TbCreditCard size={16} /> {t("posCard")}
						</button>
					</div>
				</section>
			</div>

			{/* Возвраты: по чеку из списка последних продаж */}
			<section className="fs-card p-16 md:p-20">
				<h3 className="mb-10 text-14 font-semibold text-[#f1f4ee]">{t("posRecent")}</h3>
				{recent.length === 0 ? (
					<p className="text-12 text-[#8c948b]">{t("posNoSales")}</p>
				) : (
					<ul className="flex flex-col gap-6">
						{recent.map((s) => (
							<li key={s.id} className="flex flex-wrap items-center justify-between gap-10 border-t border-inkLine pt-6 text-12">
								<span className="text-[#f1f4ee]">{s.number}<span className="ml-6 text-11 text-[#8c948b]">{new Date(s.at).toLocaleString()} · {s.payType === "cash" ? t("fiscalCash") : t("fiscalCard")}</span></span>
								<span className="text-[#cfd4cb]">{money(s.total, s.currency, locale)}</span>
								<span className="text-11 text-[#8c948b]">{s.fiscalCode ? `${t("fiscalChip")} ${s.fiscalCode}` : ""}</span>
								<button type="button" disabled={busy} onClick={() => setReturnFor(s)} className="fs-btn fs-btn-ghost h-28 disabled:opacity-50">
									<TbArrowBackUp size={12} /> {t("posReturn")}
								</button>
							</li>
						))}
					</ul>
				)}
			</section>

			<ConfirmDialog
				open={!!returnFor}
				onCancel={() => setReturnFor(null)}
				onConfirm={() => returnFor && void doReturn(returnFor)}
				title={t("posReturn")}
				text={t("posReturnConfirm", { number: returnFor?.number ?? "" })}
				confirmLabel={t("posReturn")}
			/>

			<p className="flex items-center gap-8 text-11 text-[#9AA396]">
				<TbReceipt size={13} /> {t("posHint")}
			</p>
		</div>
	);
}
