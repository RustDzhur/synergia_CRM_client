"use client";
import React, { useState } from "react";
import { useTranslations } from "next-intl";
import type { IconType } from "react-icons";
import { MdArticle, MdCancel, MdCheckBox, MdInfo, MdSignalCellularAlt } from "react-icons/md";
import ConfirmDialog from "../shared/ConfirmDialog";

interface Plan {
	id: "free" | "basic" | "standard" | "professional";
	icon: IconType;
	price: number | null; // null — бесплатный тариф
	users: number | null; // null — без ограничений
}

// Тарифы и цены — как в макете Upgrade Your Plan.
const PLANS: Plan[] = [
	{ id: "free", icon: MdSignalCellularAlt, price: null, users: null },
	{ id: "basic", icon: MdCancel, price: 1990, users: 5 },
	{ id: "standard", icon: MdInfo, price: 5990, users: 50 },
	{ id: "professional", icon: MdArticle, price: 11990, users: 100 },
];

const FEATURES = ["chat", "hdCalls", "calendar", "workspace", "feed", "knowledgeBase"] as const;

// Раздел Upgrade Your Plan (/crm/upgrade): 4 карточки тарифов — в ряд на десктопе, 2×2 на планшете, в столбец на телефоне.
// Онлайн-оплаты в проекте пока нет, поэтому «Buy» показывает пояснение, а не оформляет покупку.
export default function Upgrade() {
	const t = useTranslations("upgrade");
	const [selected, setSelected] = useState<Plan | null>(null);

	return (
		<div className="p-16 md:p-30">
			<ul className="mx-auto grid max-w-[1140px] grid-cols-1 gap-30 md:grid-cols-2 lg:grid-cols-4">
				{PLANS.map((plan) => {
					const Icon = plan.icon;
					return (
						<li
							key={plan.id}
							className="mx-auto flex w-full max-w-[340px] flex-col items-center rounded-24 bg-[#FAFCFF] px-24 pb-30 pt-24 shadow-heroImage md:max-w-none">
							<Icon size={46} className="text-[#FABFAD]" aria-hidden />
							<h2 className="mt-[4px] text-20 font-semibold text-[#999999]">{t(plan.id)}</h2>

							<p className="mt-40 text-40 font-bold leading-[1.1] text-[#666666]">
								{plan.price === null ? (
									t("freePrice")
								) : (
									<>
										{plan.price}$/<span className="text-20">{t("perMonth")}</span>
									</>
								)}
							</p>
							<p className="mt-6 text-16 text-[#999999]">
								{plan.users === null ? t("unlimitedUsers") : t("users", { count: plan.users })}
							</p>

							<ul className="mb-60 mt-60 flex w-full flex-col gap-10 text-16 text-primaryColor">
								{FEATURES.map((f) => (
									<li key={f} className="flex items-center gap-8">
										<MdCheckBox size={20} className="shrink-0" aria-hidden />
										{t(f)}
									</li>
								))}
							</ul>

							<button
								type="button"
								onClick={() => setSelected(plan)}
								className="mt-auto h-[50px] w-[165px] rounded-4 bg-primaryColor text-18 font-semibold text-white shadow-custom transition-opacity hover:opacity-80">
								{plan.price === null ? t("tryFree") : t("buy")}
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
