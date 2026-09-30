import { getTranslations } from "next-intl/server";
import { notFound as nextNotFound } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import { shareData } from "@/lib/share";
import ShareClient from "./ShareClient";

export const dynamic = "force-dynamic";

// Публичная страница клиента: статус заказа или предложение с выбором позиций.
// Работает без входа в CRM — ссылка и есть пропуск, и она открывает ровно один документ.
export default async function SharePage({ params }: { params: { token: string } }) {
    const t = await getTranslations("share");
    await connectDB();
    const data = await shareData(params.token).catch(() => null);
    if (!data) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-20 text-center">
                <div className="max-w-[420px]">
                    <h1 className="text-18 font-semibold text-[#f1f4ee]">{t("goneTitle")}</h1>
                    <p className="mt-10 text-13 leading-[1.6] text-[#8c948b]">{t("goneText")}</p>
                </div>
            </main>
        );
    }
    return <ShareClient data={data} token={params.token} />;
}

// Заглушка для типов: notFound из next/navigation здесь не нужен, страница отдаёт своё сообщение
void nextNotFound;
