import { authHeaders } from "@/app/store/crmApi";

export type DocumentKind = "invoices" | "quotes" | "orders" | "contracts";

// Скачивание PDF финансового документа — одна кнопка на все бумаги (счёт, кредит-нота, предложение,
// заказ, договор). Файл отдаёт маршрут /api/<kind>/<id>/pdf, локаль — язык интерфейса.
// Возвращает false, если документ не отдался: интерфейс покажет «не удалось сформировать PDF».
export async function downloadDocumentPdf(kind: DocumentKind, id: string, number: string, locale: string): Promise<boolean> {
    try {
        const res = await fetch(`/api/${kind}/${id}/pdf?locale=${locale}`, { headers: authHeaders(false) });
        if (!res.ok) return false;
        const url = URL.createObjectURL(await res.blob());
        const tab = window.open(url, "_blank", "noopener");
        if (!tab) { const a = document.createElement("a"); a.href = url; a.download = `${number}.pdf`; a.click(); }
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        return true;
    } catch {
        return false;
    }
}
