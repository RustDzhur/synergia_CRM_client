import type { UzProfile } from "@/lib/validation/uz";
import { create } from "zustand";
import { registerRefresher } from "./invalidate";
import { apiCall } from "./crmApi";

export interface LineItem { description: string; qty: number; unitPrice: number; taxRate: number; product?: string; unit?: string }

// Итог отправки документа клиенту: либо адрес, на который ушло письмо, либо текст ошибки и её код
// ("no_recipient" — нет адреса у клиента, "no_mailbox" — не подключён ящик), по которому окно решает, что делать.
export type SendOutcome = { ok: true; sentTo: string } | { ok: false; message: string; code: string; missing: string[] };
export interface Totals { net: number; tax: number; gross: number }

export interface Product {
	id: string; name: string; sku: string; type: "good" | "service"; unit: string;
	purchasePrice: number; salePrice: number; taxRate: number | null; stockQty: number; reorderLevel: number; archived: boolean;
	image?: string;
	// Штрихкод с этикетки: поиск товара и касса ищут и по нему (сканер вводит его как текст)
	barcode?: string;
	// Типы цен и ступени по количеству (ТЗ §12): «опт / партнер», цена и минимальное количество
	prices?: Array<{ type: string; price: number; minQty: number }>;
	// ВЭД (ТЗ §12): код УКТ ЗЕД/HS, вес единицы и страна происхождения — для пакувального листа
	hsCode?: string;
	weightKg?: number;
	originCountry?: string;
}
export interface OrderWaybill {
	number: string; ref?: string; status: string; statusAt: string; cost: number;
	city: string; warehouse: string; recipient: string; phone: string; weight: number; cod: number;
	seats?: number; street?: string; house?: string; flat?: string; returnNumber?: string; returnAt?: string;
}
export interface Order {
	id: string; number: string; status: "draft" | "confirmed" | "fulfilled" | "invoiced" | "paid" | "closed" | "cancelled";
	contact: string; company: string; customerName: string; deal: string; contract: string;
	items: LineItem[]; currency: string; notes: string; responsible: string; invoice: string; totals: Totals;
	// Накладная (Lieferschein): номер присваивается при первой выписке, дата — фактической поставки
	deliveryNoteNumber?: string; deliveryDate?: string;
	actNumber?: string; actDate?: string;
	packingNumber?: string; packingDate?: string;
	// Доставка «Новою Поштою» (Украина): номер ТТН и статус посылки — null, если ТТН ещё не создана
	waybill?: OrderWaybill | null;
	// Укрпошта: штрихкод и последний статус отправления — заполняется вручную или создаётся через ecom
	ukrposhta?: { uuid?: string; barcode: string; status: string; place: string; postOffice?: string; cod?: number; statusAt: string } | null;
	// телефон клиента из связанного контакта (подставляется в окно ТТН)
	contactPhone?: string;
	template: string; createdAt: string; updatedAt: string;
}
export interface Invoice {
	id: string; number: string; kind: "invoice" | "credit_note"; creditFor: string;
	contact: string; company: string; customerName: string; customerAddress: string; customerTaxId: string;
	deal: string; order: string; contract: string; items: LineItem[]; currency: string; smallBusinessNote: boolean;
	issueDate: string; dueDate: string; notes: string;
	// Дата/период оказания услуги — обязательное поле немецкого счёта (§14 Abs. 4 Nr. 6 UStG), в PDF печатается как Leistungsdatum
	supplyDate: string; supplyPeriodFrom: string; supplyPeriodTo: string;
	// ВЭД (ТЗ §12): условие поставки и номер митной декларації
	incoterms?: string; customsDeclaration?: string;
	status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
	sentAt: string; sentTo: string; paidAt: string; paidAmount: number;
	dunningLevel?: number; dunningFee?: number; dunningLog?: { level: number; sentAt: string; fee: number; dueDate: string; method: string }[];
	reminderCount: number; lastReminderAt: string; recurringSource: string;
	template: string; totals: Totals; createdAt: string; updatedAt: string;
	// Фискальный чек ПРРО (Украина): номер, ссылка для клиента и текст ошибки, если чек не пробился
	fiscal?: { code: string; url: string; at: string; error: string } | null;
	// Ссылка на оплату от эквайринга фирмы и способ, которым счёт закрыли
	payLink?: { provider: string; url: string; id: string } | null;
	paidVia?: string;
}
export interface RecurringInvoice {
	id: string; active: boolean; contact: string; company: string;
	customerName: string; customerAddress: string; customerTaxId: string;
	items: LineItem[]; currency: string; notes: string;
	interval: "monthly" | "yearly"; dayOfMonth: number; autoSend: boolean;
	nextRunDate: string; lastRunAt: string; lastInvoice: string;
	totals: Totals; createdAt: string; updatedAt: string;
}
export interface Expense {
	id: string; vendor: string; category: string; amount: number; taxRate: number; currency: string; date: string;
	deal: string; order: string; receipt: string; recurring: string; notes: string; createdByName: string;
}
export interface QuoteVersion { version: number; customerName: string; currency: string; items: LineItem[]; totals: Totals; savedAt: string }
export interface Quote {
	id: string; number: string; status: "draft" | "sent" | "accepted" | "declined" | "expired";
	contact: string; company: string; customerName: string; deal: string; order: string;
	items: LineItem[]; currency: string; issueDate: string; validUntil: string; notes: string; sentAt: string; sentTo: string;
	template: string; version: number; versions: QuoteVersion[];
	totals: Totals; createdAt: string; updatedAt: string;
}
export interface Contract {
	id: string; number: string; status: "draft" | "active" | "completed" | "cancelled";
	contact: string; company: string; customerName: string; deal: string; value: number; currency: string;
	startDate: string; endDate: string; notes: string; body: string; signedAt: string; file: string;
	template: string; templateId: string; fields: Record<string, string>; createdAt: string; updatedAt: string;
}
export interface ContractTemplate { id: string; name: string; body: string; fields: { key: string; label: string; type: string; source: string }[]; active: boolean }
export interface FinanceSettings {
	country: string; currency: string; smallBusiness: boolean; legalName: string; address: string; taxId: string;
	// Реквизиты и контакты для шапки документов, свой текст внизу и логотип (data-URL) — печатает lib/finance/layouts.ts
	vatId: string; registerNumber: string; managingDirector: string; phone: string; email: string; website: string;
	logo: string; footerText: string;
	iban: string; bic: string; paymentTermsDays: number; invoicePrefix: string; quotePrefix: string;
	creditNotePrefix: string; deliveryNotePrefix: string; actPrefix: string; reminderIntervalDays: number;
	// Оформление по умолчанию для всех документов и код оплаты на счетах; у отдельного документа шаблон свой
	template: string; paymentQr: boolean;
	// Украинская налоговая модель — показывается при стране UA (см. models/FinanceSettings.ts)
	uaLegalForm: "fop" | "tov" | "other"; uaGroup: number; uaSingleRate: number; uaVatPayer: boolean;
	uaEsvMonthly: number; uaMilitaryRate: number; uaMilitaryFixed: number; uaVatLimit: number;
	uaVatPeriod: "month" | "quarter";
	// Полный профиль украинской фирмы (ТЗ §6): система налогообложения, реквизиты, банк, подписант
	// с изображениями подписи и печати, лимиты групп по годам и допустимые ставки ПДВ
	uaTaxSystem: string; uaVatRegDate: string; uaVatCertificate: string; uaVatRates: number[];
	uaEdrpou: string; uaIpn: string; uaKved: string[]; uaBank: string; uaIban: string; uaMfo: string;
	uaSignerName: string; uaSignerPosition: string; uaSignature: string; uaSeal: string;
	uaLimits: Array<{ year: number; group: number; amount: number }>;
	// Реквизиты и налоговый режим фирмы рынка UZ (lib/validation/uz.ts)
	uz?: UzProfile;
	// Наценка к курсу НБУ (%), 0 — чистый курс
	rateMargin: number;
	// Справочник категорий расходов фирмы; пусто — форма предлагает типовой набор страны
	expenseCategories: string[];
	// Типовой текст договора фирмы с подстановками {{…}}; пусто — встроенный типовой текст
	contractTemplate: string;
	contractData?: Record<string, string>;
}
export interface CountryOption { code: string; name: string; standard: number; reduced?: number; label: string }
export interface FinanceDashboard {
	revenue: number; outstandingAmount: number; overdueAmount: number; expenses: number; profit: number;
	invoiceCounts: { paid: number; outstanding: number; overdue: number; draft: number };
	orderCounts: Record<string, number>;
	series: { month: string; revenue: number; expenses: number }[];
	lowStock: { id: string; name: string; stockQty: number; reorderLevel: number }[];
}

