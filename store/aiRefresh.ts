import { invalidate, type Entity } from "./invalidate";
import { useEmployeeStore } from "./useEmployeeStore";

// Айрис меняет данные на сервере, а открытая страница держит свою копию в браузере — без обновления человек видел
// старую картинку до перезагрузки (карточки не двигались, кнопки заказа не «нажимались»). После каждого выполненного
// действия перечитываем те данные, которых оно касается (общая шина store/invalidate.ts) и сообщаем событием
// iris:changed страницам, у которых данные не в общих хранилищах (например, закупки).
const CRM = new Set(["restore_lead", "cleanup_leads", "create_deal", "update_deal_stage", "update_deal", "update_contact", "update_company", "create_contact", "create_company", "add_note"]);
const TASKS = new Set(["create_task", "update_task"]);
const FINANCE = new Set([
    "create_invoice", "create_quote", "create_order", "create_contract", "create_expense", "mark_invoice_paid", "send_invoice", "issue_fiscal_receipt",
    "create_bom", "create_production_order", "launch_production_order", "produce_output", "cancel_production_order", "run_production",
    "update_invoice", "delete_invoice", "create_demo_data", "delete_demo_data", "clear_catalog", "archive_product", "restock_goods", "receive_purchase_order", "pay_supplier_invoice",
    "update_order_status", "invoice_order", "decide_quote", "quote_to_order", "contract_action", "create_product", "adjust_stock", "create_supplier", "create_purchase_order",
]);

export interface DoneAction { tool: string; args?: Record<string, unknown> }

export function refreshAfterActions(done: DoneAction[]) {
    if (!done.length) return;
    const entities = new Set<Entity>();
    let employees = false;
    for (const a of done) {
        if (CRM.has(a.tool)) { entities.add("deals"); entities.add("contacts"); entities.add("companies"); }
        if (TASKS.has(a.tool)) entities.add("tasks");
        // оплата, счёт, заказ меняют ещё и сделки и ленты клиентов (оплата выигрывает сделку)
        if (FINANCE.has(a.tool)) { entities.add("finance"); entities.add("deals"); entities.add("contacts"); entities.add("companies"); }
        if (a.tool === "save_employee_contract") employees = true;
        if (a.tool === "delete_record") {
            const e = String(a.args?.entity ?? "");
            if (["contact", "company", "deal"].includes(e)) { entities.add("deals"); entities.add("contacts"); entities.add("companies"); }
            else if (e === "task") entities.add("tasks");
            else entities.add("finance"); // expense, quote, order, draft_invoice, supplier, product
        }
    }
    try {
        invalidate(...Array.from(entities));
        if (employees) void useEmployeeStore.getState().fetchEmployees();
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("iris:changed", { detail: { tools: done.map((d) => d.tool) } }));
    } catch { /* обновление — удобство; на сами данные оно не влияет */ }
}
