"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MdChevronLeft, MdChevronRight, MdMenu, MdSearch, MdSettings, MdTune } from "react-icons/md";
import { Employee, useEmployeeStore } from "@/app/store/useEmployeeStore";
import Dropdown from "@/app/utils/Dropdown";
import { useClickOutside } from "@/app/utils/useClickOutside";
import ConfirmDialog from "../shared/ConfirmDialog";
import EmployeeModal from "./EmployeeModal";

const initials = (e: Employee) => `${e.firstname[0] ?? ""}${e.lastname[0] ?? ""}`.toUpperCase();

// Меню строки: «Edit / Delete» (значок «≡» слева в строке таблицы)
function RowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
    const t = useTranslations("company");
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useClickOutside(ref, open, () => setOpen(false));
    const item = "block w-full px-16 py-10 text-left text-16 text-[#666666] transition-colors duration-150 hover:bg-gray";
    return (
        <div ref={ref} className="relative inline-block">
            <button type="button" aria-label={t("rowMenu")} aria-expanded={open} onClick={() => setOpen(!open)} className="text-[#666666] transition-colors hover:text-primaryColor">
                <MdMenu size={22} />
            </button>
            <Dropdown open={open} className="left-0 top-full mt-8 min-w-[150px]">
                <div className="overflow-hidden rounded-8 border border-[#E2F1F5] bg-white text-left shadow-custom">
                    <button type="button" className={item} onClick={() => { setOpen(false); onEdit(); }}>{t("edit")}</button>
                    <div className="border-t border-[#E2F1F5]" />
                    <button type="button" className={`${item} !text-danger`} onClick={() => { setOpen(false); onDelete(); }}>{t("delete")}</button>
                </div>
            </Dropdown>
        </div>
    );
}

