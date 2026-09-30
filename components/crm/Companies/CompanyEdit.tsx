"use client";
import { useTranslations } from "next-intl";
import { useCompaniesStore, ClientCompany } from "@/store/useCompaniesStore";
import EntityEditPage, { FieldDef } from "../shared/EntityEditPage";

export default function CompanyEdit({ id }: { id: string }) {
    const t = useTranslations("crm");
    const { getCompany, addCompany, updateCompany, addActivity, removeActivity } = useCompaniesStore();

    const fields: FieldDef[] = [
        { key: "name", label: t("legalName") },
        { key: "status", label: t("legalStatus") },
        // Код фирмы и адрес — с подсказками из справочников режима (ТЗ §16): при выборе подставляются
        // название/адрес/статус; если провайдера нет, поле работает как обычное
        { key: "code", label: t("usreouCode"), lookup: { kind: "company", fill: { status: "" } } },
        { key: "registrationDate", label: t("registrationDate"), type: "date" },
        { key: "authorisedPerson", label: t("authorisedPerson") },
        { key: "businessType", label: t("businessType") },
        { key: "ownershipForm", label: t("ownershipForm") },
        { key: "address", label: t("companyContacts"), lookup: { kind: "address" } },
        { key: "email", label: t("email"), type: "email" },
        { key: "field", label: t("field") },
    ];

    return (
        <EntityEditPage<ClientCompany>
            id={id}
            tab="companies"
            titleEdit={t("editCompanyTitle")}
            titleNew={t("addCompanyTitle")}
            fields={fields}
            requiredAny={["name"]}
            load={getCompany}
            create={addCompany}
            update={updateCompany}
            addActivity={addActivity}
            removeActivity={removeActivity}
        />
    );
}
