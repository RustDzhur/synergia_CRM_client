import type { Expense, Invoice } from "@/store/useFinanceStore";
import type { MatchCandidate } from "@/lib/finance/bank";

export type Kind = "bank" | "cash";
export type TxMatchType = "" | "invoice" | "expense" | "manual";

export interface BankAccountRow {
	id: string;
	kind: Kind;
	name: string;
	iban: string;
	currency: string;
	openingBalance: number;
	openingDate: string;
	active: boolean;
	balance: number;
	transactionCount: number;
	unmatched: number;
}

// Движение в том виде, в каком его отдаёт toDTO (app/api/bank/transactions/route.ts)
export interface BankTx {
	id: string;
	account: string;
	date: string;
	amount: number;
	currency: string;
	counterparty: string;
	reference: string;
	matchType: TxMatchType;
	matchId: string;
	source: "import" | "manual" | "auto";
	notes: string;
}

export interface ImportResult {
	imported: number;
	skipped: number;
	suggestions: number;
	transactions: BankTx[];
}

const today = () => new Date().toISOString().slice(0, 10);

export const EMPTY_ACCOUNT = { name: "", kind: "bank" as Kind, iban: "", bic: "", openingBalance: "", openingDate: today() };
export const EMPTY_MANUAL = { date: today(), amount: "", counterparty: "", reference: "", notes: "" };
export type AccountForm = typeof EMPTY_ACCOUNT;
export type ManualForm = typeof EMPTY_MANUAL;

// Сверять движение можно только в разумном окне вокруг его даты: счёт мог быть выставлен раньше,
// а оплата прийти позже. ±90 дней покрывает и предоплату, и просрочку в полквартала.
export const MATCH_WINDOW_DAYS = 90;

export const dayGap = (a: string, b: string) => {
	const da = Date.parse(`${a}T00:00:00Z`);
	const db = Date.parse(`${b}T00:00:00Z`);
	return Number.isFinite(da) && Number.isFinite(db) ? Math.abs(da - db) / 86400000 : 999;
};
const withinWindow = (date: string, around: string) => dayGap(date, around) <= MATCH_WINDOW_DAYS;

// Цвет суммы по её знаку: приход — салатовый, расход — красный, ноль — обычный текст.
export const amountColor = (value: number) => (value > 0 ? "#c6ff4d" : value < 0 ? "#EB5757" : undefined);

// Кандидаты на сверку: приход ищем среди открытых счетов клиентам, расход — среди расходов;
// всё, что вне окна вокруг даты движения, не показываем, чтобы список оставался коротким.
export function buildCandidates(tx: BankTx, invoices: Invoice[], expenses: Expense[]): MatchCandidate[] {
	if (tx.amount > 0) {
		return invoices
			.filter((i) => i.kind === "invoice" && (i.status === "sent" || i.status === "overdue") && withinWindow(i.issueDate, tx.date))
			.map((i) => ({ id: i.id, label: `${i.number} · ${i.customerName}`, amount: i.totals.gross, date: i.issueDate }));
	}
	return expenses
		.filter((e) => withinWindow(e.date, tx.date))
		.map((e) => ({ id: e.id, label: e.vendor || "—", amount: -(Number(e.amount) || 0), date: e.date }));
}

// Известные отказы сервера переводим на язык интерфейса, всё остальное показываем как пришло
export function serverMessage(t: (key: string) => string, message: string): string {
	const m = (message || "").toLowerCase();
	if (m.includes("already exists")) return t("bankErrDuplicate");
	if (m.includes("name is required")) return t("bankErrName");
	if (m.includes("no transactions found")) return t("bankErrNoRows");
	if (m.includes("account not found")) return t("bankErrAccountNotFound");
	if (m.includes("account is required")) return t("bankErrAccountRequired");
	if (m.includes("date must be")) return t("bankErrDate");
	if (m.includes("amount must not be zero")) return t("bankErrAmount");
	if (m.includes("matchid is required")) return t("bankErrMatchId");
	// «id is required» проверяем после matchId: строка «matchId is required» содержит и «id is required»
	if (m.includes("id is required")) return t("bankErrId");
	if (m.includes("invoice not found")) return t("bankErrInvoiceNotFound");
	if (m.includes("expense not found")) return t("bankErrExpenseNotFound");
	if (m.includes("transaction not found")) return t("bankErrTxNotFound");
	return message || t("bankSaveFailed");
}
