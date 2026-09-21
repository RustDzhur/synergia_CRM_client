"use client";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCompaniesStore, ClientCompany } from "@/app/store/useCompaniesStore";
import { completeness, relativeTime } from "@/app/utils/crmFormat";
import EntityTable, { Column } from "../shared/EntityTable";
import ListToolbar from "../shared/ListToolbar";
import ConfirmDialog from "../shared/ConfirmDialog";

// Вкладка Companies: таблица компаний-клиентов. Изменение и создание — на отдельной странице (см. CompanyEdit).
export default function Companies({ search }: { search: string }) {
    const t = useTranslations("crm");
    const locale = useLocale();
    const router = useRouter();
    const { companies, isLoading, fetchCompanies, deleteCompanies } = useCompaniesStore();
    const [selected, setSelected] = useState<string[]>([]);
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

    const q = search.trim().toLowerCase();
    const rows = useMemo(
        () => companies.filter((c) => !q || [c.name, c.email, c.field].some((v) => v?.toLowerCase().includes(q))),
        [companies, q]
    );

    const base = `/${locale}/crm/crm/companies`;
    const columns: Column<ClientCompany>[] = [
        { key: "name", header: t("company"), render: (c) => c.name, width: "22%" },
        { key: "email", header: t("email"), render: (c) => c.email, width: "24%" },
        { key: "field", header: t("field"), render: (c) => c.field, width: "20%" },
        { key: "lastSeen", header: t("lastSeen"), render: (c) => <span className="capitalize">{relativeTime(c.updatedAt ?? c.createdAt, locale, t("justNow"))}</span>, width: "20%" },
        {
            key: "percent", header: t("percent"), width: "14%",
            render: (c) =>
                `${completeness([c.email, c.field, c.status, c.code, c.registrationDate, c.authorisedPerson, c.businessType, c.ownershipForm, c.address])} %`,
        },
    ];

    async function removeSelected() {
        setConfirmDelete(false);
        await deleteCompanies(selected);
        setSelected([]);
    }

    return (
        <div>
            <ListToolbar
                editLabel={t("editCompany")}
                addLabel={t("addCompany")}
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
                emptyText={t("emptyCompanies")}
            />
            <ConfirmDialog
                open={confirmDelete}
                title={t("deleteSelected")}
                text={t("confirmDeleteCompanies")}
                onCancel={() => setConfirmDelete(false)}
                onConfirm={removeSelected}
            />
        </div>
    );
}
