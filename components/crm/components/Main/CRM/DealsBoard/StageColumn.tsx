"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MdDeleteOutline, MdFormatColorFill } from "react-icons/md";
import { FiSettings } from "react-icons/fi";
import { Droppable, Draggable, DraggableProvided } from "@hello-pangea/dnd";
import { Stage, Deal, NewDeal, useCrmStore } from "@/app/store/useCrmStore";
import { stageColor } from "@/app/utils/stageColors";
import Collapse from "@/app/utils/Collapse";
import ColorPickerModal from "../../shared/ColorPickerModal";
import ConfirmDialog from "../../shared/ConfirmDialog";
import AddDealForm from "./AddDealForm";
import DealCard from "./DealCard";

// Форма стрелки: «хвост ласточки» слева (вырез) и остриё справа. Глубина выреза/острия — 24px.
const ARROW_DEPTH = 24;
// Зазор между соседними стрелками. Острие каждой стрелки заходит в вырез следующей и
// останавливается за GAP не доходя до него, поэтому между ними видна ровная полоска.
const ARROW_GAP = 8;
// Стрелка шире колонки на (ARROW_DEPTH − ARROW_GAP): столько её острие «нависает» над соседней колонкой.
const ARROW_OVERHANG = ARROW_DEPTH - ARROW_GAP;

interface Props {
    stage: Stage;
    index: number; // порядковый номер колонки — для цвета по умолчанию
    deals: Deal[];
    dragProvided: DraggableProvided; // от Draggable колонки (см. DealsBoard)
    isDragging: boolean;
    dealsDragDisabled: boolean; // при активном поиске индексы карточек «плывут», поэтому перенос выключаем
    onOpenDeal: (dealId: string) => void;
}

