import { redirect } from "next/navigation";

// Шаблоны договоров переехали в Бухгалтерию → Настройки; старую ссылку ведём туда.
export default function SettingsLegalPage({ params }: { params: { locale: string } }) {
    redirect(`/${params.locale}/crm/finance`);
}
