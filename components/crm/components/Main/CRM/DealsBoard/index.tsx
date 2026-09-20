"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { BsChevronDown, BsThreeDots } from "react-icons/bs";
import { useCrmStore } from "@/app/store/useCrmStore";
import Loader from "@/app/utils/Loader";
import Dropdown from "@/app/utils/Dropdown";
import Collapse from "@/app/utils/Collapse";
import { useClickOutside } from "@/app/utils/useClickOutside";
import StageColumn from "./StageColumn";
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
                <Loader color="#5EA8F5" width="50" height="10" radius="9" />
            </div>
        );
    }

    const tab = (active: boolean) =>
        `px-16 py-10 text-16 font-medium capitalize tracking-[0.32px] border-b-2 transition-colors duration-200 ${
            active ? "border-primaryColor text-primaryColor" : "border-transparent text-[#999999] hover:text-[#666666]"
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

                <div className="flex items-center gap-10">
                    <div className="flex items-center gap-6">
                        <span className="text-16 font-medium text-[#666666] capitalize tracking-[0.32px]">{t("inbound")}</span>
                        <span className="bg-primaryColor text-white text-16 font-medium rounded-4 px-4">{inboundCount}</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <span className="text-16 font-medium text-[#666666] capitalize tracking-[0.32px]">{t("planned")}</span>
                        <span className="bg-primaryColor text-white text-16 font-medium rounded-4 px-4">{plannedCount}</span>
                    </div>
                    <div ref={moreRef} className="relative">
                        <button
                            className="flex items-center gap-6"
                            aria-expanded={moreOpen}
                            onClick={() => setMoreOpen(!moreOpen)}
                        >
                            <span className="text-16 font-medium text-[#666666] capitalize tracking-[0.32px]">{t("more")}</span>
                            <span className="bg-primaryColor text-white text-16 font-medium rounded-4 px-4">{moreCount}</span>
                            <BsChevronDown
                                size={14}
                                className={`text-[#666666] transition-transform duration-200 ${moreOpen ? "rotate-180" : ""}`}
                            />
                        </button>
                        <Dropdown open={moreOpen} className="right-0 top-full mt-4 min-w-[160px]">
                            <div className="bg-white border border-[#E6E6E6] rounded-8 p-10 shadow-lg">
                                {sortedStages.slice(2).map((s) => (
                                    <div key={s._id} className="flex justify-between text-14 py-4">
                                        <span>{s.name}</span>
                                        <span>{dealsForStage(s._id).length}</span>
                                    </div>
                                ))}
                            </div>
                        </Dropdown>
                    </div>
                </div>

                <BsThreeDots size={18} className="text-[#666666]" />
            </div>

            {view === "kanban" ? (
                <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="board" type="COLUMN" direction="horizontal">
                        {(boardProvided) => (
                            <div
                                ref={boardProvided.innerRef}
                                {...boardProvided.droppableProps}
                                className="flex items-start overflow-x-auto pb-16 pr-[24px]"
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

                                <div className="w-[222px] shrink-0 p-16">
                                    <Collapse open={isAddingStage}>
                                        <div className="flex flex-col gap-6 pb-10">
                                            <input
                                                ref={stageInputRef}
                                                className="border border-[#E6E6E6] rounded-6 px-8 py-6 text-14 outline-none transition-colors focus:border-[#5EA8F5]"
                                                placeholder={t("newStageName")}
                                                value={newStageName}
                                                onChange={(e) => setNewStageName(e.target.value)}
                                                onKeyDown={(e) => e.key === "Enter" && saveNewStage()}
                                            />
                                            <div className="flex gap-8 text-14">
                                                <button className="text-primaryColor" onClick={saveNewStage}>{t("save")}</button>
                                                <button className="text-menu" onClick={() => setIsAddingStage(false)}>{t("cancel")}</button>
                                            </div>
                                        </div>
                                    </Collapse>
                                    {!isAddingStage && (
                                        <button
                                            className="animate-fade-in text-14 text-[#666666] border border-dashed border-[#CCCCCC] rounded-8 py-10 w-full transition-colors duration-200 hover:border-[#5EA8F5] hover:text-primaryColor"
                                            onClick={() => setIsAddingStage(true)}
                                        >
                                            + {t("addStage")}
                                        </button>
                                    )}
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
