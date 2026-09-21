import { SectionConfig, seedRecord as rec } from "../shared/records/config";

// Сколько правил и триггеров разрешает текущий тариф (плашка «You Can Use 5 Rules And Triggers On Your Current Plan»)
export const PLAN_LIMIT = 5;

export const TIMINGS = ["immediately", "after_1h", "after_1d", "after_3d"];
export const TARGETS = ["responsible", "client", "manager", "team"];
export const SCOPES = ["general", "personal"];

// Раздел Automation. В макете описана вкладка Automation Rules (правила и триггеры по этапам сделок);
// таблицы Variables, Constants и Test Logs — по смыслу раздела.
// Правила — вкладка со своим содержимым (customTabs), поэтому у неё в fields только поля окна правки.
export const AUTOMATION: SectionConfig = {
	section: "automation",
	namespace: "automation",
	tabs: ["rules", "variables", "constants", "logs"],
	customTabs: ["rules"],
	fields: {
		rules: [
			{ key: "name", type: "text", required: true },
			{ key: "kind", type: "select", options: ["rule", "trigger"] },
			{ key: "stage", type: "select" }, // список этапов даёт страница (этапы сделок из CRM)
			{ key: "timing", type: "select", options: TIMINGS },
			{ key: "target", type: "select", options: TARGETS },
			{ key: "scope", type: "select", options: SCOPES },
		],
		variables: [
			{ key: "name", type: "text", required: true },
			{ key: "value", type: "text" },
			{ key: "type", type: "select", options: ["text", "number", "date"] },
			{ key: "description", type: "text", wide: true },
		],
		constants: [
			{ key: "name", type: "text", required: true },
			{ key: "value", type: "text" },
			{ key: "description", type: "text", wide: true },
		],
		logs: [
			{ key: "name", type: "text", required: true }, // название правила, для которого запускали проверку
			{ key: "date", type: "date" },
			{ key: "status", type: "select", options: ["success", "error"] },
			{ key: "message", type: "text", wide: true },
		],
	},
	seed: {
		// stage "" — «любой этап»: тестовые правила видны под каждым этапом, пока пользователь не привяжет их к своему
		rules: [
			rec("ru-1", { name: "Notify the manager", kind: "rule", stage: "", timing: "immediately", target: "responsible", scope: "general" }),
			rec("ru-2", { name: "Send welcome e-mail", kind: "rule", stage: "", timing: "after_1h", target: "client", scope: "general" }),
			rec("ru-3", { name: "Remind about the task", kind: "rule", stage: "", timing: "after_1d", target: "responsible", scope: "general" }),
			rec("ru-4", { name: "Escalate to the manager", kind: "rule", stage: "", timing: "after_3d", target: "manager", scope: "personal" }),
			rec("tg-1", { name: "Deal created", kind: "trigger", stage: "", timing: "immediately", target: "team", scope: "general" }),
		],
		variables: [
			rec("va-1", { name: "client_name", value: "{{deal.client}}", type: "text", description: "Client name from the deal" }),
			rec("va-2", { name: "deal_amount", value: "0", type: "number", description: "Deal amount" }),
		],
		constants: [
			rec("co-1", { name: "COMPANY_NAME", value: "Synergia", description: "Shown in e-mail signatures" }),
			rec("co-2", { name: "SUPPORT_EMAIL", value: "support@synergia.example", description: "Support address" }),
		],
		logs: [
			rec("lo-1", { name: "Notify the manager", date: "2023-06-21", status: "success", message: "Message delivered" }),
			rec("lo-2", { name: "Send welcome e-mail", date: "2023-06-22", status: "error", message: "Recipient address is empty" }),
		],
	},
	statusColors: { success: "#2DDEB6", error: "#EB5757" },
};
