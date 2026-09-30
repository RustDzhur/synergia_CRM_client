"use client";
import React from "react";
import { useTranslations } from "next-intl";
import { TbAddressBook, TbArrowUpCircle, TbBuildingSkyscraper, TbCheck, TbCheckbox, TbCoin, TbLayoutDashboard, TbLayoutGrid, TbSettings, TbSettingsAutomation, TbSpeakerphone } from "react-icons/tb";
import BrandMark from "@/components/crm/shared/BrandMark";

// Витрина кабинета для лендинга. Это разметка, а не снимок экрана, но повторяет настоящий интерфейс:
// те же разделы в том же порядке, та же шапка, тот же заголовок страницы. Раньше здесь была выдуманная
// навигация («Agenten», «Vorlagen») и пометка «Konzeptansicht» — она противоречила реальному продукту.
export type FrameScreen = "overview" | "crm" | "chat" | "finance";

export default function HeroAppFrame({ screen = "overview" }: { screen?: FrameScreen }) {
	const t = useTranslations("hero.frame");

	// Разделы ровно те, что в сайдбаре кабинета (components/crm/Sidebar/menuItems.ts)
	const NAV: Array<{ icon: typeof TbLayoutDashboard; label: string; group?: string; screen?: FrameScreen }> = [
		{ icon: TbLayoutDashboard, label: t("navOverview"), group: t("groupWorkspace") },
		{ icon: TbLayoutGrid, label: t("navCollab"), group: t("groupCollab") },
		{ icon: TbAddressBook, label: t("navCrm"), screen: "crm", group: t("groupCustomers") },
		{ icon: TbBuildingSkyscraper, label: t("navCompany") },
		{ icon: TbCheckbox, label: t("navTasks"), group: t("groupOperations") },
		{ icon: TbCoin, label: t("navFinance"), screen: "finance" },
		{ icon: TbSpeakerphone, label: t("navMarketing") },
		{ icon: TbSettingsAutomation, label: t("navAutomation") },
		{ icon: TbArrowUpCircle, label: t("navPlan"), group: t("groupAdmin") },
		{ icon: TbSettings, label: t("navSettings") },
	];

	const STEPS = [t("step1"), t("step2"), t("step3")];
	const CHECKS = [t("check1"), t("check2"), t("check3")];

	return (
		<div className="rounded-16 border border-inkLine bg-[#0B0D0C] p-6 shadow-[0_28px_70px_rgba(0,0,0,0.55)]">
			{/* Шапка окна браузера и верхняя панель кабинета */}
			<div className="flex items-center gap-8 px-6 pb-8 pt-2">
				<span className="flex gap-3">
					{[0, 1, 2].map((i) => (
						<span key={i} className="h-7 w-7 rounded-50 bg-[rgba(255,255,255,0.14)]" />
					))}
				</span>
				<span className="ml-6 flex h-20 items-center gap-6 rounded-50 border border-inkLine px-10 text-9 text-[#9AA396]">
					<BrandMark size={12} />
					firmspace.de/crm
				</span>
				<span className="ml-auto flex h-20 w-20 items-center justify-center rounded-50 border border-inkLine text-9 text-[#9AA396]">F</span>
			</div>

			<div className="flex overflow-hidden rounded-12 border border-inkLine">
				{/* Сайдбар: те же группы и подписи, что в приложении */}
				<div className="hidden w-150 shrink-0 flex-col border-r border-inkLine bg-[#101412] p-6 sm:flex">
					<span className="flex items-center gap-6 px-6 pb-8 pt-4">
						<BrandMark size={16} />
						<span className="text-10 font-semibold text-[#f1f4ee]">Firmspace AI</span>
					</span>

					{NAV.map(({ icon: Icon, label, group, screen: target }) => {
						const active = screen === target || (screen === "overview" && label === t("navOverview"));
						return (
							<React.Fragment key={label}>
								{group && <span className="px-6 pb-3 pt-8 text-7 font-semibold uppercase tracking-[0.14em] text-[#8C948B]">{group}</span>}
								<span
									className={`flex h-24 items-center gap-6 rounded-7 border px-6 text-9 font-medium ${
										active ? "border-[rgba(198,255,77,0.55)] bg-[rgba(198,255,77,0.10)] text-[#f1f4ee]" : "border-transparent text-[#cfd4cb]"
									}`}>
									<Icon size={11} className={active ? "text-[#c6ff4d]" : "text-[#8C948B]"} />
									{label}
								</span>
							</React.Fragment>
						);
					})}
				</div>

				{/* Содержимое: три реальных экрана кабинета */}
				<div className="min-w-0 flex-1 bg-[#131715] p-10">
					<p className="fs-eyebrow mb-4 text-8">{t(`screen_${screen}_eyebrow`)}</p>
					<p className="mb-8 text-12 font-semibold text-[#f1f4ee]">{t(`screen_${screen}_title`)}</p>

					{screen === "overview" && <OverviewScreen t={t} />}
					{screen === "crm" && <CrmScreen t={t} />}
					{screen === "chat" && <ChatScreen t={t} />}
					{screen === "finance" && <FinanceScreen t={t} />}

					{/* Нижний ряд — пояснение, как это работает */}
					<div className="mt-6 grid gap-6 lg:grid-cols-2">
						<div className="rounded-10 border border-inkLine bg-[rgba(255,255,255,0.02)] p-8">
							<div className="flex items-center justify-between gap-8">
								<p className="text-9 font-semibold text-[#f1f4ee]">{t("flowTitle")}</p>
								<span className="rounded-50 border border-[rgba(198,255,77,0.3)] px-6 py-[2px] text-7 text-[#c6ff4d]">{t("example")}</span>
							</div>
							<div className="mt-5 flex flex-col gap-3">
								{STEPS.map((step, i) => (
									<span key={step} className="flex items-center gap-5 rounded-7 border border-inkLine px-5 py-4 text-8 text-[#cfd4cb]">
										<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-4 bg-[rgba(198,255,77,0.14)] text-7 font-semibold text-[#c6ff4d]">{i + 1}</span>
										{step}
									</span>
								))}
							</div>
						</div>
						<div className="rounded-10 border border-inkLine bg-[rgba(255,255,255,0.02)] p-8">
							<p className="text-9 font-semibold text-[#f1f4ee]">{t("checksTitle")}</p>
							<div className="mt-5 flex flex-col gap-3">
								{CHECKS.map((check, i) => (
									<span key={check} className="flex items-center gap-5 rounded-7 border border-inkLine px-5 py-4 text-8 text-[#cfd4cb]">
										<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-50 bg-[rgba(255,255,255,0.06)] text-7 font-semibold text-[#8C948B]">{i + 1}</span>
										{check}
									</span>
								))}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

type T = (key: string) => string;

// --- экраны -------------------------------------------------------------------------------------------

// Übersicht: полоска недели, задачи на день и показатели периода
function OverviewScreen({ t }: { t: T }) {
	const days = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
	return (
		<div>
			<div className="rounded-10 border border-inkLine bg-[rgba(255,255,255,0.02)] p-8">
				<div className="flex items-center justify-between text-8 text-[#8C948B]">
					<span>{t("dashProgress")}</span>
					<span className="text-[#c6ff4d]">{t("dashDate")}</span>
				</div>
				<div className="mt-5 h-4 overflow-hidden rounded-50 bg-[rgba(255,255,255,0.08)]">
					<div className="h-full w-[60%] rounded-50 bg-[#c6ff4d]" />
				</div>
				<div className="mt-6 flex gap-4">
					{days.map((d, i) => (
						<span
							key={d}
							className={`flex h-34 flex-1 flex-col items-center justify-center rounded-7 border text-7 leading-tight ${
								i === 3 ? "border-[#c6ff4d] bg-[#c6ff4d] text-[#0a0c0b]" : "border-inkLine text-[#8C948B]"
							}`}>
							{d}
							<span className="text-9">{26 + i}</span>
						</span>
					))}
				</div>
			</div>

			<div className="mt-6 grid gap-6 md:grid-cols-2">
				<div className="rounded-10 border border-inkLine bg-[rgba(255,255,255,0.02)] p-8">
					<p className="mb-5 text-9 font-semibold text-[#f1f4ee]">{t("dashTasks")}</p>
					{[
						{ title: t("dashTask1"), who: t("dashTask1Who"), done: true },
						{ title: t("dashTask2"), who: t("dashTask2Who"), done: false },
						{ title: t("dashTask3"), who: t("dashTask3Who"), done: false },
					].map((task) => (
						<span key={task.title} className="mb-3 flex items-center gap-5 rounded-7 border border-inkLine px-6 py-4">
							<span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-4 border ${task.done ? "border-[#c6ff4d] bg-[#c6ff4d]" : "border-[rgba(255,255,255,0.2)]"}`}>
								{task.done && <TbCheck size={8} className="text-[#0a0c0b]" />}
							</span>
							<span className="min-w-0">
								<span className={`block truncate text-8 ${task.done ? "text-[#8C948B] line-through" : "text-[#f1f4ee]"}`}>{task.title}</span>
								<span className="block truncate text-7 text-[#8C948B]">{task.who}</span>
							</span>
						</span>
					))}
				</div>

				<div className="rounded-10 border border-inkLine bg-[rgba(255,255,255,0.02)] p-8">
					<p className="mb-5 text-9 font-semibold text-[#f1f4ee]">{t("dashDeals")}</p>
					{/* столбики закрытых сделок по неделям периода */}
					<div className="flex h-60 items-end gap-6">
						{[30, 55, 20, 80, 45, 95, 60, 35].map((h, i) => (
							<span key={i} className="flex-1 rounded-t-4 bg-[#c6ff4d]" style={{ height: `${h}%`, opacity: 0.35 + (h / 100) * 0.65 }} />
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

// CRM: воронка продаж с карточками сделок
function CrmScreen({ t }: { t: T }) {
	const stages = [
		{ name: t("crmStage1"), color: "#6FA1DA", deals: [t("crmDeal1"), t("crmDeal2")] },
		{ name: t("crmStage2"), color: "#7FD12F", deals: [t("crmDeal3")] },
		{ name: t("crmStage3"), color: "#E9A13B", deals: [t("crmDeal4"), t("crmDeal5")] },
	];
	return (
		<div className="grid grid-cols-3 gap-6">
			{stages.map((stage) => (
				<div key={stage.name}>
					<div className="mb-5 flex items-center justify-between rounded-7 px-7 py-5" style={{ backgroundColor: stage.color }}>
						<span className="text-8 font-semibold text-[#0a0c0b]">{stage.name}</span>
						<span className="text-7 text-[rgba(10,12,11,0.7)]">{stage.deals.length}</span>
					</div>
					{stage.deals.map((deal) => (
						<div key={deal} className="mb-4 rounded-8 border border-inkLine bg-[rgba(255,255,255,0.02)] p-7">
							<p className="truncate text-8 font-medium text-[#f1f4ee]">{deal}</p>
							<p className="mt-3 truncate text-7 text-[#8C948B]">{t("crmOwner")}</p>
						</div>
					))}
				</div>
			))}
		</div>
	);
}

// Zusammenarbeit: переписка с клиентом в подключённом канале
function ChatScreen({ t }: { t: T }) {
	return (
		<div className="flex flex-col gap-5 rounded-10 border border-inkLine bg-[rgba(255,255,255,0.02)] p-8">
			<div className="flex items-center gap-6 border-b border-inkLine pb-6">
				<span className="flex h-18 w-18 items-center justify-center rounded-50 bg-[rgba(198,255,77,0.14)] text-7 font-semibold text-[#c6ff4d]">AM</span>
				<span className="min-w-0">
					<span className="block truncate text-8 font-medium text-[#f1f4ee]">{t("chatName")}</span>
					<span className="block truncate text-7 text-[#8C948B]">Telegram</span>
				</span>
			</div>
			<span className="max-w-[75%] rounded-10 rounded-tl-4 border border-inkLine px-7 py-5 text-8 text-[#cfd4cb]">{t("chatIn1")}</span>
			<span className="ml-auto max-w-[75%] rounded-10 rounded-tr-4 bg-[rgba(198,255,77,0.14)] px-7 py-5 text-8 text-[#f1f4ee]">{t("chatOut1")}</span>
			<span className="max-w-[75%] rounded-10 rounded-tl-4 border border-inkLine px-7 py-5 text-8 text-[#cfd4cb]">{t("chatIn2")}</span>
			<span className="ml-auto max-w-[75%] rounded-10 rounded-tr-4 bg-[rgba(198,255,77,0.14)] px-7 py-5 text-8 text-[#f1f4ee]">{t("chatOut2")}</span>
		</div>
	);
}

// Finanzen: список счетов со статусами
function FinanceScreen({ t }: { t: T }) {
	const rows = [
		{ number: "RE-2026-18", client: t("finClient1"), sum: "2.380,00 €", status: t("finPaid"), paid: true },
		{ number: "RE-2026-19", client: t("finClient2"), sum: "890,00 €", status: t("finOpen"), paid: false },
		{ number: "RE-2026-20", client: t("finClient3"), sum: "1.150,00 €", status: t("finOverdue"), paid: false },
	];
	return (
		<div className="overflow-hidden rounded-10 border border-inkLine">
			{rows.map((row) => (
				<div key={row.number} className="flex items-center gap-8 border-b border-inkLine px-8 py-7 last:border-b-0">
					<span className="w-[70px] shrink-0 text-8 text-[#8C948B]">{row.number}</span>
					<span className="min-w-0 flex-1 truncate text-8 text-[#f1f4ee]">{row.client}</span>
					<span className="shrink-0 text-8 text-[#cfd4cb]">{row.sum}</span>
					<span
						className={`shrink-0 rounded-50 border px-6 py-[2px] text-7 ${
							row.paid ? "border-[rgba(198,255,77,0.4)] text-[#c6ff4d]" : "border-inkLine text-[#8C948B]"
						}`}>
						{row.status}
					</span>
				</div>
			))}
		</div>
	);
}
