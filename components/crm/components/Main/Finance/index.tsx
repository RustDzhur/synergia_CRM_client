"use client";
import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { TAB_BAR } from "../shared/tabBar";
import Overview from "./Overview";
import Quotes from "./Quotes";
import Orders from "./Orders";
import Invoices from "./Invoices";
import Contracts from "./Contracts";
import Products from "./Products";
import Expenses from "./Expenses";
import AuditLog from "./AuditLog";
import FinanceSettingsTab from "./Settings";

const TABS = ["overview", "quotes", "orders", "invoices", "contracts", "products", "expenses", "audit", "settings"] as const;
type Tab = (typeof TABS)[number];

// Finance (/crm/inventory — адрес не меняли, чтобы не ломать ссылки; раздел в сайдбаре называется «Finance»): счета,
// заказы, товары/склад, расходы — бухгалтерия фирмы, встроенная в остальную CRM через движок автоматизации
// (события order_created/order_status/invoice_sent/invoice_paid/invoice_overdue, см. lib/automation).
export default function Finance() {
	const t = useTranslations("finance");
	const [tab, setTab] = useState<Tab>("overview");
	const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);
	const [openOrderId, setOpenOrderId] = useState<string | null>(null);

	function openInvoice(id: string) {
		setOpenInvoiceId(id);
		setTab("invoices");
	}
	function openOrder(id: string) {
		setOpenOrderId(id);
		setTab("orders");
	}

	return (
		<div className="p-16 md:p-30">
			<div className="mb-20 flex flex-col gap-16 md:mb-30 md:flex-row md:items-center md:justify-between">
				<h1 className="text-32 font-medium text-[#4D4D4D] md:text-34">{t("title")}</h1>
				<div role="tablist" className={`${TAB_BAR} gap-6 overflow-x-auto`}>
					{TABS.map((key) => (
						<button
							key={key}
							type="button"
							role="tab"
							aria-selected={tab === key}
							onClick={() => { setTab(key); if (key !== "invoices") setOpenInvoiceId(null); if (key !== "orders") setOpenOrderId(null); }}
							className={`shrink-0 whitespace-nowrap rounded-4 px-16 py-10 text-16 font-medium tracking-[0.32px] transition-colors duration-200 ${
								tab === key ? "bg-primaryColor text-white" : "text-[#CCCCCC] hover:text-[#999999]"
							}`}>
							{t(`tab_${key}`)}
						</button>
					))}
				</div>
			</div>

			{tab === "overview" && <Overview />}
			{tab === "quotes" && <Quotes onOpenOrder={openOrder} />}
			{tab === "orders" && <Orders onOpenInvoice={openInvoice} openId={openOrderId} />}
			{tab === "invoices" && <Invoices openId={openInvoiceId} />}
			{tab === "contracts" && <Contracts />}
			{tab === "products" && <Products />}
			{tab === "expenses" && <Expenses />}
			{tab === "audit" && <AuditLog />}
			{tab === "settings" && <FinanceSettingsTab />}
		</div>
	);
}
