"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { FiSettings } from "react-icons/fi";
import { Droppable, Draggable } from "@hello-pangea/dnd";
import { Stage, Deal, useCrmStore } from "@/app/store/useCrmStore";

// Цвета взял на глаз со скриншота дизайна (см. оговорку выше) — поправь на точные hex,
// если откроешь фигуры в Figma и скопируешь Fill.
const STAGE_COLORS = ["#2F8FE6", "#5BC9EF", "#3DD6BE", "#2AD9A0", "#F5A300", "#8A8FF5"];

interface Props {
    stage: Stage;
    index: number; // порядковый номер колонки — для цвета шеврона
    deals: Deal[];
}

export default function StageColumn({ stage, index, deals }: Props) {
    const t = useTranslations("crm");
    const { renameStage, deleteStage, addDeal } = useCrmStore();
    const [isRenaming, setIsRenaming] = useState(false);
    const [nameDraft, setNameDraft] = useState(stage.name);
    const [isAdding, setIsAdding] = useState(false);
    const [clientName, setClientName] = useState("");

    const color = STAGE_COLORS[index % STAGE_COLORS.length];

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
            className="w-[222px] md:w-[180px] lg:w-[222px] shrink-0"
            style={{ marginLeft: index === 0 ? 0 : -24, zIndex: index + 1, position: "relative" }}
        >
            {/* заголовок-шеврон */}
            <div
                className="h-[54px] flex items-center justify-center gap-12 px-20"
                style={{
                    backgroundColor: color,
                    clipPath: "polygon(0 0, calc(100% - 24px) 0, 100% 50%, calc(100% - 24px) 100%, 0 100%, 24px 50%)",
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
                        <button onClick={() => setIsRenaming(true)}>
                            <FiSettings size={18} className="text-white" />
                        </button>
                        <button onClick={handleDelete} className="text-white/80 text-12">✕</button>
                    </>
                )}
            </div>

            {/* карточки */}
            <Droppable droppableId={stage._id} type="DEAL">
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-[300px] border-b-2 border-l-2 border-dashed border-[#FAFCFF] px-20 py-20 flex flex-col gap-10 ${
                            snapshot.isDraggingOver ? "bg-[#FAFCFF]" : ""
                        }`}
                    >
                        {deals.map((deal, dIndex) => (
                            <Draggable draggableId={deal._id} index={dIndex} key={deal._id}>
                                {(dragProvided, dragSnapshot) => (
                                    <div
                                        ref={dragProvided.innerRef}
                                        {...dragProvided.draggableProps}
                                        {...dragProvided.dragHandleProps}
                                        className={`bg-white border border-[#E6E6E6] rounded-8 p-10 text-14 shadow-sm ${
                                            dragSnapshot.isDragging ? "shadow-lg" : ""
                                        }`}
                                    >
                                        {deal.clientName}
                                    </div>
                                )}
                            </Draggable>
                        ))}
                        {provided.placeholder}

                        {isAdding ? (
                            <div className="flex flex-col gap-6">
                                <input
                                    autoFocus
                                    className="border rounded-6 px-8 py-6 text-14"
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
                        ) : (
                            <button
                                className="bg-[#F2F2F2]/60 shadow-sm rounded-8 px-36 py-12 text-16 font-semibold text-[#666666] capitalize tracking-[0.32px] self-center mt-20"
                                onClick={() => setIsAdding(true)}
                            >
                                {t("addCard")}
                            </button>
                        )}
                    </div>
                )}
            </Droppable>
        </div>
    );
}