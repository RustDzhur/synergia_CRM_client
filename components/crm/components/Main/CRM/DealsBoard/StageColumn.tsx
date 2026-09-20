"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { FiSettings } from "react-icons/fi";
import { Droppable, Draggable, DraggableProvided } from "@hello-pangea/dnd";
import { Stage, Deal, useCrmStore } from "@/app/store/useCrmStore";
import Collapse from "@/app/utils/Collapse";

// Цвета взял на глаз со скриншота дизайна (см. оговорку выше) — поправь на точные hex,
// если откроешь фигуры в Figma и скопируешь Fill.
const STAGE_COLORS = ["#2F8FE6", "#5BC9EF", "#3DD6BE", "#2AD9A0", "#F5A300", "#8A8FF5"];

// Форма стрелки: «хвост ласточки» слева (вырез) и остриё справа. Глубина выреза/острия — 24px.
const ARROW_DEPTH = 24;
// Зазор между соседними стрелками. Острие каждой стрелки заходит в вырез следующей и
// останавливается за GAP не доходя до него, поэтому между ними видна ровная полоска.
const ARROW_GAP = 8;
// Стрелка шире колонки на (ARROW_DEPTH − ARROW_GAP): столько её острие «нависает» над соседней колонкой.
const ARROW_OVERHANG = ARROW_DEPTH - ARROW_GAP;

interface Props {
    stage: Stage;
    index: number; // порядковый номер колонки — для цвета шеврона
    deals: Deal[];
    dragProvided: DraggableProvided; // от Draggable колонки (см. DealsBoard)
    isDragging: boolean;
    dealsDragDisabled: boolean; // при активном поиске индексы карточек «плывут», поэтому перенос выключаем
}

export default function StageColumn({ stage, index, deals, dragProvided, isDragging, dealsDragDisabled }: Props) {
    const t = useTranslations("crm");
    const { renameStage, deleteStage, addDeal } = useCrmStore();
    const [isRenaming, setIsRenaming] = useState(false);
    const [nameDraft, setNameDraft] = useState(stage.name);
    const [isAdding, setIsAdding] = useState(false);
    const [clientName, setClientName] = useState("");
    const addInputRef = useRef<HTMLInputElement>(null);

    const color = STAGE_COLORS[index % STAGE_COLORS.length];

    useEffect(() => {
        if (isAdding) addInputRef.current?.focus();
    }, [isAdding]);

    async function saveRename() {
        if (nameDraft.trim()) await renameStage(stage._id, nameDraft.trim());
        setIsRenaming(false);
    }

    async function handleDelete() {
        if (confirm(t("confirmDeleteStage"))) await deleteStage(stage._id);
    }

    async function saveNewCard() {
        if (!clientName.trim()) return;
        await addDeal(stage._id, clientName.trim());
        setClientName("");
        setIsAdding(false);
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
                    className={`relative h-[54px] flex items-center justify-center gap-12 px-[36px] select-none ${
                        isDragging ? "cursor-grabbing" : "cursor-grab"
                    }`}
                    style={{
                        width: `calc(100% + ${ARROW_OVERHANG}px)`,
                        backgroundColor: color,
                        clipPath: `polygon(0 0, calc(100% - ${ARROW_DEPTH}px) 0, 100% 50%, calc(100% - ${ARROW_DEPTH}px) 100%, 0 100%, ${ARROW_DEPTH}px 50%)`,
                    }}
                >
                    {isRenaming ? (
                        <input
                            autoFocus
                            className="rounded-6 px-6 py-2 w-full text-14 text-black"
                            value={nameDraft}
                            onChange={(e) => setNameDraft(e.target.value)}
                            onBlur={saveRename}
                            onKeyDown={(e) => e.key === "Enter" && saveRename()}
                        />
                    ) : (
                        <>
                            <span className="text-16 font-semibold text-white capitalize tracking-[0.32px] truncate">
                                {stage.name}
                            </span>
                            <button
                                onClick={() => setIsRenaming(true)}
                                className="transition-transform duration-200 hover:rotate-90"
                            >
                                <FiSettings size={18} className="text-white" />
                            </button>
                            <button
                                onClick={handleDelete}
                                className="text-white/80 text-12 transition-colors hover:text-white"
                            >
                                ✕
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
                                            className={`bg-white border border-[#E6E6E6] rounded-8 p-10 text-14 shadow-sm transition-shadow duration-200 hover:shadow-md ${
                                                dragSnapshot.isDragging ? "shadow-lg" : ""
                                            }`}
                                        >
                                            {deal.clientName}
                                        </div>
                                    )}
                                </Draggable>
                            ))}
                            {provided.placeholder}

                            <Collapse open={isAdding}>
                                <div className="flex flex-col gap-6">
                                    <input
                                        ref={addInputRef}
                                        className="border border-[#E6E6E6] rounded-6 px-8 py-6 text-14 outline-none transition-colors focus:border-[#5EA8F5]"
                                        placeholder={t("clientName")}
                                        value={clientName}
                                        onChange={(e) => setClientName(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && saveNewCard()}
                                    />
                                    <div className="flex gap-8 text-14">
                                        <button className="text-primaryColor" onClick={saveNewCard}>{t("save")}</button>
                                        <button className="text-menu" onClick={() => setIsAdding(false)}>{t("cancel")}</button>
                                    </div>
                                </div>
                            </Collapse>

                            {!isAdding && (
                                <button
                                    className="animate-fade-in bg-[#F2F2F2]/60 shadow-sm rounded-8 px-36 py-12 text-16 font-semibold text-[#666666] capitalize tracking-[0.32px] self-center mt-20 transition-colors duration-200 hover:bg-[#F2F2F2]"
                                    onClick={() => setIsAdding(true)}
                                >
                                    {t("addCard")}
                                </button>
                            )}
                        </div>
                    )}
                </Droppable>
            </div>
        </div>
    );
}
