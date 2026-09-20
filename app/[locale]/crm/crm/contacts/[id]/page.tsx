import ContactEdit from "@/components/crm/components/Main/Contacts/ContactEdit";

export default function ContactPage({ params }: { params: { id: string } }) {
    return <ContactEdit id={params.id} />;
}
