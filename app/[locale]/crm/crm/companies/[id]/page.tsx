import CompanyEdit from "@/components/crm/Companies/CompanyEdit";

export default function CompanyPage({ params }: { params: { id: string } }) {
    return <CompanyEdit id={params.id} />;
}
