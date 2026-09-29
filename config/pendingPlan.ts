// Тариф, выбранный на лендинге ДО регистрации (кнопка "Choose Plan" на платной карточке): запоминается в localStorage
// и используется после успешного входа, чтобы сразу отправить нового пользователя на оплату этого тарифа,
// а не просто в пустой CRM. См. PaidPlan.tsx (пишет), SigninForm.tsx (читает и ведёт на /crm/upgrade), Upgrade/index.tsx
// (по query-параметрам startPlan/interval сама запускает Stripe Checkout).
export const PENDING_PLAN_KEY = "crm.pendingPlanUpgrade";

export type PendingPlan = { plan: "standard" | "professional"; interval: "month" | "year" };

export function readPendingPlan(): PendingPlan | null {
	try {
		const raw = localStorage.getItem(PENDING_PLAN_KEY);
		if (!raw) return null;
		const v = JSON.parse(raw);
		if (v && (v.plan === "standard" || v.plan === "professional") && (v.interval === "month" || v.interval === "year")) return v;
	} catch {
		/* приватный режим / битые данные */
	}
	return null;
}

export function clearPendingPlan() {
	try {
		localStorage.removeItem(PENDING_PLAN_KEY);
	} catch {
		/* приватный режим */
	}
}
