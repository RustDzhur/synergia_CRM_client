"use client";
import { useTranslations } from "next-intl";
import { useCompaniesStore, ClientCompany } from "@/app/store/useCompaniesStore";
import EntityEditPage, { FieldDef } from "../shared/EntityEditPage";

export default function CompanyEdit({ id }: { id: string }) {
    const t = useTranslations("crm");
    const { getCompany, addCompany, updateCompany, addActivity, removeActivity } = useCompaniesStore();

    const fields: FieldDef[] = [
        { key: "name", label: t("legalName") },
        { key: "status", label: t("legalStatus") },
        { key: "code", label: t("usreouCode") },
        { key: "registrationDate", label: t("registrationDate"), type: "date" },
        { key: "authorisedPerson", label: t("authorisedPerson") },
        { key: "businessType", label: t("businessType") },
        { key: "ownershipForm", label: t("ownershipForm") },
        { key: "address", label: t("companyContacts") },
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
