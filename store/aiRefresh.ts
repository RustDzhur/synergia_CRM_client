import { useCrmStore } from "./useCrmStore";
import { useContactStore } from "./useContactStore";
import { useCompaniesStore } from "./useCompaniesStore";
import { useTaskStore } from "./useTaskStore";
import { useEmployeeStore } from "./useEmployeeStore";
import { useFinanceStore } from "./useFinanceStore";

// Айрис меняет данные на сервере, а открытая страница держит свою копию в браузере — без обновления человек видел
// старую картинку до перезагрузки (карточки не двигались, кнопки заказа не «нажимались»). После каждого выполненного
// действия перечитываем те данные, которых оно касается, и сообщаем событием iris:changed страницам, у которых данные
// не в общих хранилищах (например, закупки).
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
    let crm = false, people = false, tasks = false, finance = false, employees = false;
    for (const a of done) {
        if (CRM.has(a.tool)) { crm = true; people = true; }
        if (TASKS.has(a.tool)) tasks = true;
        if (FINANCE.has(a.tool)) finance = true;
        if (a.tool === "save_employee_contract") employees = true;
        if (a.tool === "delete_record") {
            const e = String(a.args?.entity ?? "");
            if (["contact", "company", "deal"].includes(e)) { crm = true; people = true; }
            else if (e === "task") tasks = true;
            else finance = true; // expense, quote, order, draft_invoice, supplier, product
        }
    }
    try {
        if (crm) void useCrmStore.getState().refresh();
        if (people) { void useContactStore.getState().fetchContacts(); void useCompaniesStore.getState().fetchCompanies(); }
        if (tasks) void useTaskStore.getState().fetchTasks();
        if (employees) void useEmployeeStore.getState().fetchEmployees();
        if (finance) {
            const f = useFinanceStore.getState();
            void f.loadOrders(); void f.loadInvoices(); void f.loadExpenses(); void f.loadQuotes(); void f.loadContracts(); void f.loadProducts(); void f.loadDashboard();
        }
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("iris:changed", { detail: { tools: done.map((d) => d.tool) } }));
    } catch { /* обновление — удобство; на сами данные оно не влияет */ }
}
