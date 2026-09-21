"use client";
import { useTranslations } from "next-intl";
import { useContactStore, Contact } from "@/app/store/useContactStore";
import EntityEditPage, { FieldDef } from "../shared/EntityEditPage";

export default function ContactEdit({ id }: { id: string }) {
    const t = useTranslations("crm");
    const { getContact, addContact, updateContact, addActivity, removeActivity } = useContactStore();

    const fields: FieldDef[] = [
        { key: "firstName", label: t("firstName") },
        { key: "lastName", label: t("lastName") },
        { key: "email", label: t("email"), type: "email" },
        { key: "company", label: t("company") },
        { key: "position", label: t("role") },
        { key: "website", label: t("website") },
        { key: "twitter", label: t("twitter") },
        { key: "facebook", label: t("facebook") },
        { key: "phone", label: t("phone"), type: "tel" },
    ];

    return (
        <EntityEditPage<Contact>
            id={id}
            tab="contacts"
            titleEdit={t("editContactTitle")}
            titleNew={t("addContactTitle")}
            fields={fields}
            requiredAny={["firstName", "lastName"]}
            // контакты, созданные до появления полей «имя» / «фамилия», хранят только полное имя
            prepareForm={(contact, form) => {
                if (form.firstName || form.lastName || !contact.name) return form;
                const [first, ...rest] = contact.name.trim().split(/\s+/);
                return { ...form, firstName: first ?? "", lastName: rest.join(" ") };
            }}
            load={getContact}
            create={addContact}
            update={updateContact}
            addActivity={addActivity}
            removeActivity={removeActivity}
        />
    );
}
