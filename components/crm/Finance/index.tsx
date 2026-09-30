"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { IconType } from "react-icons";
import {
	TbAsset,
	TbBell,
	TbBox,
	TbBuildingBank,
	TbCashBanknote,
	TbChartBar,
	TbClipboardList,
	TbFileCertificate,
	TbFileDescription,
	TbFileText,
	TbHistory,
	TbLayoutDashboard,
	TbReceipt,
	TbReceiptTax,
	TbRefresh,
	TbScale,
	TbSettings,
	TbTable,
	TbTools,
	TbTruckDelivery,
	TbTruckLoading,
	TbWallet,
} from "react-icons/tb";
import { TAB_BAR, TAB_ITEM, TAB_ITEM_ACTIVE, TAB_ITEM_IDLE } from "../shared/tabBar";
import PageHeader from "@/components/crm/shared/PageHeader";
import { useFinanceStore } from "@/store/useFinanceStore";
import { useMarket } from "@/store/useMarket";
import { useActiveOrg, useOrgStore } from "@/store/useOrgStore";
import ActivityWizard from "./activityParts/ActivityWizard";
import type { Market } from "@/lib/finance/market";
import CountryPicker from "./CountryPicker";
import Overview from "./Overview";
import Quotes, { QuotePrefill } from "./Quotes";
import Invoices, { InvoicePrefill } from "./Invoices";
import Orders from "./Orders";
import RecurringInvoices from "./RecurringInvoices";
import Dunning from "./Dunning";
import Contracts from "./Contracts";
import Products from "./Products";
import Expenses from "./Expenses";
import Assets from "./Assets";
import Bank from "./Bank";
import AuditLog from "./AuditLog";
import Fiscal from "./Fiscal";
import Delivery from "./Delivery";
import Purchases from "./Purchases";
import Pos from "./Pos";
import IssuedDocs from "./IssuedDocs";
import Production from "./Production";
import FinanceSettingsTab from "./Settings";
import Taxes from "./Taxes";
import Reports from "./Reports";

// Finance (/crm/finance; старый адрес /crm/inventory перенаправляется в next.config.js): счета,
// заказы, товары/склад, расходы, налоги и отчёты — бухгалтерия фирмы, встроенная в остальную CRM через движок
// автоматизации (события order_created/order_status/invoice_sent/invoice_paid/invoice_overdue, см. lib/automation).
//
// Режим рынка (страна фирмы) выбирает набор экранов целиком: он берётся из lib/finance/market.ts, а не
// из проверок country === "UA" по месту. Пока страна не выбрана, раздел показывает только её выбор
// и настройки (см. CountryPicker).

type Tab = "overview" | "quotes" | "orders" | "contracts" | "invoices" | "recurring" | "dunning" | "expenses" | "assets" | "bank" | "products" | "purchases" | "production" | "pos" | "acts" | "deliveryNotes" | "delivery" | "fiscal" | "vat" | "eur" | "bwa" | "susa" | "audit" | "settings";

interface NavLeaf { key: Tab; icon: IconType }
// Пункт ведёт на экран; группа — только заголовок в колонке навигации (как группы сайдбара), собственного
// экрана у неё нет — всё содержимое это её пункты. Подпись группы лежит в переводах под ключом nav_group_<key>.
type NavNode = { kind: "item"; key: Tab; icon: IconType } | { kind: "group"; key: string; items: NavLeaf[] };

// Немецкий режим: как было — документы, манаведение, Anlagen и отчёты BWA/SuSa
const NAV_DE: NavNode[] = [
	{ kind: "item", key: "overview", icon: TbLayoutDashboard },
	{ kind: "group", key: "orders", items: [
		{ key: "quotes", icon: TbFileText },
		{ key: "orders", icon: TbClipboardList },
		{ key: "contracts", icon: TbFileCertificate },
		// Акти та накладні (ТЗ §4): реєстри виписаних документів — повторна печать без поиска заказа
		{ key: "acts", icon: TbFileDescription },
		{ key: "deliveryNotes", icon: TbTruckDelivery },
	] },
	{ kind: "group", key: "invoices", items: [
		{ key: "invoices", icon: TbReceipt },
		{ key: "recurring", icon: TbRefresh },
		{ key: "dunning", icon: TbBell },
	] },
	{ kind: "item", key: "expenses", icon: TbWallet },
	{ kind: "item", key: "assets", icon: TbAsset },
	// Bank und Kassenbuch идут сразу за расходами и основными средствами: это те же деньги фирмы,
	// только увиденные со стороны выписки, и сверяются они с Ausgaben и Rechnungen
	{ kind: "item", key: "bank", icon: TbBuildingBank },
	{ kind: "item", key: "products", icon: TbBox },
	// Закупівлі (ТЗ §12): заказы поставщикам, приход по накладной, счета поставщиков
	{ kind: "item", key: "purchases", icon: TbTruckLoading },
	{ kind: "item", key: "production", icon: TbTools },
	{ kind: "group", key: "taxes", items: [
		{ key: "vat", icon: TbReceiptTax },
		{ key: "eur", icon: TbScale },
	] },
	{ kind: "group", key: "reports", items: [
		{ key: "bwa", icon: TbChartBar },
		{ key: "susa", icon: TbTable },
	] },
	{ kind: "item", key: "settings", icon: TbSettings },
	{ kind: "item", key: "audit", icon: TbHistory },
];

