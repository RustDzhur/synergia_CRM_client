import { redirect } from "next/navigation";

// /crm/collaboration сам по себе страницы не имеет — открываем первый раздел (Feed)
export default function CollaborationPage({ params }: { params: { locale: string } }) {
    redirect(`/${params.locale}/crm/collaboration/feed`);
}
