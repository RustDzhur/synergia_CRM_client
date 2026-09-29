import ContactEdit from "@/components/crm/Contacts/ContactEdit";

export default function ContactPage({ params }: { params: { id: string } }) {
    return <ContactEdit id={params.id} />;
}
