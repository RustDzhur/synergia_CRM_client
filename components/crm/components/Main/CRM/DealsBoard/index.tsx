"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { TbChevronDown, TbDots } from "react-icons/tb";
import { useCrmStore } from "@/store/useCrmStore";
import Loader from "@/utils/Loader";
import Dropdown from "@/utils/Dropdown";
import Collapse from "@/utils/Collapse";
import { useClickOutside } from "@/utils/useClickOutside";
import StageColumn, { ARROW_DEPTH } from "./StageColumn";
import DealsList from "./DealsList";
import DealModal from "./DealModal";

interface Props {
    search: string;
}

export default function DealsBoard({ search }: Props) {
    const t = useTranslations("crm");
    const { stages, deals, isLoading, fetchAll, addStage, moveDeal, reorderStages } = useCrmStore();
    const [isAddingStage, setIsAddingStage] = useState(false);
    const [newStageName, setNewStageName] = useState("");
    // Внимание: в макете Figma под подписью «List» показана доска со стрелками. Здесь «Kanban» — доска,
    // а «List» — таблица сделок; чтобы по умолчанию открывалась доска, стартуем с "kanban".
    const [view, setView] = useState<"list" | "kanban">("kanban");
    const [moreOpen, setMoreOpen] = useState(false);
    const [openDealId, setOpenDealId] = useState<string | null>(null);
    const moreRef = useRef<HTMLDivElement>(null);
    const stageInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { fetchAll(); }, [fetchAll]);
    useEffect(() => { if (isAddingStage) stageInputRef.current?.focus(); }, [isAddingStage]);
    useClickOutside(moreRef, moreOpen, () => setMoreOpen(false));

    const sortedStages = [...stages].sort((a, b) => a.order - b.order);
    const q = search.trim().toLowerCase();
    const isSearching = q !== "";
    const filteredDeals = deals.filter((d) =>
        !q || [d.clientName, d.contactName, d.companyName].some((v) => v?.toLowerCase().includes(q))
    );

    function dealsForStage(stageId: string) {
        return filteredDeals.filter((d) => d.stage === stageId).sort((a, b) => a.order - b.order);
    }

    const inboundCount = sortedStages[0] ? dealsForStage(sortedStages[0]._id).length : 0;
    const plannedCount = sortedStages[1] ? dealsForStage(sortedStages[1]._id).length : 0;
    const moreCount = sortedStages.slice(2).reduce((sum, s) => sum + dealsForStage(s._id).length, 0);

    async function handleDragEnd(result: DropResult) {
        const { destination, source, draggableId, type } = result;
        if (!destination) return;

        // перенос целого столбца влево/вправо
        if (type === "COLUMN") {
            if (destination.index !== source.index) await reorderStages(source.index, destination.index);
            return;
        }

        // перенос карточки (в пределах столбца или в другой столбец)
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;
        await moveDeal(draggableId, destination.droppableId, destination.index);
    }

    async function saveNewStage() {
        if (!newStageName.trim()) return;
        await addStage(newStageName.trim());
        setNewStageName("");
        setIsAddingStage(false);
    }

    // индикатор только при первой загрузке: повторные обновления не должны «мигать» доской
    if (isLoading && stages.length === 0) {
        return (
            <div className="flex justify-center py-60">
                <Loader color="#c6ff4d" width="50" height="10" radius="9" />
            </div>
        );
    }

    const tab = (active: boolean) =>
        `px-14 py-8 text-13 font-medium capitalize border-b-2 transition-colors duration-200 ${
            active ? "border-[#c6ff4d] text-[#c6ff4d]" : "border-transparent text-[#8c948b] hover:text-[#f1f4ee]"
        }`;

    return (
        <div>
            {/* First Row: List/Kanban + счётчики + "..." */}
            <div className="flex items-center justify-between mb-20 flex-wrap gap-10">
                <div className="flex items-center">
                    <button className={tab(view === "list")} onClick={() => setView("list")}>
                        {t("list")}
                    </button>
                    <button className={tab(view === "kanban")} onClick={() => setView("kanban")}>
                        {t("kanban")}
                    </button>
                </div>

                <div className="flex items-center gap-12">
                    <div className="flex items-center gap-8">
                        <span className="text-12 text-[#8c948b] capitalize">{t("inbound")}</span>
                        <span className="fs-chip h-22 px-8 text-10">{inboundCount}</span>
                    </div>
                    <div className="flex items-center gap-8">
                        <span className="text-12 text-[#8c948b] capitalize">{t("planned")}</span>
                        <span className="fs-chip h-22 px-8 text-10">{plannedCount}</span>
                    </div>
                    <div ref={moreRef} className="relative">
                        <button
                            className="flex items-center gap-8"
                            aria-expanded={moreOpen}
                            onClick={() => setMoreOpen(!moreOpen)}
                        >
                            <span className="text-12 text-[#8c948b] capitalize">{t("more")}</span>
                            <span className="fs-chip h-22 px-8 text-10">{moreCount}</span>
                            <TbChevronDown
                                size={15}
                                className={`text-[#8c948b] transition-transform duration-200 ${moreOpen ? "rotate-180" : ""}`}
                            />
                        </button>
                        <Dropdown open={moreOpen} className="right-0 top-full mt-6 min-w-[180px]">
                            <div className="fs-popover fs-scroll p-6">
                                {sortedStages.slice(2).map((s) => (
                                    <div key={s._id} className="fs-popover-row flex items-center justify-between gap-12 rounded-8 px-10 py-6 text-12">
                                        <span className="truncate">{s.name}</span>
                                        <span className="shrink-0 text-[#8c948b]">{dealsForStage(s._id).length}</span>
                                    </div>
                                ))}
                            </div>
                        </Dropdown>
                    </div>
                </div>

                <TbDots size={18} className="text-[#9AA396]" />
            </div>

            {view === "kanban" ? (
                <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="board" type="COLUMN" direction="horizontal">
                        {(boardProvided) => (
                            <div
                                ref={boardProvided.innerRef}
                                {...boardProvided.droppableProps}
                                className="fs-scroll flex items-start overflow-x-auto pb-16 pr-[24px]"
                            >
                                {sortedStages.map((stage, index) => (
                                    <Draggable key={stage._id} draggableId={`stage-${stage._id}`} index={index}>
                                        {(dragProvided, dragSnapshot) => (
                                            <StageColumn
                                                stage={stage}
                                                index={index}
                                                deals={dealsForStage(stage._id)}
                                                dragProvided={dragProvided}
                                                isDragging={dragSnapshot.isDragging}
                                                dealsDragDisabled={isSearching}
                                                onOpenDeal={setOpenDealId}
                                            />
                                        )}
                                    </Draggable>
                                ))}
                                {boardProvided.placeholder}

                                {/* Кнопка новой колонки стоит там, где стояла бы следующая стрелка: острие
                                    последней заходит сюда на ARROW_OVERHANG, поэтому слева остаётся место под
                                    её вырез (ARROW_DEPTH) — иначе острие накрыло бы рамку кнопки. Справа отступ
                                    тот же, что у дорожек столбцов (mr-8), а высота равна стрелке (54px) */}
                                <div className="w-[222px] md:w-[180px] lg:w-[222px] shrink-0">
                                    <div className="mr-8" style={{ marginLeft: ARROW_DEPTH }}>
                                        <Collapse open={isAddingStage}>
                                            <div className="flex flex-col gap-8 pb-10">
                                                <input
                                                    ref={stageInputRef}
                                                    className="fs-field h-34 px-10 text-12 outline-none transition-colors"
                                                    placeholder={t("newStageName")}
                                                    value={newStageName}
                                                    onChange={(e) => setNewStageName(e.target.value)}
                                                    onKeyDown={(e) => e.key === "Enter" && saveNewStage()}
                                                />
                                                <div className="flex gap-10 text-13">
                                                    <button className="text-[#c6ff4d] transition-opacity hover:opacity-80" onClick={saveNewStage}>{t("save")}</button>
                                                    <button className="text-[#8c948b] transition-colors hover:text-[#f1f4ee]" onClick={() => setIsAddingStage(false)}>{t("cancel")}</button>
                                                </div>
                                            </div>
                                        </Collapse>
                                        {!isAddingStage && (
                                            <button
                                                className="animate-fade-in flex h-[54px] w-full items-center justify-center gap-6 rounded-10 border border-dashed border-[rgba(255,255,255,0.14)] text-13 text-[#8c948b] transition-colors duration-200 hover:border-[rgba(198,255,77,0.45)] hover:text-[#c6ff4d]"
                                                onClick={() => setIsAddingStage(true)}
                                            >
                                                + {t("addStage")}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
            ) : (
                <DealsList deals={filteredDeals} stages={sortedStages} onOpen={setOpenDealId} />
            )}

            <DealModal dealId={openDealId} onClose={() => setOpenDealId(null)} />
        </div>
    );
}
