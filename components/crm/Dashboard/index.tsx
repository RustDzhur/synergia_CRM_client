"use client";
import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { useCollabHydration } from "@/store/useCollabStore";
import { useCrmStore } from "@/store/useCrmStore";
import { useFeature } from "@/store/useOrgStore";
import { useTaskStore } from "@/store/useTaskStore";
import { dayKey, localeTag } from "@/utils/dateHelpers";
import PageHeader from "@/components/crm/shared/PageHeader";
import WeekProgress from "./WeekProgress";
import TasksFeed from "./TasksFeed";
import DayEvents from "./DayEvents";
import DealsChart from "./DealsChart";
import TasksDonut from "./TasksDonut";
import AdsCard from "./AdsCard";
import FinanceCard from "./FinanceCard";

// Dashboard: сверху графики сеткой, ниже — задачи выбранного дня.
// Раньше графики стояли одним узким столбцом справа, из-за чего страница вытягивалась вниз,
// а слева оставалась пустота; на телефоне и планшете раскладка была нормальной.
export default function Dashboard() {
	const { stages, deals, fetchAll } = useCrmStore();
	const { tasks, isLoading, fetchTasks } = useTaskStore();
	const [selected, setSelected] = useState(() => dayKey(new Date()));
	// события календаря выбранного дня (сервер /api/events); раздел может быть закрыт тарифом фирмы
	const hasCollab = useFeature("collab");
	useCollabHydration(hasCollab);

	useEffect(() => {
		fetchAll();
		fetchTasks();
	}, [fetchAll, fetchTasks]);

	return (
		<div className="animate-fade-in px-16 py-20 md:px-24 md:py-24 lg:px-32">
			<PageHeader right={<span className="fs-chip">{new Date().toLocaleDateString(localeTag(useLocale()), { day: "numeric", month: "long", year: "numeric" })}</span>} />
			{/* Сверху — то, что требует внимания сегодня: деньги и календарь дня. Общая картина
			    (воронка сделок, задачи по статусам, реклама) стоит ниже: на неё смотрят реже,
			    а место на первом экране нужно тому, что горит. */}
			<div className="grid gap-16 md:grid-cols-2 lg:gap-20">
				<FinanceCard />
				{hasCollab && <DayEvents selected={selected} />}
			</div>
			{/* Дальше — сам день: выбор даты с загрузкой недели и список задач этого дня */}
			<div className="mt-16 grid gap-16 lg:mt-20 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-20">
				<WeekProgress tasks={tasks} selected={selected} onSelect={setSelected} />
				<TasksFeed tasks={tasks} selected={selected} isLoading={isLoading} />
			</div>
			{/* И только потом общая картина: сделки по этапам, задачи по статусам, реклама */}
			<div className="mt-16 grid gap-16 md:grid-cols-2 lg:mt-20 lg:grid-cols-3 lg:gap-20">
				<DealsChart deals={deals} stages={stages} />
				<TasksDonut tasks={tasks} />
				<AdsCard />
			</div>
		</div>
	);
}
