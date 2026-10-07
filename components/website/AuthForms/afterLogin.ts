import { readPendingPlan, clearPendingPlan } from "@/config/pendingPlan";

// Что делать сразу после входа: если на лендинге выбирали платный тариф до регистрации — на его оплату, иначе в CRM.
// Полная загрузка, а не переход внутри страницы: данные разделов (задачи, сделки, счета…) лежат в памяти вкладки,
// и при смене аккаунта новый пользователь на миг видел бы чужие, пока не придёт ответ сервера
export function finishLogin(locale: string) {
	const pending = readPendingPlan();
	if (pending) {
		clearPendingPlan();
		window.location.assign(`/${locale}/crm/upgrade?startPlan=${pending.plan}&interval=${pending.interval}`);
		return;
	}
	window.location.assign(`/${locale}/crm`);
}
