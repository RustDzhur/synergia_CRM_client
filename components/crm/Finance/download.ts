import toast from "react-hot-toast";
import { authHeaders } from "@/store/crmApi";
import { explainCompliance } from "@/lib/finance/complianceLabels";

export type DocumentKind = "invoices" | "quotes" | "orders" | "contracts" | "purchases";

// Действия с PDF финансового документа — двумя кнопками, как просил владелец: «Просмотр» открывает
// файл во вкладке браузера (оттуда его печатают), «Скачать» сохраняет файл. Раньше была одна кнопка,
// которая то открывала, то качала, — и понять, что произойдёт, было нельзя.
//
// Все запросы идут через fetch с токеном: обычная <a href> не отправляет заголовок авторизации,
// и сервер отвечал «Unauthorized» (грабля, уже пойманная на выгрузках).

async function fetchPdf(url: string, fallbackError: string): Promise<Blob | null> {
    try {
        const res = await fetch(url, { headers: authHeaders(false) });
        if (!res.ok) {
            toast.error(await explainPdfFailure(res, fallbackError));
            return null;
        }
        return await res.blob();
    } catch {
        toast.error(fallbackError);
        return null;
    }
}

/** Открыть PDF во вкладке браузера (оттуда печатают); если вкладку заблокировали — скачать файлом */
function openBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const tab = window.open(url, "_blank");
    if (!tab) {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Сохранить PDF файлом — кнопка «Скачать» всегда именно скачивает */
function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const docUrl = (kind: DocumentKind, id: string, locale: string, template?: string) => {
    const q = new URLSearchParams({ locale });
    if (template) q.set("template", template);
    return `/api/${kind}/${id}/pdf?${q}`;
};

export async function downloadDocumentPdf(kind: DocumentKind, id: string, number: string, locale: string, template?: string): Promise<boolean> {
    const blob = await fetchPdf(docUrl(kind, id, locale, template), kind);
    if (!blob) return false;
    saveBlob(blob, `${number || "document"}.pdf`);
    return true;
}

/** PDF документа как Blob — для просмотра внутри страницы (окно ассистента), без всплывающих окон и скачивания. */
export async function fetchDocumentPdfBlob(kind: DocumentKind, id: string, locale: string, template?: string): Promise<Blob | null> {
    return fetchPdf(docUrl(kind, id, locale, template), kind);
}

export async function viewDocumentPdf(kind: DocumentKind, id: string, number: string, locale: string, template?: string): Promise<boolean> {
    const blob = await fetchPdf(docUrl(kind, id, locale, template), kind);
    if (!blob) return false;
    openBlob(blob, `${number || "document"}.pdf`);
    return true;
}

// Накладная (Lieferschein), акт виконаних робіт и пакувальний лист живут на заказе: у каждого своя
// нумерация и свой маршрут /api/orders/<id>/…
const orderDocUrl = (path: "act" | "delivery-note" | "packing-list", orderId: string, locale: string) => `/api/orders/${orderId}/${path}?locale=${locale}`;

export async function downloadAct(orderId: string, number: string, locale: string): Promise<boolean> {
    const blob = await fetchPdf(orderDocUrl("act", orderId, locale), "act");
    if (!blob) return false;
    saveBlob(blob, `${number || "act"}.pdf`);
    return true;
}

export async function viewAct(orderId: string, number: string, locale: string): Promise<boolean> {
    const blob = await fetchPdf(orderDocUrl("act", orderId, locale), "act");
    if (!blob) return false;
    openBlob(blob, `${number || "act"}.pdf`);
    return true;
}

export async function downloadDeliveryNote(orderId: string, number: string, locale: string): Promise<boolean> {
    const blob = await fetchPdf(orderDocUrl("delivery-note", orderId, locale), "delivery-note");
    if (!blob) return false;
    saveBlob(blob, `${number || "Lieferschein"}.pdf`);
    return true;
}

export async function viewDeliveryNote(orderId: string, number: string, locale: string): Promise<boolean> {
    const blob = await fetchPdf(orderDocUrl("delivery-note", orderId, locale), "delivery-note");
    if (!blob) return false;
    openBlob(blob, `${number || "Lieferschein"}.pdf`);
    return true;
}

export async function downloadPackingList(orderId: string, number: string, locale: string): Promise<boolean> {
    const blob = await fetchPdf(orderDocUrl("packing-list", orderId, locale), "packing-list");
    if (!blob) return false;
    saveBlob(blob, `packing-list${number ? `-${number}` : ""}.pdf`);
    return true;
}

export async function viewPackingList(orderId: string, number: string, locale: string): Promise<boolean> {
    const blob = await fetchPdf(orderDocUrl("packing-list", orderId, locale), "packing-list");
    if (!blob) return false;
    openBlob(blob, `packing-list${number ? `-${number}` : ""}.pdf`);
    return true;
}

// Причина отказа сервера по-человечески: чек-лист реквизитов (код compliance) называет поля, которых
// не хватает — коды переводятся словами и с подсказкой, где заполнить (lib/finance/complianceLabels.ts),
// иначе человек видел «act: seller_ua_id, ua_vat_certificate, signer» и не понимал, что делать.
// Остальные ошибки показываются текстом сервера.
export async function explainPdfFailure(res: Response, unknown: string, locale?: string): Promise<string> {
    // Язык интерфейса — первая часть адреса (/de/..., /ua/...): те же слова, что видит человек в кабинете
    const lang = locale ?? (typeof window !== "undefined" ? window.location.pathname.split("/")[1] || "ua" : "ua");
    try {
        const body = (await res.json()) as { code?: string; message?: string; missing?: string[] };
        if (body.code === "compliance" && Array.isArray(body.missing) && body.missing.length) {
            return explainCompliance(body.missing, lang);
        }
        // Отказ по режиму рынка: сервер объясняет, для какой страны функция
        if (body.code === "market" && body.message) return body.message;
        if (body.message) return body.message;
    } catch { /* не JSON — остаётся общий текст */ }
    return unknown;
}

// Скачивание файла с авторизацией: обычная <a href> не отправляет заголовок с токеном, поэтому
// выгрузки (CSV/XML для ДПС, DATEV, QML) и печатные бланки провайдеров качаются через fetch —
// иначе сервер отвечает «Unauthorized», и в браузере открывается голый JSON вместо файла.
export async function downloadAuthed(url: string, filename: string, fallbackError: string): Promise<boolean> {
    try {
        const res = await fetch(url, { headers: authHeaders(false) });
        if (!res.ok) {
            toast.error(await explainPdfFailure(res, fallbackError));
            return false;
        }
        saveBlob(await res.blob(), filename);
        return true;
    } catch {
        toast.error(fallbackError);
        return false;
    }
}

// Предпросмотр бланка: тоже требует токена — открываем blob-адресом в новой вкладке
export async function openAuthedPreview(url: string, fallbackError: string): Promise<boolean> {
    const blob = await fetchPdf(url, fallbackError);
    if (!blob) return false;
    openBlob(blob, "preview.pdf");
    return true;
}
