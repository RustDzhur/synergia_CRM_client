"use client";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useContactStore, Contact } from "@/app/store/useContactStore";
import { completeness, relativeTime } from "@/app/utils/crmFormat";
import EntityTable, { Column } from "../shared/EntityTable";
import ListToolbar from "../shared/ListToolbar";
import ConfirmDialog from "../shared/ConfirmDialog";

const initials = (name: string) =>
    name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

// Вкладка Contacts: таблица контактов. Изменение и создание — на отдельной странице (см. ContactEdit).
export default function Contacts({ search }: { search: string }) {
    const t = useTranslations("crm");
    const locale = useLocale();
    const router = useRouter();
    const { contacts, isLoading, fetchContacts, deleteContacts } = useContactStore();
    const [selected, setSelected] = useState<string[]>([]);
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => { fetchContacts(); }, [fetchContacts]);

    const q = search.trim().toLowerCase();
    const rows = useMemo(
        () => contacts.filter((c) => !q || [c.name, c.email, c.company, c.position].some((v) => v?.toLowerCase().includes(q))),
        [contacts, q]
    );

    const base = `/${locale}/crm/crm/contacts`;
    const columns: Column<Contact>[] = [
        {
            key: "name", header: t("name"), align: "left", width: "24%",
            render: (c) => (
                <span className="flex items-center gap-12">
                    <span className="flex h-40 w-40 shrink-0 items-center justify-center rounded-50 bg-[#D9D9D9] text-14 font-medium text-white">
                        {initials(c.name)}
                    </span>
                    <span className="truncate text-20 font-medium text-[#666666]">{c.name}</span>
                </span>
            ),
        },
        { key: "email", header: t("email"), render: (c) => c.email, width: "22%" },
        { key: "company", header: t("company"), render: (c) => c.company, width: "16%" },
        { key: "position", header: t("position"), render: (c) => c.position, width: "14%" },
        { key: "lastSeen", header: t("lastSeen"), render: (c) => <span className="capitalize">{relativeTime(c.updatedAt ?? c.createdAt, locale, t("justNow"))}</span>, width: "14%" },
        {
            key: "percent", header: t("percent"), width: "10%",
            render: (c) => `${completeness([c.email, c.phone, c.company, c.position, c.website, c.twitter, c.facebook])} %`,
        },
    ];

    async function removeSelected() {
        setConfirmDelete(false);
        await deleteContacts(selected);
        setSelected([]);
    }

    return (
        <div>
            <ListToolbar
                editLabel={t("editContact")}
                addLabel={t("addContact")}
                selectedCount={selected.length}
                onEdit={() => selected.length === 1 && router.push(`${base}/${selected[0]}`)}
                onAdd={() => router.push(`${base}/new`)}
                onDelete={() => setConfirmDelete(true)}
            />
            <EntityTable
                rows={rows}
                columns={columns}
                getId={(c) => c._id}
                selected={selected}
                onToggle={(id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
                onToggleAll={(checked) => setSelected(checked ? rows.map((r) => r._id) : [])}
                isLoading={isLoading}
                emptyText={t("emptyContacts")}
            />
            <ConfirmDialog
                open={confirmDelete}
                title={t("deleteSelected")}
                text={t("confirmDeleteContacts")}
                onCancel={() => setConfirmDelete(false)}
                onConfirm={removeSelected}
            />
        </div>
    );
}
