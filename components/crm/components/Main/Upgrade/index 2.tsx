"use client";
import React, { useState } from "react";
import { useTranslations } from "next-intl";
import type { IconType } from "react-icons";
import { MdCheckBox, MdCheckBoxOutlineBlank, MdInfo, MdArticle, MdSignalCellularAlt } from "react-icons/md";
import { FEATURE_KEYS, PLANS, PlanDef, PlanId } from "@/app/config/plans";
import ConfirmDialog from "../shared/ConfirmDialog";

const ICONS: Record<PlanId, IconType> = { free: MdSignalCellularAlt, standard: MdInfo, professional: MdArticle };
// ключи функций в namespace "upgrade"
const FEATURE_LABEL = { chat: "chat", calls: "hdCalls", calendar: "calendar", workspace: "workspace", feed: "feed", knowledge: "knowledgeBase" } as const;

// Раздел Upgrade Your Plan (/crm/upgrade): три тарифа из app/config/plans.ts (те же, что на лендинге) —
// в ряд на десктопе и планшете, в столбец на телефоне. Функции, которых в тарифе нет, показаны серыми.
// Онлайн-оплаты в проекте пока нет, поэтому «Buy» показывает пояснение, а не оформляет покупку.
export default function Upgrade() {
	const t = useTranslations("upgrade");
	const [selected, setSelected] = useState<PlanDef | null>(null);

	return (
		<div className="p-16 md:p-30">
			<ul className="mx-auto grid max-w-[1140px] grid-cols-1 gap-20 md:grid-cols-3 md:gap-20 lg:gap-30">
				{PLANS.map((plan) => {
					const Icon = ICONS[plan.id];
					return (
						<li
							key={plan.id}
							className={`mx-auto flex w-full max-w-[340px] flex-col items-center rounded-24 px-24 pb-30 pt-24 shadow-heroImage md:max-w-none ${
								plan.highlighted ? "bg-[#EEF5FF]" : "bg-[#FAFCFF]"
							}`}>
							<Icon size={46} className="text-[#FABFAD]" aria-hidden />
							<h2 className="mt-[4px] text-20 font-semibold text-[#999999]">{t(plan.id)}</h2>

							<p className="mt-40 text-36 font-bold leading-[1.1] text-[#666666] lg:text-40">
								{plan.priceMonth === 0 ? (
									t("freePrice")
								) : (
									<>
										{plan.priceMonth}€/<span className="text-20">{t("perMonth")}</span>
									</>
								)}
							</p>
							<p className="mt-6 text-center text-16 text-[#999999]">
								{plan.users === null ? t("unlimitedUsers") : t("users", { count: plan.users })}
							</p>

							<ul className="mb-40 mt-40 flex w-full flex-col gap-10 text-16">
								{FEATURE_KEYS.map((f) => {
									const included = plan.features[f];
									return (
										<li key={f} className={`flex items-center gap-8 ${included ? "text-primaryColor" : "text-[#CCCCCC] line-through"}`}>
											{included ? <MdCheckBox size={20} className="shrink-0" aria-hidden /> : <MdCheckBoxOutlineBlank size={20} className="shrink-0" aria-hidden />}
											{t(FEATURE_LABEL[f])}
										</li>
									);
								})}
							</ul>
							{plan.id === "professional" && <p className="mb-16 text-14 font-medium text-[#009A2B]">{t("fullAccess")}</p>}

							<button
								type="button"
								onClick={() => setSelected(plan)}
								className="mt-auto h-[50px] w-[165px] rounded-4 bg-primaryColor text-18 font-semibold text-white shadow-custom transition-opacity hover:opacity-80">
								{plan.priceMonth === 0 ? t("tryFree") : t("buy")}
							</button>
						</li>
					);
				})}
			</ul>

			<ConfirmDialog
				open={selected !== null}
				title={selected ? t(selected.id) : ""}
				text={t("soonText")}
				confirmLabel={t("ok")}
				onCancel={() => setSelected(null)}
				onConfirm={() => setSelected(null)}
			/>
		</div>
	);
}