interface FinanceStore {
	products: Product[]; orders: Order[]; invoices: Invoice[]; expenses: Expense[]; quotes: Quote[]; contracts: Contract[];
	contractTemplates: ContractTemplate[];
	recurringInvoices: RecurringInvoice[];
	settings: FinanceSettings | null; countries: CountryOption[]; dashboard: FinanceDashboard | null;
	loading: boolean;
	loadProducts: () => Promise<void>;
	loadOrders: () => Promise<void>;
	loadInvoices: () => Promise<void>;
	loadExpenses: () => Promise<void>;
	loadQuotes: () => Promise<void>;
	loadContracts: () => Promise<void>;
	loadContractTemplates: () => Promise<void>;
	createContractTemplate: (data: { name: string; body: string; fields: unknown[] }) => Promise<string | null>;
	updateContractTemplate: (id: string, data: Partial<{ name: string; body: string; fields: unknown[]; active: boolean }>) => Promise<string | null>;
	deleteContractTemplate: (id: string) => Promise<string | null>;
	loadRecurringInvoices: () => Promise<void>;
	loadSettings: () => Promise<void>;
	/** months — последние N месяцев; year — календарный год (12 столбцов, январь–декабрь) */
	loadDashboard: (months?: number, year?: number) => Promise<void>;
	saveSettings: (patch: Partial<FinanceSettings>) => Promise<string | null>;
	createProduct: (data: Partial<Product>) => Promise<string | null>;
	updateProduct: (id: string, data: Partial<Product>) => Promise<string | null>;
	deleteProduct: (id: string) => Promise<void>;
	createOrder: (data: Partial<Order>) => Promise<string | null>;
	updateOrder: (id: string, data: Partial<Order>) => Promise<string | null>;
	deleteOrder: (id: string) => Promise<string | null>;
	invoiceOrder: (id: string) => Promise<string | null>;
	createInvoice: (data: Partial<Invoice>) => Promise<string | null>;
	updateInvoice: (id: string, data: Partial<Invoice>) => Promise<string | null>;
	sendInvoice: (id: string, to?: string, accountId?: string) => Promise<SendOutcome>;
	payInvoice: (id: string, amount?: number) => Promise<string | null>;
	duplicateInvoice: (id: string) => Promise<string | null>;
	issueCreditNote: (id: string, data?: { items?: LineItem[]; notes?: string }) => Promise<string | null>;
	createRecurringInvoice: (data: Partial<RecurringInvoice>) => Promise<string | null>;
	updateRecurringInvoice: (id: string, data: Partial<RecurringInvoice>) => Promise<string | null>;
	deleteRecurringInvoice: (id: string) => Promise<string | null>;
	createExpense: (data: Partial<Expense>) => Promise<string | null>;
	deleteExpense: (id: string) => Promise<void>;
	createQuote: (data: Partial<Quote>) => Promise<string | null>;
	updateQuote: (id: string, data: Partial<Quote>) => Promise<string | null>;
	deleteQuote: (id: string) => Promise<string | null>;
	sendQuote: (id: string, to?: string, accountId?: string) => Promise<SendOutcome>;
	decideQuote: (id: string, accepted: boolean) => Promise<string | null>;
	quoteToOrder: (id: string) => Promise<string | null>;
	createContract: (data: Partial<Contract>) => Promise<string | null>;
	updateContract: (id: string, data: Partial<Contract>) => Promise<string | null>;
	deleteContract: (id: string) => Promise<string | null>;
	signContract: (id: string) => Promise<string | null>;
	completeContract: (id: string) => Promise<string | null>;
	cancelContract: (id: string) => Promise<string | null>;
}

