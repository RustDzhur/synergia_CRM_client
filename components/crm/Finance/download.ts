import { authHeaders } from "@/store/crmApi";

export type DocumentKind = "invoices" | "quotes" | "orders" | "contracts";

// Скачивание PDF финансового документа — одна кнопка на все бумаги (счёт, кредит-нота, предложение,
// заказ, договор). Файл отдаёт маршрут /api/<kind>/<id>/pdf, локаль — язык интерфейса.
// template — оформление для предпросмотра: если он передан, PDF соберётся по нему, не дожидаясь сохранения
// документа (так работает предпросмотр в выборе шаблона). Без него сервер берёт шаблон самого документа,
// а если и там пусто — общий из настроек бухгалтерии.
// Возвращает false, если документ не отдался: интерфейс покажет «не удалось сформировать PDF».
// Накладная (Lieferschein) живёт по адресу /api/orders/<id>/delivery-note — у неё своя нумерация,
// поэтому качается отдельной функцией, а не через общий downloadDocumentPdf.
// Акт виконаних робіт: тот же путь, что у накладной — открываем PDF в новой вкладке,
// а если браузер её заблокировал, скачиваем файлом
export async function downloadAct(orderId: string, number: string, locale: string): Promise<boolean> {
    try {
        const res = await fetch(`/api/orders/${orderId}/act?locale=${locale}`, { headers: authHeaders(false) });
        if (!res.ok) return false;
        const url = URL.createObjectURL(await res.blob());
        const tab = window.open(url, "_blank", "noopener");
        if (!tab) { const a = document.createElement("a"); a.href = url; a.download = `${number || "act"}.pdf`; a.click(); }
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        return true;
    } catch {
        return false;
    }
}

export async function downloadDeliveryNote(orderId: string, number: string, locale: string): Promise<boolean> {
    try {
        const res = await fetch(`/api/orders/${orderId}/delivery-note?locale=${locale}`, { headers: authHeaders(false) });
        if (!res.ok) return false;
        const url = URL.createObjectURL(await res.blob());
        const tab = window.open(url, "_blank", "noopener");
        if (!tab) { const a = document.createElement("a"); a.href = url; a.download = `${number || "Lieferschein"}.pdf`; a.click(); }
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        return true;
    } catch {
        return false;
    }
}

export async function downloadDocumentPdf(kind: DocumentKind, id: string, number: string, locale: string, template?: string): Promise<boolean> {
    try {
        const q = new URLSearchParams({ locale });
        if (template) q.set("template", template);
        const res = await fetch(`/api/${kind}/${id}/pdf?${q}`, { headers: authHeaders(false) });
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
