"use client";
import { useEffect, useId, useState } from "react";
import { apiCall } from "@/store/crmApi";
import FormField from "./FormField";

// Поле «Ответственный» с подсказкой имён сотрудников фирмы. Значение по-прежнему текст (можно ввести любое имя),
// но выбранное из списка имя сервер однозначно сопоставляет с участником (lib/sync/people.ts): ему приходят
// уведомления о задаче и открывается закрытая сделка.
let cache: string[] | null = null;

export default function ResponsibleField({ label, value, onChange, wrapperClassName }: { label: string; value: string; onChange: (value: string) => void; wrapperClassName?: string }) {
	const id = useId();
	const [names, setNames] = useState<string[]>(cache ?? []);

	useEffect(() => {
		if (cache) return;
		void apiCall<{ id: string; name: string }[]>("/api/people").then((r) => {
			if (r.ok && r.data) { cache = r.data.map((p) => p.name); setNames(cache); }
		});
	}, []);

	return (
		<>
			<FormField label={label} value={value} onChange={(e) => onChange(e.target.value)} maxLength={100} list={id} autoComplete="off" wrapperClassName={wrapperClassName} />
			<datalist id={id}>{names.map((n) => <option key={n} value={n} />)}</datalist>
		</>
	);
}
