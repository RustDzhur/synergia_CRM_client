import CompanyEdit from "@/components/crm/components/Main/Companies/CompanyEdit";

export default function CompanyPage({ params }: { params: { id: string } }) {
    return <CompanyEdit id={params.id} />;
}
