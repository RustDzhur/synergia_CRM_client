"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbPencil, TbX } from "react-icons/tb";
import { Deal, DealUpdate, useCrmStore } from "@/store/useCrmStore";
import { useContactStore } from "@/store/useContactStore";
import { useCompaniesStore } from "@/store/useCompaniesStore";
import { formatDate } from "@/utils/crmFormat";
import { stageColor } from "@/utils/stageColors";
import Modal from "../../shared/Modal";
import ConfirmDialog from "../../shared/ConfirmDialog";
import FormField, { fieldClass } from "../../shared/FormField";
import SuggestInput, { SuggestOption } from "../../shared/SuggestInput";
import ActivityComposer, { ComposerTab } from "../../shared/ActivityComposer";
import ActivityTimeline from "../../shared/ActivityTimeline";
import AiSummaryButton from "../../../AiAssistant/AiSummaryButton";
import DealQuotes from "./DealQuotes";

interface Props {
	dealId: string | null;
	onClose: () => void;
}

type SectionKey = "more" | "recurring";

// --- вспомогательные элементы разметки (на уровне модуля, чтобы не пересоздаваться при каждом рендере) ---
function Card({ children }: { children: React.ReactNode }) {
	return <section className="fs-card overflow-hidden">{children}</section>;
}

function CardHeader({ title, action, onAction }: { title: string; action: string; onAction: () => void }) {
	return (
		<header className="flex items-center justify-between border-b border-inkLine px-16 py-12">
			<h3 className="text-14 font-semibold text-[#f1f4ee]">{title}</h3>
			<button type="button" onClick={onAction} className="text-12 text-[#8c948b] transition-colors hover:text-[#c6ff4d]">
				{action}
			</button>
		</header>
	);
}

function Row({ label, children, accent }: { label: string; children: React.ReactNode; accent?: boolean }) {
	return (
		<div className="mb-12 last:mb-0">
			<p className="text-12 text-[#8c948b]">{label}</p>
			<p className={`mt-6 text-15 font-semibold ${accent ? "text-[#c6ff4d]" : "text-[#f1f4ee]"}`}>{children || "—"}</p>
		</div>
	);
}

function SectionFooter({ onDelete }: { onDelete: () => void }) {
	const t = useTranslations("crm");
	return (
		<footer className="flex flex-wrap items-center justify-between gap-x-16 gap-y-6 border-t border-inkLine px-16 py-12 text-12">
			<div className="flex gap-14 whitespace-nowrap text-[#9AA396]">
				<button type="button" disabled title={t("soon")} className="cursor-not-allowed opacity-60">{t("selectField")}</button>
				<button type="button" disabled title={t("soon")} className="cursor-not-allowed opacity-60">{t("createField")}</button>
			</div>
			<button type="button" onClick={onDelete} className="text-[#8c948b] underline transition-colors hover:text-[#f1f4ee]">
				{t("deleteSection")}
			</button>
		</footer>
	);
}

