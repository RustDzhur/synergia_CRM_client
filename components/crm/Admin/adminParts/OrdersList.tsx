"use client";
import { useTranslations } from "next-intl";
import { cardClass, OrderRow } from "./model";

interface Props { orders: OrderRow[]; onConfirm: (o: OrderRow) => void; onCancel: (o: OrderRow) => void }

// Счета на тарифы: «клиент оплатил» — сверху, там нужна проверка поступления и одна кнопка «Подтвердить», после которой тариф включается сам
export default function OrdersList({ orders, onConfirm, onCancel }: Props) {
	const t = useTranslations("admin");
	return (
		<div className="mb-24">
			<h2 className="mb-8 text-14 font-semibold text-[#f1f4ee]">{t("orders")}</h2>
			<ul className="flex flex-col gap-8">
				{orders.map((o) => (
					<li key={o.id} className={`${cardClass} flex flex-wrap items-center gap-x-16 gap-y-8 ${o.status === "claimed" ? "border-[rgba(198,255,77,0.40)]" : ""}`}>
						<div className="min-w-0 flex-1 text-12 text-[#8c948b]">
							<p className="font-medium text-[#f1f4ee]">
								{o.orgName} · {o.plan} / {o.interval === "year" ? t("year") : t("month")} · {o.number}
								<span className={`ml-8 fs-chip h-20 px-8 text-10 ${o.status === "claimed" ? "border-[rgba(198,255,77,0.40)] text-[#c6ff4d]" : ""}`}>{t(`order_${o.status}`)}</span>
							</p>
							<p>
								{o.method === "usdt" ? `${o.usdtAmount.toFixed(2)} USDT (TRC-20)` : `${o.amount.toFixed(2)} ${o.currency} · ${t("orderBank")}`} · {o.company}{o.vatId ? ` · ${o.vatId}` : ""}
							</p>
							{o.payerRef && <p className="break-all text-[#c6ff4d]">{o.payerRef}</p>}
						</div>
						<button type="button" onClick={() => onConfirm(o)} className="fs-btn fs-btn-primary h-34">{t("orderConfirm")}</button>
						<button type="button" onClick={() => onCancel(o)} className="text-12 text-[#9AA396] hover:text-danger">{t("orderCancel")}</button>
					</li>
				))}
			</ul>
			<p className="mt-6 text-11 text-[#9AA396]">{t("ordersHelp")}</p>
		</div>
	);
}
