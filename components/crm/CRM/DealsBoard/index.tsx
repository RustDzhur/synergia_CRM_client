"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { TbChevronDown, TbDots, TbTrash, TbTrophy } from "react-icons/tb";
import { useCrmStore } from "@/store/useCrmStore";
import Loader from "@/utils/Loader";
import Dropdown from "@/utils/Dropdown";
import Collapse from "@/utils/Collapse";
import { useClickOutside } from "@/utils/useClickOutside";
import ConfirmDialog from "../../shared/ConfirmDialog";
import StageColumn, { ARROW_DEPTH } from "./StageColumn";
import DealsList from "./DealsList";
import DealModal from "./DealModal";

// Зоны сброса — накладки поверх столбцов: корзина лежит на первой колонке (полоса у её левого
// края), «выиграна» — на последней, во всю её ширину. Это не дропзоны dnd: они не занимают место
// в потоке и не появляются в реестре dnd, поэтому перенос не сдвигает столбцы, а сброс
// определяется по положению курсора в момент отпускания. Высота у обеих — вся высота своей
// колонки: раньше зоны были ниже длинных колонок, и нижнюю карточку приходилось тащить вверх,
// чтобы попасть в зону (жалоба владельца).
const TRASH_WIDTH = 72; // полоса корзины у левого края первой колонки

interface Props {
    search: string;
}

