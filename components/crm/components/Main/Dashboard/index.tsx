"use client";
import React, { useEffect, useState } from "react";
import { useCrmStore } from "@/app/store/useCrmStore";
import { useTaskStore } from "@/app/store/useTaskStore";
import { dayKey } from "@/app/utils/dateHelpers";
import WeekProgress from "./WeekProgress";
import TasksFeed from "./TasksFeed";
import DealsChart from "./DealsChart";
import TasksDonut from "./TasksDonut";
import AdsCard from "./AdsCard";
import FinanceCard from "./FinanceCard";

// Dashboard: слева прогресс за день и лента задач, справа графики сделок и задач.
export default function Dashboard() {
	const { stages, deals, fetchAll } = useCrmStore();
	const { tasks, isLoading, fetchTasks } = useTaskStore();
	const [selected, setSelected] = useState(() => dayKey(new Date()));

	useEffect(() => {
		fetchAll();
		fetchTasks();
	}, [fetchAll, fetchTasks]);

	return (
		<div className="grid animate-fade-in gap-30 p-16 md:p-30 lg:grid-cols-[minmax(0,1fr)_440px]">
			<div className="flex min-w-0 flex-col gap-30">
				<WeekProgress tasks={tasks} selected={selected} onSelect={setSelected} />
				<TasksFeed tasks={tasks} selected={selected} isLoading={isLoading} />
			</div>
			<div className="grid content-start gap-30 md:grid-cols-2 lg:grid-cols-1">
				<DealsChart deals={deals} stages={stages} />
				<TasksDonut tasks={tasks} />
				<FinanceCard />
				<AdsCard />
			</div>
		</div>
	);
}
