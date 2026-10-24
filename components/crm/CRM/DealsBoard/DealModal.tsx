"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { Deal, DealUpdate, useCrmStore } from "@/store/useCrmStore";
import type { NewActivity } from "@/store/crmApi";
import { useContactStore } from "@/store/useContactStore";
import { useCompaniesStore } from "@/store/useCompaniesStore";
import { useTaskStore } from "@/store/useTaskStore";
import Modal from "../../shared/Modal";
import ConfirmDialog from "../../shared/ConfirmDialog";
import ActivityComposer, { ComposerTab } from "../../shared/ActivityComposer";
import ActivityTimeline from "../../shared/ActivityTimeline";
import DealDocuments from "./dealModalParts/DealDocuments";
import DealTasks from "./dealModalParts/DealTasks";
import CustomerOverview from "../../shared/CustomerOverview";
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
	const locale = useLocale();
	const { deals, stages, updateDeal, deleteDeal, addActivity, removeActivity, loadChannels, sendChannel, setWon } = useCrmStore();
	const { contacts, fetchContacts } = useContactStore();
	const { companies, fetchCompanies } = useCompaniesStore();
	const addTask = useTaskStore((s) => s.addTask);

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
	// Что можно отправить из карточки: сервер отвечает по каждому каналу — ready или причину отказа.
	// Пока ответа нет, вкладки работают и подсказки просто не показываются.
	const [channels, setChannels] = useState<Record<string, { state: string; connected: boolean; from?: string }>>({});

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
		// доступность каналов: от неё зависят подсказки под вкладками SMS / Viber / Telegram / E-Mail
		loadChannels(dealId).then(setChannels);
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
	// разделы, убранные с карточки кнопкой «Удалить раздел» (см. SectionFooter)
	const hidden: string[] = deal.hiddenSections ?? [];

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

	// «Удалить раздел»: данные раздела очищаются, а сам блок убирается с карточки. Вернуть его можно
	// кнопкой «Добавить раздел» — без этого кнопка выглядела сломанной: пустой блок оставался на месте
	async function clearSection() {
		const section = confirmSection;
		setConfirmSection(null);
		if (!section) return;
		const fields = section === "more" ? { dealType: "", responsible: "", utm: "", availableToAll: true } : { recurring: "" };
		if (await save({ ...fields, hiddenSections: [...hidden, section] })) toast.success(t("sectionDeleted"));
	}

	async function restoreSection(section: "more" | "recurring") {
		if (await save({ hiddenSections: hidden.filter((s) => s !== section) })) toast.success(t("sectionAdded"));
	}

	async function removeDeal() {
		setConfirmDelete(false);
		onClose();
		await deleteDeal(deal!._id);
	}

	// Почему канал сейчас недоступен. Коды приходят с сервера (app/api/deals/[id]/channels/route.ts),
	// а формулировки живут здесь: сервер не знает языка интерфейса. Один и тот же текст показывается
	// подсказкой под полем и сообщением, если отправка всё-таки не удалась.
	const CHANNEL_LABEL: Record<string, string> = { sms: t("tabSms"), viber: t("tabViber"), telegram: t("tabTelegram"), email: t("tabEmail") };

	// Вкладка канала появляется, только когда канал подключён у фирмы: иначе это была бы кнопка,
	// которая всё равно не отправит. Подключение — в Настройки → Интеграции.
	const channelTabs: ComposerTab[] = ([
		{ key: "sms", label: t("tabSms") },
		{ key: "whatsapp", label: t("tabWhatsapp") },
		{ key: "viber", label: t("tabViber") },
		{ key: "telegram", label: t("tabTelegram") },
		{ key: "email", label: t("tabEmail") },
	] as const)
		.filter((tab) => channels[tab.key]?.connected)
		.map((tab) => ({
			key: tab.key,
			label: tab.label,
			type: tab.key as ComposerTab["type"],
			mode: "area" as const,
			placeholder: t("commentPlaceholder"),
			note: reasonText(channels[tab.key]?.state, tab.key),
			// у почты показываем, из какого ящика уйдёт письмо: у фирмы их может быть несколько
			hint: tab.key === "email" && channels.email?.state === "ready" && channels.email.from ? t("chanFromMailbox", { email: channels.email.from }) : undefined,
		}));

	function reasonText(code: string, channel: string): string | undefined {
		if (!code || code === "ready") return undefined;
		if (code === "no_contact") return t("chanNoContact");
		if (code === "no_phone") return t("chanNoPhone");
		if (code === "no_provider") return t("chanNoProvider");
		if (code === "no_recipient") return t("chanNoRecipient");
		if (code === "no_mailbox") return t("chanNoMailbox");
		if (code === "no_send_scope") return t("chanNoSendScope");
		// Неизвестный код — это уже не «нет переписки», а ответ сервера или провайдера (например, отказ
		// SMTP). Показываем его как есть: иначе настоящая причина отказа пряталась за чужой подписью
		if (/[ .]/.test(code.trim()) || code === "Server error") return code;
		return t("chanNoConversation", { channel: CHANNEL_LABEL[channel] ?? channel });
	}

	const tabs: ComposerTab[] = [
		{ key: "activity", label: t("tabActivity"), type: "activity", mode: "line", placeholder: t("thingsToDo"), withDate: true },
		{ key: "comment", label: t("tabComment"), type: "comment", mode: "area", placeholder: t("commentPlaceholder") },
		// «Задача» ставит настоящую задачу в разделе «Задачи и проекты» (со сроком), а не просто запись в ленте
		{ key: "task", label: t("tabTask"), type: "task", mode: "line", placeholder: t("thingsToDo"), withDate: true },
		// Дальше — каналы связи: они не пишут запись, а отправляют (SMS и письмо инициируются
		// с нашей стороны, в мессенджере отвечаем в существующей переписке)
		...channelTabs,
	];

	// Каналы отправляют, остальные вкладки по-прежнему пишут запись в ленту
	const CHANNEL_TABS = channelTabs.map((tab) => tab.key);

	async function submitActivity(activity: NewActivity) {
		if (!deal) return;
		// «Задача» — это настоящая задача: сначала создаём её (со сроком и привязкой к сделке),
		// и только потом пишем запись в ленту сделки, чтобы по ней было видно, что задача поставлена
		if (activity.type === "task") {
			const task = await addTask({ title: activity.text, deadline: activity.meta, deal: deal._id });
			if (!task) return void toast.error(t("error"));
			await addActivity(deal._id, activity);
			return void toast.success(t("taskCreated"));
		}
		if (!CHANNEL_TABS.includes(activity.type)) return void addActivity(deal._id, activity);
		const error = await sendChannel(deal._id, activity.type, activity.text, locale);
		if (error) toast.error(reasonText(error, activity.type) ?? t("chanNoConversation", { channel: CHANNEL_LABEL[activity.type] ?? activity.type }));
		else toast.success(t("chanSent"));
	}

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
						{/* Порядок карточки: сначала данные клиента, затем документы (предложения, счета, заказы),
						    ниже — служебные разделы, и в самом низу «Другое» и удаление сделки */}
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

						<DealDocuments dealId={deal._id} customerName={deal.contactName || deal.companyName || deal.clientName} contact={deal.contact ?? undefined} company={deal.company ?? undefined} isMarket={!!deal.source} />

						<CustomerOverview url={`/api/deals/${deal._id}/overview`} withDeals={false} />

						<DealTasks dealId={deal._id} />

						{!hidden.includes("recurring") && (
							<RecurringCard
								deal={deal}
								editing={recurringEditing}
								value={recurring}
								onChange={setRecurring}
								onToggle={() => setRecurringEditing(!recurringEditing)}
								onSave={saveRecurring}
								onDeleteSection={() => setConfirmSection("recurring")}
							/>
						)}

						{!hidden.includes("more") && (
							<MoreCard
								deal={deal}
								editing={moreEditing}
								draft={more}
								onChange={setMore}
								onToggle={() => setMoreEditing(!moreEditing)}
								onSave={saveMore}
								onDeleteSection={() => setConfirmSection("more")}
							/>
						)}

						{/* Убранные разделы можно вернуть: без этого «Удалить раздел» было бы необратимым */}
						{(hidden.includes("more") || hidden.includes("recurring")) && (
							<div className="flex flex-wrap items-center gap-10 text-13">
								<span className="text-[#8c948b]">{t("addSection")}:</span>
								{hidden.includes("more") && (
									<button type="button" onClick={() => restoreSection("more")} className="fs-link">+ {t("more")}</button>
								)}
								{hidden.includes("recurring") && (
									<button type="button" onClick={() => restoreSection("recurring")} className="fs-link">+ {t("recurringDeal")}</button>
								)}
							</div>
						)}

						<button
							type="button"
							onClick={() => setConfirmDelete(true)}
							className="self-start text-13 text-[#eb5757] transition-opacity hover:opacity-80">
							{t("deleteDeal")}
						</button>

						{/* То же, что перетаскивание карточки за последний этап: сделка выиграна. Кнопка нужна
						    и тем, кто не тянет карточки мышью */}
						<button
							type="button"
							onClick={() => void setWon(deal._id, !deal.wonAt)}
							className={`self-start text-13 transition-opacity hover:opacity-80 ${deal.wonAt ? "text-[#8c948b]" : "text-[#c6ff4d]"}`}>
							{deal.wonAt ? t("dealWonUndo") : t("dealWonMark")}
						</button>
					</div>

					<div className="min-w-0">
						<ActivityComposer tabs={tabs} submitLabel={t("send")} onSubmit={submitActivity} />
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
