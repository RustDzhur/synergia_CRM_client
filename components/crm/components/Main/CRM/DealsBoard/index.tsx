"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { BsChevronDown, BsThreeDots } from "react-icons/bs";
import { useCrmStore } from "@/app/store/useCrmStore";
import StageColumn from "./StageColumn";

interface Props {
    search: string;
}

export default function DealsBoard({ search }: Props) {
    const t = useTranslations("crm");
    const { stages, deals, isLoading, fetchAll, addStage, moveDeal } = useCrmStore();
    const [isAddingStage, setIsAddingStage] = useState(false);
    const [newStageName, setNewStageName] = useState("");
    const [view, setView] = useState<"list" | "kanban">("kanban");
    const [moreOpen, setMoreOpen] = useState(false);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const sortedStages = [...stages].sort((a, b) => a.order - b.order);
    const filteredDeals = deals.filter((d) =>
        d.clientName.toLowerCase().includes(search.toLowerCase())
    );

    function dealsForStage(stageId: string) {
        return filteredDeals.filter((d) => d.stage === stageId).sort((a, b) => a.order - b.order);
    }

    const inboundCount = sortedStages[0] ? dealsForStage(sortedStages[0]._id).length : 0;
    const plannedCount = sortedStages[1] ? dealsForStage(sortedStages[1]._id).length : 0;
    const moreCount = sortedStages.slice(2).reduce((sum, s) => sum + dealsForStage(s._id).length, 0);

    async function handleDragEnd(result: DropResult) {
        const { destination, draggableId } = result;
        if (!destination) return;
        await moveDeal(draggableId, destination.droppableId, destination.index);
    }

    async function saveNewStage() {
        if (!newStageName.trim()) return;
        await addStage(newStageName.trim());
        setNewStageName("");
        setIsAddingStage(false);
    }

    if (isLoading) return <p>Loading…</p>;

    return (
        <div>
            {/* First Row: List/Kanban + счётчики + "..." */}
            <div className="flex items-center justify-between mb-20 flex-wrap gap-10">
                <div className="flex items-center">
                    <button
                        className={`px-16 py-10 text-16 font-medium capitalize tracking-[0.32px] border-b-2 ${
                            view === "list" ? "border-primaryColor text-primaryColor" : "border-transparent text-[#999999]"
                        }`}
                        onClick={() => setView("list")}
                    >
                        {t("list")}
                    </button>
                    <button
                        className={`px-16 py-10 text-16 font-medium capitalize tracking-[0.32px] border-b-2 ${
                            view === "kanban" ? "border-primaryColor text-primaryColor" : "border-transparent text-[#999999]"
                        }`}
                        onClick={() => setView("kanban")}
                    >
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
                    <div className="relative">
                        <button className="flex items-center gap-6" onClick={() => setMoreOpen(!moreOpen)}>
                            <span className="text-16 font-medium text-[#666666] capitalize tracking-[0.32px]">{t("more")}</span>
                            <span className="bg-primaryColor text-white text-16 font-medium rounded-4 px-4">{moreCount}</span>
                            <BsChevronDown size={14} className="text-[#666666]" />
                        </button>
                        {moreOpen && (
                            <div className="absolute top-full right-0 bg-white border border-[#E6E6E6] rounded-8 p-10 mt-4 shadow-lg z-10 min-w-[160px]">
                                {sortedStages.slice(2).map((s) => (
                                    <div key={s._id} className="flex justify-between text-14 py-4">
                                        <span>{s.name}</span>
                                        <span>{dealsForStage(s._id).length}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <BsThreeDots size={18} className="text-[#666666]" />
            </div>

            {view === "kanban" ? (
                <DragDropContext onDragEnd={handleDragEnd}>
                    <div className="flex overflow-x-auto">
                        {sortedStages.map((stage, index) => (
                            <StageColumn key={stage._id} stage={stage} index={index} deals={dealsForStage(stage._id)} />
                        ))}

                        <div className="w-[222px] shrink-0 p-16">
                            {isAddingStage ? (
                                <div className="flex flex-col gap-6">
                                    <input
                                        autoFocus
                                        className="border rounded-6 px-8 py-6 text-14"
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
                            ) : (
                                <button
                                    className="text-14 text-[#666666] border border-dashed border-[#E6E6E6] rounded-8 py-10 w-full"
                                    onClick={() => setIsAddingStage(true)}
                                >
                                    + {t("addStage")}
                                </button>
                            )}
                        </div>
                    </div>
                </DragDropContext>
            ) : (
                <p className="text-menu text-14">List view — сделаем отдельным шагом.</p>
            )}
        </div>
    );
}