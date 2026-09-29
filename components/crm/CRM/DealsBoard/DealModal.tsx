"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { Deal, DealUpdate, useCrmStore } from "@/store/useCrmStore";
import { useContactStore } from "@/store/useContactStore";
import { useCompaniesStore } from "@/store/useCompaniesStore";
import Modal from "../../shared/Modal";
import ConfirmDialog from "../../shared/ConfirmDialog";
import ActivityComposer, { ComposerTab } from "../../shared/ActivityComposer";
import ActivityTimeline from "../../shared/ActivityTimeline";
import DealQuotes from "./DealQuotes";
import DealHeader from "./dealModalParts/DealHeader";
import StageArrows from "./dealModalParts/StageArrows";
import MoreCard from "./dealModalParts/MoreCard";
import AboutCard from "./dealModalParts/AboutCard";
import RecurringCard from "./dealModalParts/RecurringCard";
import { EMPTY_ABOUT, EMPTY_MORE } from "./dealModalParts/model";
import type { AboutDraft, MoreDraft, SectionKey } from "./dealModalParts/model";

interface Props {
	dealId: string | null;
	onClose: () => void;
}

// Карточка сделки («View Task»): слева разделы More / About Deal / Recurring Deal, справа лента активности.
// Здесь живут состояние и вызовы стора, разметка разделов — в dealModalParts.
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
	const [about, setAbout] = useState<AboutDraft>(EMPTY_ABOUT);
	const [moreEditing, setMoreEditing] = useState(false);
	const [more, setMore] = useState<MoreDraft>(EMPTY_MORE);
	const [recurringEditing, setRecurringEditing] = useState(false);
	const [recurring, setRecurring] = useState("");
	const [confirmSection, setConfirmSection] = useState<SectionKey | null>(null);
	const [confirmDelete, setConfirmDelete] = useState(false);

	// при открытии другой сделки подтягиваем данные и сбрасываем режимы редактирования;
	// зависит только от dealId — fetch* и setState стабильны, а лишний перезапуск дёргал бы сеть
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
	// Поэтому зависимости перечислены по полям, а не по объекту deal.
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

	function cancelTitle() {
		setTitleDraft(deal!.clientName);
		setTitleEditing(false);
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

	return (
		<>
			<Modal
				open={Boolean(found) && dealId !== null}
				onClose={onClose}
				align="top"
				label={deal.clientName}
				className="fs-popover fs-scroll my-[40px] w-full max-w-[1222px] p-20 md:p-40">
				<DealHeader
					name={deal.clientName}
					editing={titleEditing}
					draft={titleDraft}
					onDraft={setTitleDraft}
					onEdit={() => setTitleEditing(true)}
					onSave={saveTitle}
					onCancel={cancelTitle}
					onClose={onClose}
				/>

				<StageArrows stages={sortedStages} activeId={deal.stage} onPick={(stage) => save({ stage })} />

				<div className="grid grid-cols-1 gap-16 mp:grid-cols-[minmax(0,450px)_minmax(0,1fr)]">
					<div className="flex flex-col gap-16">
						<MoreCard
							deal={deal}
							editing={moreEditing}
							draft={more}
							onChange={setMore}
							onToggle={() => setMoreEditing(!moreEditing)}
							onSave={saveMore}
							onDeleteSection={() => setConfirmSection("more")}
						/>
						<AboutCard
							deal={deal}
							editing={aboutEditing}
							draft={about}
							onChange={setAbout}
							onToggle={() => setAboutEditing(!aboutEditing)}
							onSave={saveAbout}
							stages={sortedStages}
							contacts={contacts}
							companies={companies}
						/>

						<DealQuotes dealId={deal._id} customerName={deal.contactName || deal.clientName} contact={deal.contact ?? undefined} company={deal.company ?? undefined} />

						<RecurringCard
							deal={deal}
							editing={recurringEditing}
							value={recurring}
							onChange={setRecurring}
							onToggle={() => setRecurringEditing(!recurringEditing)}
							onSave={saveRecurring}
							onDeleteSection={() => setConfirmSection("recurring")}
						/>

						<button
							type="button"
							onClick={() => setConfirmDelete(true)}
							className="self-start text-13 text-[#eb5757] transition-opacity hover:opacity-80">
							{t("deleteDeal")}
						</button>
					</div>

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