// Finance (счета, заказы, товары, расходы, склад) — раздел, который заменил собой старое «Inventory Management».
let dashboardRequest = 0;

export const useFinanceStore = create<FinanceStore>()((set, get) => ({
	products: [], orders: [], invoices: [], expenses: [], quotes: [], contracts: [], contractTemplates: [], recurringInvoices: [], settings: null, countries: [], dashboard: null, loading: false,

	loadProducts: async () => { const r = await apiCall<Product[]>("/api/products"); if (r.ok && r.data) set({ products: r.data }); },
	loadOrders: async () => { const r = await apiCall<Order[]>("/api/orders"); if (r.ok && r.data) set({ orders: r.data }); },
	loadInvoices: async () => { const r = await apiCall<Invoice[]>("/api/invoices"); if (r.ok && r.data) set({ invoices: r.data }); },
	loadExpenses: async () => { const r = await apiCall<Expense[]>("/api/expenses"); if (r.ok && r.data) set({ expenses: r.data }); },
	loadQuotes: async () => { const r = await apiCall<Quote[]>("/api/quotes"); if (r.ok && r.data) set({ quotes: r.data }); },
	loadContracts: async () => { const r = await apiCall<Contract[]>("/api/contracts"); if (r.ok && r.data) set({ contracts: r.data }); },
	loadRecurringInvoices: async () => { const r = await apiCall<RecurringInvoice[]>("/api/recurring-invoices"); if (r.ok && r.data) set({ recurringInvoices: r.data }); },
	loadSettings: async () => {
		const r = await apiCall<{ settings: FinanceSettings; countries: CountryOption[] }>("/api/finance/settings");
		if (r.ok && r.data) set({ settings: r.data.settings, countries: r.data.countries });
	},
	loadDashboard: async (months, year) => {
		// Без параметров (так зовут обновление после действий Айрис) — календарный год, 12 столбцов, как на экранах Finance и Dashboard.
		// Раньше по умолчанию были «последние 6 месяцев», и обновление урезало график, показанный до этого.
		const query = months && !year ? `months=${months}` : `year=${year || new Date().getFullYear()}`;
		const mine = ++dashboardRequest;
		set({ loading: true });
		const r = await apiCall<FinanceDashboard>(`/api/finance/dashboard?${query}`);
		// ответ устаревшего запроса не должен затирать более свежий
		if (mine !== dashboardRequest) return;
		set({ loading: false, ...(r.ok && r.data ? { dashboard: r.data } : {}) });
	},
	saveSettings: async (patch) => {
		const r = await apiCall<FinanceSettings>("/api/finance/settings", "PATCH", patch);
		if (!r.ok) return r.message;
		set({ settings: r.data });
		return null;
	},

	createProduct: async (data) => {
		const r = await apiCall<Product>("/api/products", "POST", data);
		if (!r.ok || !r.data) return r.message;
		set((s) => ({ products: [...s.products, r.data as Product].sort((a, b) => a.name.localeCompare(b.name)) }));
		return null;
	},
	updateProduct: async (id, data) => {
		const r = await apiCall<Product>(`/api/products/${id}`, "PATCH", data);
		if (!r.ok || !r.data) return r.message;
		set((s) => ({ products: s.products.map((p) => (p.id === id ? (r.data as Product) : p)) }));
		return null;
	},
	deleteProduct: async (id) => { const before = get().products; set({ products: before.filter((p) => p.id !== id) }); const r = await apiCall(`/api/products/${id}`, "DELETE"); if (!r.ok) set({ products: before }); },

	createOrder: async (data) => {
		const r = await apiCall<Order>("/api/orders", "POST", data);
		if (!r.ok || !r.data) return r.message;
		set((s) => ({ orders: [r.data as Order, ...s.orders] }));
		return null;
	},
	updateOrder: async (id, data) => {
		const r = await apiCall<Order>(`/api/orders/${id}`, "PATCH", data);
		if (!r.ok || !r.data) return r.message;
		set((s) => ({ orders: s.orders.map((o) => (o.id === id ? (r.data as Order) : o)) }));
		return null;
	},
	deleteOrder: async (id) => { const r = await apiCall(`/api/orders/${id}`, "DELETE"); if (!r.ok) return r.message; set((s) => ({ orders: s.orders.filter((o) => o.id !== id) })); return null; },
	invoiceOrder: async (id) => {
		const r = await apiCall<Invoice>(`/api/orders/${id}/invoice`, "POST", {});
		if (!r.ok || !r.data) return r.message;
		set((s) => ({ invoices: [r.data as Invoice, ...s.invoices] }));
		await get().loadOrders();
		return null;
	},

	createInvoice: async (data) => {
		const r = await apiCall<Invoice>("/api/invoices", "POST", data);
		if (!r.ok || !r.data) return r.message;
		set((s) => ({ invoices: [r.data as Invoice, ...s.invoices] }));
		return null;
	},
	updateInvoice: async (id, data) => {
		const r = await apiCall<Invoice>(`/api/invoices/${id}`, "PATCH", data);
		if (!r.ok || !r.data) return r.message;
		set((s) => ({ invoices: s.invoices.map((i) => (i.id === id ? (r.data as Invoice) : i)) }));
		return null;
	},
	sendInvoice: async (id, to, accountId) => {
		// to — адрес, введённый вручную; без него сервер сам берёт e-mail контакта или фирмы клиента.
		// accountId — выбранный ящик отправки; без него сервер берёт первый подключённый
		const r = await apiCall<Invoice>(`/api/invoices/${id}/send`, "POST", { ...(to ? { to } : {}), ...(accountId ? { accountId } : {}) });
		if (!r.ok || !r.data) return { ok: false, message: r.message, code: r.code, missing: r.missing };
		const sent = r.data as Invoice;
		set((s) => ({ invoices: s.invoices.map((i) => (i.id === id ? sent : i)) }));
		return { ok: true, sentTo: sent.sentTo };
	},
	payInvoice: async (id, amount) => {
		const r = await apiCall<Invoice>(`/api/invoices/${id}/pay`, "POST", amount !== undefined ? { amount } : {});
		if (!r.ok || !r.data) return r.message;
		set((s) => ({ invoices: s.invoices.map((i) => (i.id === id ? (r.data as Invoice) : i)) }));
		return null;
	},
	duplicateInvoice: async (id) => {
		const r = await apiCall<Invoice>(`/api/invoices/${id}/duplicate`, "POST", {});
		if (!r.ok || !r.data) return r.message;
		set((s) => ({ invoices: [r.data as Invoice, ...s.invoices] }));
		return null;
	},
	issueCreditNote: async (id, data) => {
		const r = await apiCall<Invoice>(`/api/invoices/${id}/credit-note`, "POST", data ?? {});
		if (!r.ok || !r.data) return r.message;
		set((s) => ({ invoices: [r.data as Invoice, ...s.invoices] }));
		return null;
	},

	createRecurringInvoice: async (data) => {
		const r = await apiCall<RecurringInvoice>("/api/recurring-invoices", "POST", data);
		if (!r.ok || !r.data) return r.message;
		set((s) => ({ recurringInvoices: [r.data as RecurringInvoice, ...s.recurringInvoices] }));
		return null;
	},
	updateRecurringInvoice: async (id, data) => {
		const r = await apiCall<RecurringInvoice>(`/api/recurring-invoices/${id}`, "PATCH", data);
		if (!r.ok || !r.data) return r.message;
		set((s) => ({ recurringInvoices: s.recurringInvoices.map((x) => (x.id === id ? (r.data as RecurringInvoice) : x)) }));
		return null;
	},
	deleteRecurringInvoice: async (id) => {
		const r = await apiCall(`/api/recurring-invoices/${id}`, "DELETE");
		if (!r.ok) return r.message;
		set((s) => ({ recurringInvoices: s.recurringInvoices.filter((x) => x.id !== id) }));
		return null;
	},

	createExpense: async (data) => {
		const r = await apiCall<Expense>("/api/expenses", "POST", data);
		if (!r.ok || !r.data) return r.message;
		set((s) => ({ expenses: [r.data as Expense, ...s.expenses] }));
		return null;
	},
	deleteExpense: async (id) => { const before = get().expenses; set({ expenses: before.filter((e) => e.id !== id) }); const r = await apiCall(`/api/expenses/${id}`, "DELETE"); if (!r.ok) set({ expenses: before }); },

	createQuote: async (data) => {
		const r = await apiCall<Quote>("/api/quotes", "POST", data);
		if (!r.ok || !r.data) return r.message;
		set((s) => ({ quotes: [r.data as Quote, ...s.quotes] }));
		return null;
	},
	updateQuote: async (id, data) => {
		const r = await apiCall<Quote>(`/api/quotes/${id}`, "PATCH", data);
		if (!r.ok || !r.data) return r.message;
		set((s) => ({ quotes: s.quotes.map((q) => (q.id === id ? (r.data as Quote) : q)) }));
		return null;
	},
	deleteQuote: async (id) => { const r = await apiCall(`/api/quotes/${id}`, "DELETE"); if (!r.ok) return r.message; set((s) => ({ quotes: s.quotes.filter((q) => q.id !== id) })); return null; },
	sendQuote: async (id, to, accountId) => {
		const r = await apiCall<Quote>(`/api/quotes/${id}/send`, "POST", { ...(to ? { to } : {}), ...(accountId ? { accountId } : {}) });
		if (!r.ok || !r.data) return { ok: false, message: r.message, code: r.code, missing: r.missing };
		const sent = r.data as Quote;
		set((s) => ({ quotes: s.quotes.map((q) => (q.id === id ? sent : q)) }));
		return { ok: true, sentTo: sent.sentTo };
	},
	decideQuote: async (id, accepted) => {
		const r = await apiCall<Quote>(`/api/quotes/${id}/decide`, "POST", { accepted });
		if (!r.ok || !r.data) return r.message;
		set((s) => ({ quotes: s.quotes.map((q) => (q.id === id ? (r.data as Quote) : q)) }));
		return null;
	},
	quoteToOrder: async (id) => {
		const r = await apiCall<Order>(`/api/quotes/${id}/order`, "POST", {});
		if (!r.ok || !r.data) return r.message;
		set((s) => ({ orders: [r.data as Order, ...s.orders] }));
		await get().loadQuotes();
		return null;
	},

	createContract: async (data) => {
		const r = await apiCall<Contract>("/api/contracts", "POST", data);
		if (!r.ok || !r.data) return r.message;
		set((s) => ({ contracts: [r.data as Contract, ...s.contracts] }));
		return null;
	},
	updateContract: async (id, data) => {
		const r = await apiCall<Contract>(`/api/contracts/${id}`, "PATCH", data);
		if (!r.ok || !r.data) return r.message;
		set((s) => ({ contracts: s.contracts.map((c) => (c.id === id ? (r.data as Contract) : c)) }));
		return null;
	},
	deleteContract: async (id) => { const r = await apiCall(`/api/contracts/${id}`, "DELETE"); if (!r.ok) return r.message; set((s) => ({ contracts: s.contracts.filter((c) => c.id !== id) })); return null; },
	signContract: async (id) => {
		const r = await apiCall<Contract>(`/api/contracts/${id}/sign`, "POST", {});
		if (!r.ok || !r.data) return r.message;
		set((s) => ({ contracts: s.contracts.map((c) => (c.id === id ? (r.data as Contract) : c)) }));
		return null;
	},
	completeContract: async (id) => {
		const r = await apiCall<Contract>(`/api/contracts/${id}/complete`, "POST", {});
		if (!r.ok || !r.data) return r.message;
		set((s) => ({ contracts: s.contracts.map((c) => (c.id === id ? (r.data as Contract) : c)) }));
		return null;
	},
	cancelContract: async (id) => {
		const r = await apiCall<Contract>(`/api/contracts/${id}/cancel`, "POST", {});
		if (!r.ok || !r.data) return r.message;
		set((s) => ({ contracts: s.contracts.map((c) => (c.id === id ? (r.data as Contract) : c)) }));
		return null;
	},

	loadContractTemplates: async () => { const r = await apiCall<ContractTemplate[]>("/api/contract-templates"); if (r.ok && r.data) set({ contractTemplates: r.data }); },
	createContractTemplate: async (data) => {
		const r = await apiCall<ContractTemplate>("/api/contract-templates", "POST", data);
		if (!r.ok || !r.data) return r.message;
		set((s) => ({ contractTemplates: [...s.contractTemplates, r.data as ContractTemplate] }));
		return null;
	},
	updateContractTemplate: async (id, data) => {
		const r = await apiCall<ContractTemplate>(`/api/contract-templates/${id}`, "PATCH", data);
		if (!r.ok || !r.data) return r.message;
		set((s) => ({ contractTemplates: s.contractTemplates.map((t) => (t.id === id ? (r.data as ContractTemplate) : t)) }));
		return null;
	},
	deleteContractTemplate: async (id) => { const r = await apiCall(`/api/contract-templates/${id}`, "DELETE"); if (!r.ok) return r.message; set((s) => ({ contractTemplates: s.contractTemplates.filter((t) => t.id !== id) })); return null; },
}));

registerRefresher("finance", () => {
	const f = useFinanceStore.getState();
	return Promise.all([f.loadOrders(), f.loadInvoices(), f.loadExpenses(), f.loadQuotes(), f.loadContracts(), f.loadDashboard()]);
});