// Раздел Company: сотрудники (таблица, приглашение, редактирование) и база знаний.
export default function Company() {
    const t = useTranslations("company");
    const { items, total, page, pages, isLoading, query, setQuery, fetchEmployees, deleteEmployee } = useEmployeeStore();
    const [tab, setTab] = useState<"employees" | "knowledge">("employees");
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Employee | null>(null);
    const [toDelete, setToDelete] = useState<Employee | null>(null);
    const firstLoad = useRef(true);

    useEffect(() => { fetchEmployees(1); }, [fetchEmployees]);

    // поиск с задержкой 300 мс, чтобы не запрашивать сервер на каждую букву
    useEffect(() => {
        if (firstLoad.current) { firstLoad.current = false; return; }
        const timer = setTimeout(() => fetchEmployees(1), 300);
        return () => clearTimeout(timer);
    }, [query, fetchEmployees]);

    const th = "border-l border-[#F0F0F0] px-10 py-16 text-center text-16 font-medium text-[#999999] md:text-18";
    const td = "truncate px-10 text-center text-16 text-[#999999] md:text-18";

    return (
        <div className="p-16 md:p-30">
            <div className="mb-30 flex flex-wrap items-center justify-between gap-16">
                <div className="flex items-center rounded-8 bg-[#F2F2F2] p-10 shadow-custom">
                    {(["employees", "knowledge"] as const).map((key) => (
                        <button
                            key={key}
                            onClick={() => setTab(key)}
                            className={`rounded-4 px-16 py-10 text-16 font-medium tracking-[0.32px] transition-colors duration-200 ${
                                tab === key ? "bg-primaryColor text-white" : "text-[#CCCCCC] hover:text-[#999999]"
                            }`}
                        >
                            {key === "employees" ? t("employeesTab") : t("knowledgeBase")}
                        </button>
                    ))}
                </div>

                {tab === "employees" && (
                    <>
                        <div className="flex h-[50px] w-full items-center justify-between rounded-8 border-2 border-[#E6E6E6] bg-white px-16 shadow-custom transition-colors focus-within:border-[#5EA8F5] md:w-[350px]">
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={t("search")}
                                className="w-full text-18 outline-none placeholder:text-[#CCCCCC]"
                            />
                            <div className="flex shrink-0 items-center gap-10 text-[#CCCCCC]">
                                <MdSearch size={20} />
                                <MdTune size={20} />
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => { setEditing(null); setModalOpen(true); }}
                            className="h-[50px] w-full rounded-4 bg-primaryColor px-30 text-18 font-semibold text-white shadow-custom transition-opacity hover:opacity-80 md:w-auto"
                        >
                            {t("invite")}
                        </button>
                    </>
                )}
            </div>

            {tab === "knowledge" ? (
                <p className="rounded-16 bg-[#F5F7FC] p-30 text-center text-16 text-[#999999]">{t("kbSoon")}</p>
            ) : (
                <div className="min-h-[280px] overflow-x-auto rounded-16 bg-white shadow-custom">
                    <table className="w-full min-w-[1040px] table-fixed border-collapse">
                        <thead>
                            <tr className="border-b border-[#F0F0F0]">
                                <th className="w-[60px] py-16 text-center text-[#999999]"><MdSettings size={22} className="mx-auto" aria-hidden /></th>
                                <th className={`${th} w-[100px]`}>{t("photo")}</th>
                                <th className={`${th} w-[230px]`}>{t("fullName")}</th>
                                <th className={`${th} w-[200px]`}>{t("email")}</th>
                                <th className={`${th} w-[140px]`}>{t("workPhone")}</th>
                                <th className={th}>{t("position")}</th>
                                <th className={th}>{t("department")}</th>
                                <th className={`${th} w-[150px]`}>{t("internalPhone")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((e) => (
                                <tr key={e._id} className="h-[84px] animate-fade-in border-b border-[#F0F0F0] transition-colors duration-150 hover:bg-[#F7F9FF]">
                                    <td className="text-center"><RowMenu onEdit={() => { setEditing(e); setModalOpen(true); }} onDelete={() => setToDelete(e)} /></td>
                                    <td className="text-center">
                                        <span className="mx-auto flex h-50 w-50 items-center justify-center overflow-hidden rounded-50 bg-[#D9D9D9] text-16 font-medium text-white">
                                            {e.avatarUrl ? <img src={e.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials(e)}
                                        </span>
                                    </td>
                                    <td className={`${td} text-[#666666]`}>{e.firstname} {e.lastname}</td>
                                    <td className={td}>{e.email}</td>
                                    <td className={td}>{e.workPhone}</td>
                                    <td className={td}>{e.position}</td>
                                    <td className={td}>{e.department}</td>
                                    <td className={td}>{e.internalPhone}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {!isLoading && items.length === 0 && <p className="py-40 text-center text-16 text-[#999999]">{t("empty")}</p>}
                    {isLoading && items.length === 0 && <p className="py-40 text-center text-16 text-[#999999]">…</p>}

                    <footer className="flex flex-wrap items-center gap-x-24 gap-y-8 px-18 py-16 text-16 uppercase text-[#999999]">
                        <span>{t("total", { total })}</span>
                        <span>{t("pages", { pages })}</span>
                        <div className="flex w-full items-center justify-center gap-24 text-[#666666] md:ml-[-160px] md:flex-1">
                            <button type="button" disabled={page <= 1} onClick={() => fetchEmployees(page - 1)} className="flex items-center transition-colors enabled:hover:text-primaryColor disabled:opacity-40">
                                <MdChevronLeft size={22} />{t("previous")}
                            </button>
                            <button type="button" disabled={page >= pages} onClick={() => fetchEmployees(page + 1)} className="flex items-center transition-colors enabled:hover:text-primaryColor disabled:opacity-40">
                                {t("next")}<MdChevronRight size={22} />
                            </button>
                        </div>
                    </footer>
                </div>
            )}

            <EmployeeModal open={modalOpen} employee={editing} onClose={() => setModalOpen(false)} />
            <ConfirmDialog
                open={toDelete !== null}
                title={t("delete")}
                text={t("confirmDelete")}
                onCancel={() => setToDelete(null)}
                onConfirm={() => { const e = toDelete; setToDelete(null); if (e) deleteEmployee(e._id); }}
            />
        </div>
    );
}