// Украинский режим: ни одной немецкой вкладки (ни Mahnwesen, ни BWA/SuSa/EÜR/UStVA, ни Anlagen);
// доставка (НП/Укрпошта) и ПРРО — свои пункты, налоги — ПДВ и единый налог
const NAV_UA: NavNode[] = [
	{ kind: "item", key: "overview", icon: TbLayoutDashboard },
	{ kind: "group", key: "orders", items: [
		{ key: "quotes", icon: TbFileText },
		{ key: "orders", icon: TbClipboardList },
		{ key: "contracts", icon: TbFileCertificate },
		// Акти та накладні (ТЗ §4): реєстри виписаних документів — повторна печать без поиска заказа
		{ key: "acts", icon: TbFileDescription },
		{ key: "deliveryNotes", icon: TbTruckDelivery },
	] },
	{ kind: "group", key: "invoices", items: [
		{ key: "invoices", icon: TbReceipt },
		{ key: "recurring", icon: TbRefresh },
	] },
	{ kind: "item", key: "expenses", icon: TbWallet },
	{ kind: "item", key: "bank", icon: TbBuildingBank },
	{ kind: "item", key: "products", icon: TbBox },
	{ kind: "item", key: "purchases", icon: TbTruckLoading },
	{ kind: "item", key: "production", icon: TbTools },
	// Касса (розница): продажа за прилавком с чеком ПРРО — только украинский режим (ТЗ §12)
	{ kind: "item", key: "pos", icon: TbCashBanknote },
	{ kind: "item", key: "delivery", icon: TbTruckDelivery },
	{ kind: "item", key: "fiscal", icon: TbReceiptTax },
	{ kind: "group", key: "taxes", items: [
		{ key: "vat", icon: TbReceiptTax },
		{ key: "eur", icon: TbScale },
	] },
	{ kind: "item", key: "settings", icon: TbSettings },
	{ kind: "item", key: "audit", icon: TbHistory },
];

// Экраны, которые режим ещё не показывает: сначала появляется функция, потом её вкладка. Список пуст,
// когда все экраны режима готовы (в украинском режиме это огляд…налаштування из §4 ТЗ).
const PENDING_UA: Tab[] = [];

// Вид деятельности → вкладки (ТЗ §18): мастер «Чем занимается фирма?» оставляет только нужное,
// лишнее скрыто. Вкладки без записи здесь видны всегда: продажи и деньги нужны каждому.
const TAB_ACTIVITIES: Partial<Record<Tab, string[]>> = {
	pos: ["retail"],
	production: ["production"],
	purchases: ["retail", "wholesale", "production"],
	delivery: ["retail", "wholesale", "importExport"],
};

// Фильтр навигации по видам деятельности фирмы; пусто — не фильтруем (мастер ещё не пройден)
function activityNav(nav: NavNode[], activities: string[]): NavNode[] {
	if (!activities.length) return nav;
	const visible = (key: Tab) => {
		const need = TAB_ACTIVITIES[key];
		return !need || need.some((a) => activities.includes(a));
	};
	const out: NavNode[] = [];
	for (const node of nav) {
		if (node.kind === "item") {
			if (visible(node.key)) out.push(node);
			continue;
		}
		const items = node.items.filter((i) => visible(i.key));
		if (items.length) out.push({ ...node, items });
	}
	return out;
}

const NAV_BY_MARKET: Record<Market, NavNode[]> = { DE: NAV_DE, UA: NAV_UA };

function marketNav(market: Market): NavNode[] {
	const hide = market === "UA" ? PENDING_UA : [];
	if (!hide.length) return NAV_BY_MARKET[market];
	const nodes: NavNode[] = [];
	for (const node of NAV_BY_MARKET[market]) {
		if (node.kind === "item") {
			if (!hide.includes(node.key)) nodes.push(node);
			continue;
		}
		const items = node.items.filter((i) => !hide.includes(i.key));
		if (items.length) nodes.push({ ...node, items });
	}
	return nodes;
}