function SaveRow({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
	const t = useTranslations("crm");
	return (
		<div className="mt-14 flex items-center justify-end gap-10">
			<button type="button" onClick={onCancel} className="px-12 py-8 text-12 text-[#8c948b] transition-colors hover:text-[#f1f4ee]">{t("cancel")}</button>
			<button type="button" onClick={onSave} className="fs-btn fs-btn-primary h-34">
				{t("save")}
			</button>
		</div>
	);
}

// Карточка сделки («View Task»): слева разделы More / About Deal / Recurring Deal, справа лента активности.
export default function DealModal({ dealId, onClose }: Props) {
	const t = useTranslations("crm");
	const { deals, stages, updateDeal, deleteDeal, addActivity, removeActivity } = useCrmStore();
	const { contacts, fetchContacts } = useContactStore();
	const { companies, fetchCompanies } = useCompaniesStore();

	// пока окно закрывается, сделка может уже исчезнуть из стора (удаление) — держим последнюю версию
	const lastRef = useRef<Deal>();
	const found = deals.find((d) => d._id === dealId);
	if (found) lastRef.current = found;
	const deal = found ?? lastRef.current;

	const sortedStages = useMemo(() => [...stages].sort((a, b) => a.order - b.order), [stages]);

	const [titleEditing, setTitleEditing] = useState(false);
	const [titleDraft, setTitleDraft] = useState("");
	const [aboutEditing, setAboutEditing] = useState(true);
	const [about, setAbout] = useState({ clientName: "", stage: "", startDate: "", contactName: "", companyName: "", contact: "", company: "" });
	const [moreEditing, setMoreEditing] = useState(false);
	const [more, setMore] = useState({ dealType: "", responsible: "", availableToAll: true, utm: "" });
	const [recurringEditing, setRecurringEditing] = useState(false);
	const [recurring, setRecurring] = useState("");
	const [confirmSection, setConfirmSection] = useState<SectionKey | null>(null);
	const [confirmDelete, setConfirmDelete] = useState(false);

	// при открытии другой сделки подтягиваем данные и сбрасываем режимы редактирования
	useEffect(() => {
		if (!dealId) return;
		fetchContacts();
		fetchCompanies();
		setTitleEditing(false);
		setAboutEditing(true);
		setMoreEditing(false);
		setRecurringEditing(false);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [dealId]);

	// Черновики подтягивают данные сделки только когда меняются сами поля (сохранение, перенос стрелкой,
	// другая сделка) — а не при добавлении записей в ленту, иначе набранный текст сбрасывался бы.
	useEffect(() => {
		if (deal) setTitleDraft(deal.clientName);
	}, [deal?._id, deal?.clientName]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (!deal) return;
		setAbout({
			clientName: deal.clientName,
			stage: deal.stage,
			startDate: deal.startDate ?? "",
			contactName: deal.contactName ?? "",
			companyName: deal.companyName ?? "",
			contact: deal.contact ?? "",
			company: deal.company ?? "",
		});
	}, [deal?._id, deal?.clientName, deal?.stage, deal?.startDate, deal?.contactName, deal?.companyName, deal?.contact, deal?.company]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (!deal) return;
		setMore({
			dealType: deal.dealType ?? "",
			responsible: deal.responsible ?? "",
			availableToAll: deal.availableToAll ?? true,
			utm: deal.utm ?? "",
		});
	}, [deal?._id, deal?.dealType, deal?.responsible, deal?.availableToAll, deal?.utm]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (deal) setRecurring(deal.recurring ?? "");
	}, [deal?._id, deal?.recurring]); // eslint-disable-line react-hooks/exhaustive-deps

	const contactOptions = useMemo<SuggestOption[]>(() => {
		const q = about.contactName.toLowerCase();
		return contacts
			.filter((c) => !q || [c.name, c.phone, c.email].some((v) => v?.toLowerCase().includes(q)))
			.map((c) => ({ key: c._id, title: c.name, lines: [c.phone ?? "", c.email ?? ""] }));
	}, [contacts, about.contactName]);

	const companyOptions = useMemo<SuggestOption[]>(() => {
		const q = about.companyName.toLowerCase();
		return companies
			.filter((c) => !q || [c.name, c.email].some((v) => v?.toLowerCase().includes(q)))
			.map((c) => ({ key: c._id, title: c.name, lines: [c.email ?? ""] }));
	}, [companies, about.companyName]);

	if (!deal) return null;

	async function save(patch: DealUpdate) {
		const updated = await updateDeal(deal!._id, patch);
		if (!updated) toast.error(t("error"));
		return Boolean(updated);
	}

	async function saveTitle() {
		setTitleEditing(false);
		const name = titleDraft.trim();
		if (name && name !== deal!.clientName) await save({ clientName: name });
		else setTitleDraft(deal!.clientName);
	}

	async function saveAbout() {
		if (!about.clientName.trim()) return toast.error(t("nameRequired"));
		if (await save(about)) setAboutEditing(false);
	}

	async function saveMore() {
		if (await save(more)) setMoreEditing(false);
	}

	async function saveRecurring() {
		if (await save({ recurring })) setRecurringEditing(false);
	}

	async function clearSection() {
		const section = confirmSection;
		setConfirmSection(null);
		if (section === "more") await save({ dealType: "", responsible: "", utm: "", availableToAll: true });
		if (section === "recurring") await save({ recurring: "" });
	}

	async function removeDeal() {
		setConfirmDelete(false);
		onClose();
		await deleteDeal(deal!._id);
	}

	const tabs: ComposerTab[] = [
		{ key: "activity", label: t("tabActivity"), type: "activity", mode: "line", placeholder: t("thingsToDo"), withDate: true },
		{ key: "comment", label: t("tabComment"), type: "comment", mode: "area", placeholder: t("commentPlaceholder") },
		{ key: "task", label: t("tabTask"), type: "task", mode: "line", placeholder: t("thingsToDo") },
		{ key: "sms", label: t("tabSms"), type: "sms", mode: "area", placeholder: t("commentPlaceholder") },
		{ key: "whatsapp", label: t("tabWhatsapp"), type: "whatsapp", mode: "area", placeholder: t("commentPlaceholder") },
		{ key: "telegram", label: t("tabTelegram"), type: "telegram", mode: "area", placeholder: t("commentPlaceholder") },
		{ key: "email", label: t("tabEmail"), type: "email", mode: "area", placeholder: t("commentPlaceholder") },
	];

	const currentStage = stages.find((s) => s._id === deal.stage);
	const recurringLabels: Record<string, string> = {
		"": t("noSelection"), daily: t("recurDaily"), weekly: t("recurWeekly"), monthly: t("recurMonthly"), yearly: t("recurYearly"),
	};
	const yesNo = (v: boolean) => (v ? t("yes") : t("no"));

	return (
		<>
			<Modal
				open={Boolean(found) && dealId !== null}
				onClose={onClose}
				align="top"
				label={deal.clientName}
				className="fs-popover fs-scroll my-[40px] w-full max-w-[1222px] p-20 md:p-40">
				{/* заголовок и закрытие */}
				<div className="mb-20 flex items-center justify-between gap-16">
					<div className="flex min-w-0 items-center gap-12">
						{titleEditing ? (
							<input
								autoFocus
								value={titleDraft}
								onChange={(e) => setTitleDraft(e.target.value)}
								onBlur={saveTitle}
								onKeyDown={(e) => {
									if (e.key === "Enter") saveTitle();
									if (e.key === "Escape") {
										setTitleDraft(deal.clientName);
										setTitleEditing(false);
									}
								}}
								maxLength={200}
								className="fs-field min-w-0 px-10 py-6 text-16 outline-none md:text-20"
							/>
						) : (
							<>
								<h2 className="truncate text-18 font-semibold text-[#f1f4ee] md:text-20">{deal.clientName}</h2>
								<button
									type="button"
									aria-label={t("edit")}
									onClick={() => setTitleEditing(true)}
									className="shrink-0 text-[#8c948b] transition-colors hover:text-[#c6ff4d]">
									<TbPencil size={18} />
								</button>
							</>
						)}
					</div>
					<div className="flex shrink-0 items-center gap-16">
						<AiSummaryButton kind="deal" name={deal.clientName} />
						<button type="button" onClick={onClose} aria-label={t("close")} className="shrink-0 text-[#8c948b] transition-colors hover:text-[#f1f4ee]">
							<TbX size={24} />
						</button>
					</div>
				</div>

				{/* стрелки стадий: клик переносит сделку в стадию */}
				<div className="fs-scroll mb-20 flex overflow-x-auto pb-6">
					{sortedStages.map((stage, index) => {
						const active = stage._id === deal.stage;
						return (
							<button
								key={stage._id}
								type="button"
								onClick={() => !active && save({ stage: stage._id })}
								aria-pressed={active}
								style={{
									backgroundColor: stageColor(stage.color, index),
									clipPath: "polygon(0 0, calc(100% - 22px) 0, 100% 50%, calc(100% - 22px) 100%, 0 100%)",
								}}
								className={`h-[54px] w-[170px] shrink-0 px-16 text-12 font-semibold md:w-[222px] md:px-24 md:text-13 text-white transition-opacity duration-200 ${
									active ? "opacity-100" : "opacity-60 hover:opacity-80"
								}`}>
								<span className="block truncate">{stage.name}</span>
							</button>
						);
					})}
				</div>

				<div className="grid grid-cols-1 gap-16 mp:grid-cols-[minmax(0,450px)_minmax(0,1fr)]">
					{/* левая колонка */}
					<div className="flex flex-col gap-16">
						<Card>
							<CardHeader
								title={t("more")}
								action={moreEditing ? t("cancel") : t("edit")}
								onAction={() => setMoreEditing(!moreEditing)}
							/>
							<div className="px-16 py-14">
								{moreEditing ? (
									<>
										<FormField label={t("dealType")} value={more.dealType} onChange={(e) => setMore({ ...more, dealType: e.target.value })} wrapperClassName="mb-12" />
										<label className="mb-12 block">
											<span className="mb-6 block text-12 text-[#8c948b]">{t("availableToAll")}</span>
											<select
												value={more.availableToAll ? "yes" : "no"}
												onChange={(e) => setMore({ ...more, availableToAll: e.target.value === "yes" })}
												className={fieldClass}>
												<option value="yes">{t("yes")}</option>
												<option value="no">{t("no")}</option>
											</select>
										</label>
										<FormField label={t("responsible")} value={more.responsible} onChange={(e) => setMore({ ...more, responsible: e.target.value })} wrapperClassName="mb-12" />
										<FormField label={t("utm")} value={more.utm} onChange={(e) => setMore({ ...more, utm: e.target.value })} />
										<SaveRow onSave={saveMore} onCancel={() => setMoreEditing(false)} />
									</>
								) : (
									<>
										<Row label={t("dealType")}>{deal.dealType}</Row>
										<Row label={t("startDate")}>{formatDate(deal.startDate)}</Row>
										<Row label={t("availableToAll")}>{yesNo(deal.availableToAll ?? true)}</Row>
										<Row label={t("responsible")} accent>{deal.responsible}</Row>
										<Row label={t("utm")}>{deal.utm || t("none")}</Row>
									</>
								)}
							</div>
							<SectionFooter onDelete={() => setConfirmSection("more")} />
						</Card>

						<Card>
							<CardHeader
								title={t("aboutDeal")}
								action={aboutEditing ? t("cancel") : t("edit")}
								onAction={() => setAboutEditing(!aboutEditing)}
							/>
							<div className="px-16 py-14">
								{aboutEditing ? (
									<>
										<FormField
											label={t("taskName")}
											value={about.clientName}
											onChange={(e) => setAbout({ ...about, clientName: e.target.value })}
											maxLength={200}
											wrapperClassName="mb-12"
										/>
										<label className="mb-12 block">
											<span className="mb-6 block text-12 text-[#8c948b]">{t("stage")}</span>
											<select
												value={about.stage}
												onChange={(e) => setAbout({ ...about, stage: e.target.value })}
												className={fieldClass}>
												{sortedStages.map((s) => (
													<option key={s._id} value={s._id}>{s.name}</option>
												))}
											</select>
										</label>
										<FormField
											label={t("startDate")}
											type="date"
											value={about.startDate}
											onChange={(e) => setAbout({ ...about, startDate: e.target.value })}
											wrapperClassName="mb-16"
										/>
										<div className="-mx-16 rounded-10 bg-[rgba(255,255,255,0.03)] px-16 py-14">
											<p className="mb-10 text-12 font-medium text-[#8c948b]">{t("client")}</p>
											<span className="mb-6 block text-12 text-[#8c948b]">{t("contact")}</span>
											<SuggestInput
												value={about.contactName}
												onChange={(text) => setAbout({ ...about, contactName: text, contact: "" })}
												onPick={(o) => {
													const picked = contacts.find((c) => c._id === o.key);
													setAbout({ ...about, contactName: o.title, contact: o.key, companyName: about.companyName || picked?.company || "" });
												}}
												options={contactOptions}
												placeholder={t("contactSearchPlaceholder")}
												showSearchIcon
											/>
											<button
												type="button"
												onClick={() => setAbout({ ...about, contactName: about.contactName ? `${about.contactName}, ` : "", contact: "" })}
												className="my-8 block text-12 text-[#c6ff4d] transition-opacity hover:opacity-80">
												{t("addParticipant")}
											</button>
											<span className="mb-6 block text-12 text-[#8c948b]">{t("company")}</span>
											<SuggestInput
												value={about.companyName}
												onChange={(text) => setAbout({ ...about, companyName: text, company: "" })}
												onPick={(o) => setAbout({ ...about, companyName: o.title, company: o.key })}
												options={companyOptions}
												placeholder={t("companySearchPlaceholder")}
												showSearchIcon
											/>
										</div>
										<SaveRow onSave={saveAbout} onCancel={() => setAboutEditing(false)} />
									</>
								) : (
									<>
										<Row label={t("taskName")}>{deal.clientName}</Row>
										<Row label={t("stage")}>{currentStage?.name}</Row>
										<Row label={t("startDate")}>{formatDate(deal.startDate)}</Row>
										<Row label={t("contact")}>{deal.contactName}</Row>
										<Row label={t("company")}>{deal.companyName}</Row>
									</>
								)}
							</div>
						</Card>

						<DealQuotes dealId={deal._id} customerName={deal.contactName || deal.clientName} contact={deal.contact ?? undefined} company={deal.company ?? undefined} />

						<Card>
							<CardHeader
								title={t("recurringDeal")}
								action={recurringEditing ? t("cancel") : t("edit")}
								onAction={() => setRecurringEditing(!recurringEditing)}
							/>
							<div className="px-16 py-14">
								{recurringEditing ? (
									<>
										<label className="block">
											<span className="mb-6 block text-12 text-[#8c948b]">{t("recurringDeal")}</span>
											<select value={recurring} onChange={(e) => setRecurring(e.target.value)} className={fieldClass}>
												{Object.entries(recurringLabels).map(([value, label]) => (
													<option key={value} value={value}>{label}</option>
												))}
											</select>
										</label>
										<SaveRow onSave={saveRecurring} onCancel={() => setRecurringEditing(false)} />
									</>
								) : (
									<Row label={t("recurringDeal")}>{recurringLabels[deal.recurring ?? ""] ?? deal.recurring}</Row>
								)}
							</div>
							<SectionFooter onDelete={() => setConfirmSection("recurring")} />
						</Card>

						<button
							type="button"
							onClick={() => setConfirmDelete(true)}
							className="self-start text-13 text-[#eb5757] transition-opacity hover:opacity-80">
							{t("deleteDeal")}
						</button>
					</div>

					{/* правая колонка: ввод и лента */}
					<div className="min-w-0">
						<ActivityComposer tabs={tabs} submitLabel={t("send")} onSubmit={(a) => addActivity(deal._id, a)} />
						<ActivityTimeline
							withFilter
							activities={deal.activities ?? []}
							onDelete={(id) => removeActivity(deal._id, id)}
						/>
					</div>
				</div>
			</Modal>

			<ConfirmDialog
				open={confirmSection !== null}
				title={t("deleteSectionTitle")}
				text={t("deleteSectionText")}
				onCancel={() => setConfirmSection(null)}
				onConfirm={clearSection}
			/>
			<ConfirmDialog
				open={confirmDelete}
				title={t("deleteDeal")}
				text={t("deleteDealText")}
				onCancel={() => setConfirmDelete(false)}
				onConfirm={removeDeal}
			/>
		</>
	);
}