export default function StageColumn({ stage, index, deals, dragProvided, isDragging, dealsDragDisabled, onOpenDeal }: Props) {
    const t = useTranslations("crm");
    const { updateStage, deleteStage, addDeal } = useCrmStore();
    const [isRenaming, setIsRenaming] = useState(false);
    const [nameDraft, setNameDraft] = useState(stage.name);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const nameRef = useRef<HTMLInputElement>(null);

    const color = stageColor(stage.color, index);

    useEffect(() => {
        if (isRenaming) nameRef.current?.select();
    }, [isRenaming]);

    function startRename() {
        setNameDraft(stage.name);
        setIsRenaming(true);
    }

    async function finishRename() {
        setIsRenaming(false);
        const name = nameDraft.trim();
        if (name && name !== stage.name) await updateStage(stage._id, { name });
        else setNameDraft(stage.name);
    }

    async function handleAdd(data: NewDeal) {
        const deal = await addDeal(stage._id, data);
        if (deal) setIsAdding(false);
    }

    return (
        <div
            ref={dragProvided.innerRef}
            {...dragProvided.draggableProps}
            className="w-[222px] md:w-[180px] lg:w-[222px] shrink-0"
        >
            {/* внутренняя обёртка: библиотека dnd сама двигает внешний элемент, поэтому «эффект подъёма» вешаем сюда */}
            <div
                className={`transition-[transform,filter] duration-200 ease-out ${
                    isDragging ? "scale-[1.03] drop-shadow-[0_8px_12px_rgba(0,0,0,0.25)]" : ""
                }`}
            >
                {/* заголовок-стрелка — он же «ручка», за которую переносится весь столбец */}
                <div
                    {...dragProvided.dragHandleProps}
                    title={t("columnDrag")}
                    onBlur={(e) => {
                        // фокус ушёл из заголовка (не на его кнопки и не в окно выбора цвета) — сохраняем название
                        if (isRenaming && !pickerOpen && !e.currentTarget.contains(e.relatedTarget as Node | null)) finishRename();
                    }}
                    className={`relative h-[54px] flex items-center justify-center gap-12 px-[36px] select-none ${
                        isDragging ? "cursor-grabbing" : "cursor-grab"
                    }`}
                    style={{
                        width: `calc(100% + ${ARROW_OVERHANG}px)`,
                        backgroundColor: color,
                        transition: "background-color 0.3s ease",
                        clipPath: `polygon(0 0, calc(100% - ${ARROW_DEPTH}px) 0, 100% 50%, calc(100% - ${ARROW_DEPTH}px) 100%, 0 100%, ${ARROW_DEPTH}px 50%)`,
                    }}
                >
                    {isRenaming ? (
                        <>
                            <input
                                ref={nameRef}
                                autoFocus
                                className="min-w-0 flex-1 rounded-4 bg-white px-8 py-4 text-14 text-[#666666] outline-none"
                                value={nameDraft}
                                placeholder={t("stageNamePlaceholder")}
                                maxLength={60}
                                onChange={(e) => setNameDraft(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") finishRename();
                                    if (e.key === "Escape") {
                                        setNameDraft(stage.name);
                                        setIsRenaming(false);
                                    }
                                }}
                            />
                            <button
                                type="button"
                                title={t("chooseColor")}
                                aria-label={t("chooseColor")}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => setPickerOpen(true)}
                                className="shrink-0 text-white transition-transform hover:scale-110"
                            >
                                <MdFormatColorFill size={22} />
                            </button>
                            <button
                                type="button"
                                title={t("delete")}
                                aria-label={t("delete")}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => setConfirmDelete(true)}
                                className="shrink-0 text-white/80 transition-colors hover:text-white"
                            >
                                <MdDeleteOutline size={20} />
                            </button>
                        </>
                    ) : (
                        <>
                            <span className="text-16 font-semibold text-white capitalize tracking-[0.32px] truncate">
                                {stage.name}
                            </span>
                            <button
                                type="button"
                                title={t("renameStage")}
                                aria-label={t("renameStage")}
                                onClick={startRename}
                                className="shrink-0 transition-transform duration-200 hover:rotate-90"
                            >
                                <FiSettings size={18} className="text-white" />
                            </button>
                        </>
                    )}
                </div>

                {/* «дорожка» столбца: светлый фон и рамка, чтобы границы были видны на белом.
                    mr-8 — тот же зазор между дорожками, что и между стрелками */}
                <Droppable droppableId={stage._id} type="DEAL">
                    {(provided, snapshot) => (
                        <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`mt-8 mr-8 min-h-[420px] rounded-8 border p-16 flex flex-col gap-10 transition-colors duration-200 ${
                                snapshot.isDraggingOver
                                    ? "border-[#5EA8F5] bg-[#EEF5FF]"
                                    : "border-[#E6E6E6] bg-[#FBFBFB]"
                            }`}
                        >
                            {/* кнопка «Add» сверху колонки, как в макете; под ней раскрывается форма новой сделки */}
                            <button
                                type="button"
                                aria-expanded={isAdding}
                                className="self-center rounded-8 bg-[#F2F2F2]/60 px-36 py-12 text-16 font-semibold text-[#666666] capitalize tracking-[0.32px] shadow-sm transition-colors duration-200 hover:bg-[#F2F2F2]"
                                onClick={() => setIsAdding(!isAdding)}
                            >
                                {t("addTask")}
                            </button>
                            <Collapse open={isAdding}>
                                <div className="pb-4 pt-10">
                                    <AddDealForm
                                        autoFocus={isAdding}
                                        onSubmit={handleAdd}
                                        onCancel={() => setIsAdding(false)}
                                    />
                                </div>
                            </Collapse>

                            {deals.map((deal, dIndex) => (
                                <Draggable
                                    draggableId={deal._id}
                                    index={dIndex}
                                    key={deal._id}
                                    isDragDisabled={dealsDragDisabled}
                                >
                                    {(dragCardProvided, dragSnapshot) => (
                                        <div
                                            ref={dragCardProvided.innerRef}
                                            {...dragCardProvided.draggableProps}
                                            {...dragCardProvided.dragHandleProps}
                                            onClick={() => onOpenDeal(deal._id)}
                                        >
                                            <DealCard deal={deal} isDragging={dragSnapshot.isDragging} />
                                        </div>
                                    )}
                                </Draggable>
                            ))}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </div>

            <ColorPickerModal
                open={pickerOpen}
                value={color}
                onChange={(c) => updateStage(stage._id, { color: c })}
                onClose={() => {
                    setPickerOpen(false);
                    finishRename();
                }}
            />
            <ConfirmDialog
                open={confirmDelete}
                title={t("delete")}
                text={t("confirmDeleteStage")}
                onCancel={() => setConfirmDelete(false)}
                onConfirm={() => {
                    setConfirmDelete(false);
                    deleteStage(stage._id);
                }}
            />
        </div>
    );
}