export default function DealsBoard({ search }: Props) {
    const t = useTranslations("crm");
    const { stages, deals, isLoading, fetchAll, addStage, moveDeal, reorderStages, setWon, deleteDeal } = useCrmStore();
    const [isAddingStage, setIsAddingStage] = useState(false);
    const [newStageName, setNewStageName] = useState("");
    // карточку сейчас тянут: показываем зоны «выиграна» и «корзина» по краям доски
    const [dragging, setDragging] = useState(false);
    // под курсором сейчас «выиграна» или «корзина» — зона подсвечивается
    const [hotZone, setHotZone] = useState<"won" | "trash" | null>(null);
    const [trashDealId, setTrashDealId] = useState<string | null>(null);
    // где стоят зоны: считаем по столбцам в момент начала переноса (и при прокрутке доски).
    // У каждой зоны свои top/height — по дорожке ЕЁ колонки, поэтому высота подстраивается под
    // реальное число карточек
    const [zoneBox, setZoneBox] = useState<{
        trashLeft: number; trashTop: number; trashHeight: number;
        wonLeft: number; wonTop: number; wonHeight: number; wonWidth: number;
    } | null>(null);
    const boardRef = useRef<HTMLDivElement | null>(null);
    const hotZoneRef = useRef<"won" | "trash" | null>(null);
    // Внимание: в макете Figma под подписью «List» показана доска со стрелками. Здесь «Kanban» — доска,
    // а «List» — таблица сделок; чтобы по умолчанию открывалась доска, стартуем с "kanban".
    const [view, setView] = useState<"list" | "kanban">("kanban");
    const [moreOpen, setMoreOpen] = useState(false);
    const [openDealId, setOpenDealId] = useState<string | null>(null);
    // Айрис открывает карточку сделки адресом ?deal=<id> (n — метка, чтобы повторная команда сработала снова)
    const params = useSearchParams();
    const dealParam = params.get("deal"), dealNonce = params.get("n");
    useEffect(() => { if (dealParam) setOpenDealId(dealParam); }, [dealParam, dealNonce]);
    const moreRef = useRef<HTMLDivElement>(null);
    const stageInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { fetchAll(); }, [fetchAll]);
    useEffect(() => { if (isAddingStage) stageInputRef.current?.focus(); }, [isAddingStage]);
    useClickOutside(moreRef, moreOpen, () => setMoreOpen(false));
    // Переключились в другое окно посреди переноса — зоны «выиграна» и «корзина» прячем: иначе они
    // остались бы висеть на доске (DragDropContext в этом случае onDragEnd не вызывает)
    useEffect(() => {
        const reset = () => setDragging(false);
        window.addEventListener("blur", reset);
        return () => window.removeEventListener("blur", reset);
    }, []);

    // Границы зон берём у столбцов: корзина — полоса у левого края первой колонки, «выиграна» —
    // поверх последней колонки. Высота каждой — по дорожке её колонки (карточки растут вниз).
    // Пока карточку тянут, столбцы не двигаются, поэтому замер остаётся верным;
    // при прокрутке доски пересчитываем (координаты внутри прокручиваемого содержимого).
    useLayoutEffect(() => {
        if (!dragging) { setZoneBox(null); return; }
        const measure = () => {
            const board = boardRef.current;
            const columns = board?.querySelectorAll<HTMLElement>("[data-stage-column]");
            const lanes = board?.querySelectorAll<HTMLElement>("[data-stage-lane]");
            if (!board || !columns?.length || !lanes?.length) return;
            const boardRect = board.getBoundingClientRect();
            const first = columns[0].getBoundingClientRect();
            const last = columns[columns.length - 1].getBoundingClientRect();
            const firstLane = lanes[0].getBoundingClientRect();
            const lastLane = lanes[lanes.length - 1].getBoundingClientRect();
            const toContentX = (r: DOMRect) => r.left - boardRect.left + board.scrollLeft;
            const toContentY = (r: DOMRect) => r.top - boardRect.top + board.scrollTop;
            setZoneBox({
                trashLeft: toContentX(first),
                trashTop: toContentY(firstLane),
                trashHeight: Math.max(firstLane.height, 200),
                wonLeft: toContentX(last),
                wonTop: toContentY(lastLane),
                wonHeight: Math.max(lastLane.height, 200),
                wonWidth: last.width,
            });
        };
        measure();
        const board = boardRef.current;
        board?.addEventListener("scroll", measure, { passive: true });
        window.addEventListener("resize", measure);
        return () => {
            board?.removeEventListener("scroll", measure);
            window.removeEventListener("resize", measure);
        };
    }, [dragging, stages.length, view]);

    // Пока тянут карточку, следим за курсором: по нему решается, попал ли сброс в зону. Слушатели
    // обычные, без dnd — так зоны не участвуют в его реестре и не ломают перенос.
    useEffect(() => {
        if (!dragging) { hotZoneRef.current = null; setHotZone(null); return; }
        const move = (e: MouseEvent | TouchEvent) => {
            const point = "touches" in e ? e.touches[0] : e;
            if (!point) return;
            const board = boardRef.current;
            const box = board?.getBoundingClientRect();
            if (!board || !box || !zoneBox) return;
            // Координаты зон хранятся внутри прокручиваемого содержимого — переводим их в экранные
            const trashTop = box.top + zoneBox.trashTop - board.scrollTop;
            const inTrash = point.clientY >= trashTop && point.clientY <= trashTop + zoneBox.trashHeight;
            const wonTop = box.top + zoneBox.wonTop - board.scrollTop;
            const inWon = point.clientY >= wonTop && point.clientY <= wonTop + zoneBox.wonHeight;
            const trashRight = box.left + zoneBox.trashLeft + TRASH_WIDTH - board.scrollLeft;
            const wonStart = box.left + zoneBox.wonLeft - board.scrollLeft;
            const next: "won" | "trash" | null = inTrash && point.clientX <= trashRight ? "trash" : inWon && point.clientX >= wonStart ? "won" : null;
            if (next !== hotZoneRef.current) {
                hotZoneRef.current = next;
                setHotZone(next);
            }
        };
        window.addEventListener("mousemove", move);
        window.addEventListener("touchmove", move, { passive: true });
        return () => {
            window.removeEventListener("mousemove", move);
            window.removeEventListener("touchmove", move);
        };
    }, [dragging, zoneBox]);

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
    // сколько сделок прошло воронку до конца — это и есть результат воронки
    const wonCount = filteredDeals.filter((d) => d.wonAt).length;

    async function handleDragEnd(result: DropResult) {
        const { destination, source, draggableId, type } = result;
        // зоны за краями доски: туда карточку вытягивают намеренно, поэтому смотрим, где был курсор,
        // а не в какую дорожку карточка формально попала (корзина накрывает край первого столбца)
        const zone = type === "DEAL" ? hotZoneRef.current : null;
        setDragging(false); // зоны «выиграна» и «корзина» снова прячутся
        hotZoneRef.current = null;
        setHotZone(null);

        // карточку вытянули за последний столбец — сделка выиграна
        if (zone === "won") {
            await setWon(draggableId, true);
            return void toast.success(t("dealWonToast"));
        }
        // карточку утащили за первый столбец — предлагаем удалить (сначала подтверждение)
        if (zone === "trash") return void setTrashDealId(draggableId);

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

    async function confirmTrash() {
        const id = trashDealId;
        setTrashDealId(null);
        if (!id) return;
        await deleteDeal(id);
        toast.success(t("dealDeletedToast"));
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
                    <div className="flex items-center gap-8" title={t("dealWon")}>
                        <span className="flex items-center gap-4 text-12 text-[#8c948b] capitalize">
                            <TbTrophy size={13} className="text-[#c6ff4d]" />
                            {t("dealsWon")}
                        </span>
                        <span className="fs-chip h-22 px-8 text-10">{wonCount}</span>
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
                <DragDropContext onDragStart={(start) => setDragging(start.type === "DEAL")} onDragEnd={handleDragEnd}>
                    <Droppable droppableId="board" type="COLUMN" direction="horizontal">
                        {(boardProvided) => (
                            <div
                                ref={(node) => {
                                    boardProvided.innerRef(node);
                                    boardRef.current = node;
                                }}
                                {...boardProvided.droppableProps}
                                className="fs-scroll relative flex items-start overflow-x-auto pb-16 pr-[24px]"
                            >
                                {/* Зоны-накладки: не занимают место в потоке (иначе при захвате карточки
								    столбцы сдвигались бы и карточка уезжала из-под руки) и не участвуют в реестре dnd */}
                                {dragging && zoneBox && (
                                    <div
                                        aria-hidden
                                        style={{ left: zoneBox.trashLeft, top: zoneBox.trashTop, width: TRASH_WIDTH, height: zoneBox.trashHeight }}
                                        className={`pointer-events-none absolute z-10 flex flex-col items-center justify-center gap-8 rounded-12 border border-dashed text-center transition-colors duration-150 ${
                                            hotZone === "trash"
                                                ? "border-[#EB5757] bg-[rgba(235,87,87,0.22)] text-[#EB5757]"
                                                : "border-[rgba(235,87,87,0.45)] bg-[rgba(20,24,20,0.85)] text-[#8c948b]"
                                        }`}
                                    >
                                        <TbTrash size={22} />
                                        <span className="px-4 text-11 font-medium leading-tight">{t("delete")}</span>
                                    </div>
                                )}

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

                                {/* «Выиграна» — поверх последней колонки, во всю её ширину и высоту: сделка,
								    отпущенная здесь, прошла всю воронку; карточка переезжает в последний этап
								    с отметкой о выигрыше. Накладка ловит курсор по всей колонке — тянуть вбок
								    или вверх, чтобы попасть в узкую полосу, больше не нужно */}
                                {dragging && zoneBox && (
                                    <div
                                        aria-hidden
                                        style={{ left: zoneBox.wonLeft, top: zoneBox.wonTop, width: zoneBox.wonWidth, height: zoneBox.wonHeight }}
                                        className={`pointer-events-none absolute z-10 flex flex-col items-center justify-center gap-8 rounded-12 border border-dashed px-10 text-center transition-colors duration-150 ${
                                            hotZone === "won"
                                                ? "border-[#c6ff4d] bg-[rgba(198,255,77,0.20)] text-[#c6ff4d]"
                                                : "border-[rgba(198,255,77,0.45)] bg-[rgba(20,24,20,0.85)] text-[#8c948b]"
                                        }`}
                                    >
                                        <TbTrophy size={22} />
                                        <span className="text-11 font-medium leading-tight">{t("dropToWin")}</span>
                                        <span className="text-10 leading-tight text-[#8c948b]">{t("dropToWinHint")}</span>
                                    </div>
                                )}

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

            <ConfirmDialog
                open={trashDealId !== null}
                title={t("deleteDeal")}
                text={t("confirmTrashDeal")}
                onCancel={() => setTrashDealId(null)}
                onConfirm={confirmTrash}
            />
        </div>
    );
}
