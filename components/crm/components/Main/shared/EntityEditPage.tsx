"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { Activity } from "@/app/types/crm";
import type { NewActivity } from "@/app/store/crmApi";
import Loader from "@/app/utils/Loader";
import FormField from "./FormField";
import ActivityComposer, { ComposerTab } from "./ActivityComposer";
import ActivityTimeline from "./ActivityTimeline";
import AiSummaryButton from "../../AiAssistant/AiSummaryButton";

export interface FieldDef {
	key: string;
	label: string;
	type?: "text" | "email" | "tel" | "url" | "date";
}

type Entity = { _id: string; activities?: Activity[] } & Record<string, any>;

interface Props<T extends Entity> {
	id: string; // id записи или "new"
	tab: "contacts" | "companies"; // куда возвращает «Back» и путь этой страницы
	titleEdit: string;
	titleNew: string;
	fields: FieldDef[];
	// какие поля обязательны (хотя бы одно из перечисленных должно быть заполнено)
	requiredAny: string[];
	// необязательно: подправить значения формы при загрузке (например, разбить старое полное имя на имя и фамилию)
	prepareForm?: (entity: T, form: Record<string, string>) => Record<string, string>;
	load: (id: string) => Promise<T | null>;
	create: (data: Record<string, string>) => Promise<T | null>;
	update: (id: string, data: Record<string, string>) => Promise<T | null>;
	addActivity: (id: string, activity: NewActivity) => Promise<T | null>;
	removeActivity: (id: string, activityId: string) => Promise<T | null>;
}

// Страница «Edit Contact» / «Edit Company»: слева форма с кнопками Back / Save, справа панель заметок
// (New Note / E-Mail / Call / New Activity / Create Task / Schedule) и лента записей.
export default function EntityEditPage<T extends Entity>({
	id, tab, titleEdit, titleNew, fields, requiredAny, prepareForm, load, create, update, addActivity, removeActivity,
}: Props<T>) {
	const t = useTranslations("crm");
	const locale = useLocale();
	const router = useRouter();
	const isNew = id === "new";

	const [entity, setEntity] = useState<T | null>(null);
	const [form, setForm] = useState<Record<string, string>>({});
	const [loading, setLoading] = useState(!isNew);
	const [saving, setSaving] = useState(false);
	const [missing, setMissing] = useState(false);

	const backHref = `/${locale}/crm/crm?tab=${tab}`;

	useEffect(() => {
		if (isNew) return;
		let cancelled = false;
		load(id).then((data) => {
			if (cancelled) return;
			if (!data) setMissing(true);
			else {
				setEntity(data);
				const initial = Object.fromEntries(fields.map((f) => [f.key, String(data[f.key] ?? "")]));
				setForm(prepareForm ? prepareForm(data, initial) : initial);
			}
			setLoading(false);
		});
		return () => { cancelled = true; };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [id]);

	async function save() {
		if (!requiredAny.some((k) => (form[k] ?? "").trim())) return toast.error(t("nameRequired"));
		setSaving(true);
		const data = Object.fromEntries(fields.map((f) => [f.key, (form[f.key] ?? "").trim()]));
		const saved = isNew ? await create(data) : await update(id, data);
		setSaving(false);
		if (!saved) return toast.error(t("error"));
		toast.success(t("saved"));
		if (isNew) router.replace(`/${locale}/crm/crm/${tab}/${saved._id}`);
		else setEntity(saved);
	}

	const tabs: ComposerTab[] = useMemo(
		() => [
			{ key: "note", label: t("newNote"), type: "note", mode: "area", placeholder: t("notePlaceholder") },
			{ key: "email", label: t("emailTab"), type: "email", mode: "area", placeholder: t("notePlaceholder") },
			{ key: "call", label: t("call"), type: "call", mode: "area", placeholder: t("notePlaceholder") },
			{ key: "activity", label: t("newActivity"), type: "activity", mode: "line", placeholder: t("thingsToDo"), withDate: true },
			{ key: "task", label: t("createTask"), type: "task", mode: "line", placeholder: t("thingsToDo") },
			{ key: "schedule", label: t("schedule"), type: "schedule", mode: "line", placeholder: t("thingsToDo"), withDate: true },
		],
		[t]
	);

	if (loading) {
		return (
			<div className="flex justify-center py-60">
				<Loader color="#5EA8F5" width="50" height="10" radius="9" />
			</div>
		);
	}

	if (missing) {
		return (
			<div className="p-30">
				<p className="mb-20 text-18 text-[#666666]">{t("notFound")}</p>
				<button type="button" onClick={() => router.push(backHref)} className="text-18 font-semibold text-primaryColor">
					{t("back")}
				</button>
			</div>
		);
	}

	return (
		<div className="grid animate-fade-in grid-cols-1 gap-30 p-16 md:p-30 mp:grid-cols-[300px_minmax(0,1fr)]">
			<form
				onSubmit={(e) => {
					e.preventDefault();
					save();
				}}>
				<div className="mb-16 flex flex-wrap items-center justify-between gap-12">
					<h1 className="text-24 font-medium text-black">{isNew ? titleNew : titleEdit}</h1>
					{!isNew && entity && <AiSummaryButton kind={tab === "contacts" ? "contact" : "company"} name={String(entity.name ?? "")} />}
				</div>
				<div className="flex flex-col gap-16">
					{fields.map((f) => (
						<FormField
							key={f.key}
							label={f.label}
							type={f.type ?? "text"}
							value={form[f.key] ?? ""}
							onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
							maxLength={200}
						/>
					))}
				</div>
				<div className="mt-40 flex items-center justify-between gap-16">
					<button
						type="button"
						onClick={() => router.push(backHref)}
						className="flex-1 py-12 text-18 font-semibold text-[#999999] transition-colors hover:text-black">
						{t("back")}
					</button>
					<button
						type="submit"
						disabled={saving}
						className="h-[50px] flex-1 rounded-4 bg-primaryColor text-18 font-semibold text-white shadow-custom transition-opacity hover:opacity-80 disabled:opacity-60">
						{t("save")}
					</button>
				</div>
			</form>

			<div className="min-w-0">
				{isNew || !entity ? (
					<p className="rounded-16 bg-[#F5F7FC] p-24 text-16 text-[#999999]">{t("saveFirst")}</p>
				) : (
					<>
						<ActivityComposer
							tabs={tabs}
							submitLabel={t("save")}
							onSubmit={async (a) => {
								const updated = await addActivity(entity._id, a);
								if (updated) setEntity(updated);
								else toast.error(t("error"));
							}}
						/>
						<div className="mt-24">
							<ActivityTimeline
								activities={entity.activities ?? []}
								onDelete={async (activityId) => {
									const updated = await removeActivity(entity._id, activityId);
									if (updated) setEntity(updated);
								}}
							/>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
