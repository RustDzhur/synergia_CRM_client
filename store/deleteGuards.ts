import { apiCall } from "./crmApi";
import { openWorkQuestion, showError, unpaidMessage, failedMessage } from "./syncMessages";

// Удаление клиента (контакта или фирмы) с ответами сервера об охране связей:
//  • unpaid_invoices — жёсткий отказ, показываем причину;
//  • has_open_work   — открытые сделки и задачи: спрашиваем подтверждение и повторяем с ?force=1.
// Возвращает true, если запись удалена.
export async function deleteWithGuards(url: string): Promise<boolean> {
    const first = await apiCall<{ ok: boolean }>(url, "DELETE");
    if (first.ok) return true;
    if (first.status === 409 && first.code === "unpaid_invoices") {
        showError(unpaidMessage(await blockersOf(url)));
        return false;
    }
    if (first.status === 409 && first.code === "has_open_work") {
        const b = await blockersOf(url);
        if (typeof window !== "undefined" && window.confirm(openWorkQuestion(b))) return (await apiCall<{ ok: boolean }>(`${url}?force=1`, "DELETE")).ok;
        return false;
    }
    showError(first.message || failedMessage());
    return false;
}

// Счётчики приходят отдельным запросом: apiCall не отдаёт тело ответа 409.
async function blockersOf(url: string) {
    const res = await apiCall<{ unpaidInvoices: number; openDeals: number; openTasks: number }>(`${url}/blockers`);
    return res.data ?? { unpaidInvoices: 0, openDeals: 0, openTasks: 0 };
}
