import { SectionConfig } from "../shared/records/config";

// Сколько правил и триггеров разрешает текущий тариф (плашка «You Can Use 5 Rules And Triggers On Your Current Plan»)
export const PLAN_LIMITS: Record<string, number> = { free: 5, standard: 30, professional: 200 };

export const TIMINGS = ["immediately", "after_1h", "after_1d", "after_3d"];
export const EVENTS = ["deal_created", "deal_stage", "contact_created", "lead_created", "message_received", "call_missed", "task_created", "deadline"];
export const ACTIONS = ["notify", "create_task", "add_note", "move_stage", "send_email", "webhook", "ai_action"];

// Раздел Automation. В макете описана вкладка Automation Rules (правила и триггеры по этапам сделок);
// таблицы Variables, Constants и Test Logs — по смыслу раздела.
// Правила — вкладка со своим содержимым (customTabs), поэтому у неё в fields только поля окна правки.
export const AUTOMATION: SectionConfig = {
	section: "automation",
	namespace: "automation",
	tabs: ["rules", "variables", "constants", "logs"],
	customTabs: ["rules"],
	fields: {
		rules: [],
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
	// тестовых данных нет: всё, что видно в таблицах, — настоящие записи фирмы, и именно их использует движок автоматизации
	seed: { rules: [], variables: [], constants: [], logs: [] },
	statusColors: { success: "#2DDEB6", error: "#EB5757" },
};