// Все экраны раздела по порядку — тот же список проверяет ?tab=… из ссылок (уведомления, карточка сделки, автоматизация)
const ALL_TABS: Tab[] = Array.from(new Set((Object.keys(NAV_BY_MARKET) as Market[]).flatMap((m) => NAV_BY_MARKET[m].flatMap((n) => (n.kind === "item" ? [n.key] : n.items.map((i) => i.key)))))) as Tab[];

// Строка меню в колонке — как пункт сайдбара: 40px, скругление 10px, активный обведён салатовой рамкой на лёгкой подсветке.
const ROW = "flex h-40 w-full items-center gap-12 rounded-10 border border-transparent px-12 text-left text-13 font-medium transition-[background-color,border-color,color] duration-150";
const ROW_ACTIVE = "border-[rgba(198,255,77,0.55)] bg-[rgba(198,255,77,0.10)] text-[#f1f4ee]";
const ROW_IDLE = "text-[#cfd4cb] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#e6eae2]";

export default function Finance() {
	const t = useTranslations("finance");
	const loadSettings = useFinanceStore((s) => s.loadSettings);
	const { loaded, market } = useMarket();
	const [tab, setTab] = useState<Tab>("overview");
	const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);
	const [openOrderId, setOpenOrderId] = useState<string | null>(null);
	const [quotePrefill, setQuotePrefill] = useState<QuotePrefill | null>(null);
	const [invoicePrefill, setInvoicePrefill] = useState<InvoicePrefill | null>(null);

	// Настройки бухгалтерии нужны всем вкладкам, а не только своей: из них берутся режим рынка, валюта
	// по умолчанию, оформление документа и адрес с IBAN. Раньше их грузила только вкладка настроек,
	// поэтому счёт, созданный со вкладки «Счета», всегда получал EUR, даже если в фирме выбрана другая валюта.
	useEffect(() => { loadSettings(); }, [loadSettings]);

	// Виды деятельности фирмы (мастер «Чем занимается фирма?»): фильтруют вкладки, пока не пройден — всё видно
	const org = useActiveOrg();
	const activities = org?.activities ?? [];
	const [wizardOpen, setWizardOpen] = useState(false);
	const orgLoaded = useOrgStore((s) => s.loaded);
	useEffect(() => {
		if (!orgLoaded || !org || activities.length) return;
		let skipped = false;
		try { skipped = localStorage.getItem(`crm.activityWizardSkipped.${org.id}`) === "1"; } catch { /* приватный режим */ }
		if (!skipped) setWizardOpen(true);
	}, [orgLoaded, org, activities.length]);

	const nav = market ? activityNav(marketNav(market), activities) : [];
	const visible = nav.flatMap((n) => (n.kind === "item" ? [n.key] : n.items.map((i) => i.key)));

	// пришли по ссылке из карточки сделки (CRM → Deal, см. DealsBoard/dealModalParts/DealDocuments.tsx):
	// ?tab=quotes&newFromDeal=… — сразу новое предложение, ?tab=invoices&newInvoiceFor=… — новый счёт,
	// ?open=… — открыть уже созданный документ этой вкладки
	useEffect(() => {
		const q = new URLSearchParams(window.location.search);
		const newFromDeal = q.get("newFromDeal");
		const newInvoiceFor = q.get("newInvoiceFor");
		const wantedTab = q.get("tab");
		const open = q.get("open");
		if (wantedTab && (ALL_TABS as readonly string[]).includes(wantedTab)) setTab(wantedTab as Tab);
		if (newFromDeal) {
			setQuotePrefill({
				dealId: newFromDeal,
				customerName: q.get("customerName") ?? "",
				contact: q.get("contact") ?? undefined,
				company: q.get("company") ?? undefined,
			});
		}
		if (newInvoiceFor) {
			setTab("invoices");
			setInvoicePrefill({
				dealId: newInvoiceFor,
				customerName: q.get("customerName") ?? "",
				contact: q.get("contact") ?? undefined,
				company: q.get("company") ?? undefined,
			});
		}
		if (open) {
			if (wantedTab === "orders") setOpenOrderId(open);
			else setOpenInvoiceId(open);
		}
		if (wantedTab || newFromDeal || newInvoiceFor || open) window.history.replaceState(null, "", window.location.pathname);
	}, []);

	// смена режима (страны) может убрать текущую вкладку — уводим на огляд, иначе остался бы пустой экран
	useEffect(() => {
		if (market && visible.length && !visible.includes(tab) && tab !== "settings") setTab("overview");
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [market, tab]);

	// «Steuern» у украинской фирмы — это ПДВ и единый налог, а не UStVA и EÜR: подписи должны совпадать
	// с тем, что на экране (см. Taxes.tsx)
	function tabLabel(key: Tab): string {
		if (market === "UA") {
			if (key === "vat") return t("tab_ua_vat");
			if (key === "eur") return t("tab_ua_single");
		}
		return t(`tab_${key}`);
	}

	function openInvoice(id: string) {
		setOpenInvoiceId(id);
		setTab("invoices");
	}
	function openOrder(id: string) {
		setOpenOrderId(id);
		setTab("orders");
	}
	function select(next: Tab) {
		setTab(next);
		if (next !== "invoices") setOpenInvoiceId(null);
		if (next !== "orders") setOpenOrderId(null);
	}

	// Страна не выбрана: показываем только выбор страны и настройки — ни одной вкладки режима
	// (ни немецкой, ни украинской), иначе фирма видела бы оба набора сразу (ТЗ §1.3).
	if (loaded && !market) {
		return (
			<div className="px-16 py-20 md:px-24 md:py-24 lg:px-32">
				<PageHeader />
				<CountryPicker onOpenSettings={() => setTab("settings")} settingsOpen={tab === "settings"} />
			</div>
		);
	}
	if (loaded && !market) return null;

	return (
		<div className="px-16 py-20 md:px-24 md:py-24 lg:px-32">
			<PageHeader />

			{/* Телефон и планшет: тот же набор экранов прокручиваемым рядом пилюль — колонка сюда не помещается */}
			<div className="mb-16 lg:hidden">
				<div role="tablist" className={`${TAB_BAR} overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
					{visible.map((key) => (
						<button
							key={key}
							type="button"
							role="tab"
							aria-selected={tab === key}
							onClick={() => select(key)}
							className={`${TAB_ITEM} ${tab === key ? TAB_ITEM_ACTIVE : TAB_ITEM_IDLE}`}>
							{tabLabel(key)}
						</button>
					))}
				</div>
			</div>

			<ActivityWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />

			<div className="flex items-start gap-24 lg:gap-32">
				{/* Desktop: колонка подменю слева (240px), липнет под шапкой кабинета */}
				<nav aria-label={t("title")} className="fs-scroll sticky top-80 hidden max-h-[calc(100vh-104px)] w-240 shrink-0 overflow-y-auto lg:block">
					{nav.map((node) =>
						node.kind === "item" ? (
							<button
								key={node.key}
								type="button"
								aria-current={tab === node.key ? "page" : undefined}
								onClick={() => select(node.key)}
								className={`${ROW} ${tab === node.key ? ROW_ACTIVE : ROW_IDLE}`}>
								<node.icon size={17} className={`shrink-0 ${tab === node.key ? "text-[#c6ff4d]" : "text-[#8c948b]"}`} />
								{tabLabel(node.key)}
							</button>
						) : (
							<div key={node.key}>
								<p className="fs-nav-group px-12 pb-8 pt-22">{t(`nav_group_${node.key}`)}</p>
								<ul className="space-y-3">
									{node.items.map((leaf) => (
										<li key={leaf.key}>
											<button
												type="button"
												aria-current={tab === leaf.key ? "page" : undefined}
												onClick={() => select(leaf.key)}
												className={`${ROW} ${tab === leaf.key ? ROW_ACTIVE : ROW_IDLE}`}>
												<leaf.icon size={17} className={`shrink-0 ${tab === leaf.key ? "text-[#c6ff4d]" : "text-[#8c948b]"}`} />
												{tabLabel(leaf.key)}
											</button>
										</li>
									))}
								</ul>
							</div>
						),
					)}
				</nav>

				<div className="min-w-0 flex-1">
					{tab === "overview" && <Overview />}
					{tab === "quotes" && <Quotes onOpenOrder={openOrder} prefill={quotePrefill} />}
					{tab === "orders" && <Orders onOpenInvoice={openInvoice} openId={openOrderId} />}
					{tab === "invoices" && <Invoices openId={openInvoiceId} prefill={invoicePrefill} />}
					{tab === "recurring" && <RecurringInvoices />}
					{tab === "dunning" && <Dunning />}
					{tab === "contracts" && <Contracts />}
					{tab === "products" && <Products />}
					{tab === "expenses" && <Expenses />}
					{tab === "assets" && <Assets />}
					{tab === "bank" && <Bank />}
					{tab === "purchases" && <Purchases />}
					{tab === "production" && <Production />}
					{tab === "pos" && <Pos />}
					{tab === "acts" && <IssuedDocs kind="act" />}
					{tab === "deliveryNotes" && <IssuedDocs kind="delivery_note" />}
					{tab === "delivery" && <Delivery />}
					{tab === "fiscal" && <Fiscal />}
					{tab === "vat" && <Taxes kind="vat" />}
					{tab === "eur" && <Taxes kind="eur" />}
					{tab === "bwa" && <Reports kind="bwa" />}
					{tab === "susa" && <Reports kind="susa" />}
					{tab === "audit" && <AuditLog />}
					{tab === "settings" && <FinanceSettingsTab />}
				</div>
			</div>
		</div>
	);
}
