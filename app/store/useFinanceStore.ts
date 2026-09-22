import { create } from "zustand";
import { apiCall } from "./crmApi";

export interface LineItem { description: string; qty: number; unitPrice: number; taxRate: number; product?: string }
export interface Totals { net: number; tax: number; gross: number }

export interface Product {
	id: string; name: string; sku: string; type: "good" | "service"; unit: string;
	purchasePrice: number; salePrice: number; taxRate: number | null; stockQty: number; reorderLevel: number; archived: boolean;
}
export interface Order {
	id: string; number: string; status: "draft" | "confirmed" | "fulfilled" | "invoiced" | "closed" | "cancelled";
	contact: string; company: string; customerName: string; deal: string; contract: string;
	items: LineItem[]; currency: string; notes: string; responsible: string; invoice: string; totals: Totals;
	createdAt: string; updatedAt: string;
}
export interface Invoice {
	id: string; number: string; kind: "invoice" | "credit_note"; creditFor: string;
	contact: string; company: string; customerName: string; customerAddress: string; customerTaxId: string;
	deal: string; order: string; contract: string; items: LineItem[]; currency: string; smallBusinessNote: boolean;
	issueDate: string; dueDate: string; notes: string; status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
	sentAt: string; paidAt: string; paidAmount: number; totals: Totals; createdAt: string; updatedAt: string;
}
export interface Expense {
	id: string; vendor: string; category: string; amount: number; taxRate: number; currency: string; date: string;
	deal: string; order: string; receipt: string; recurring: string; notes: string; createdByName: string;
}
export interface FinanceSettings {
	country: string; currency: string; smallBusiness: boolean; legalName: string; address: string; taxId: string;
	iban: string; bic: string; paymentTermsDays: number; invoicePrefix: string; quotePrefix: string;
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
	products: Product[]; orders: Order[]; invoices: Invoice[]; expenses: Expense[];
	settings: FinanceSettings | null; countries: CountryOption[]; dashboard: FinanceDashboard | null;
	loading: boolean;
	loadProducts: () => Promise<void>;
	loadOrders: () => Promise<void>;
	loadInvoices: () => Promise<void>;
	loadExpenses: () => Promise<void>;
	loadSettings: () => Promise<void>;
	loadDashboard: (months?: number) => Promise<void>;
	saveSettings: (patch: Partial<FinanceSettings>) => Promise<string | null>;
	createProduct: (data: Partial<Product>) => Promise<string | null>;
	updateProduct: (id: string, data: Partial<Product>) => Promise<string | null>;
	deleteProduct: (id: string) => Promise<void>;
	createOrder: (data: Partial<Order>) => Promise<string | null>;
	updateOrder: (id: string, data: Partial<Order>) => Promise<string | null>;
	deleteOrder: (id: string) => Promise<string | null>;
	invoiceOrder: (id: string) => Promise<string | null>;
	createInvoice: (data: Partial<Invoice>) => Promise<string | null>;
	sendInvoice: (id: string) => Promise<string | null>;
	payInvoice: (id: string, amount?: number) => Promise<string | null>;
	createExpense: (data: Partial<Expense>) => Promise<string | null>;
	deleteExpense: (id: string) => Promise<void>;
}

// Finance (счета, заказы, товары, расходы, склад) — раздел, который заменил собой старое «Inventory Management».
export const useFinanceStore = create<FinanceStore>()((set, get) => ({
	products: [], orders: [], invoices: [], expenses: [], settings: null, countries: [], dashboard: null, loading: false,

	loadProducts: async () => { const r = await apiCall<Product[]>("/api/products"); if (r.ok && r.data) set({ products: r.data }); },
	loadOrders: async () => { const r = await apiCall<Order[]>("/api/orders"); if (r.ok && r.data) set({ orders: r.data }); },
	loadInvoices: async () => { const r = await apiCall<Invoice[]>("/api/invoices"); if (r.ok && r.data) set({ invoices: r.data }); },
	loadExpenses: async () => { const r = await apiCall<Expense[]>("/api/expenses"); if (r.ok && r.data) set({ expenses: r.data }); },
	loadSettings: async () => {
		const r = await apiCall<{ settings: FinanceSettings; countries: CountryOption[] }>("/api/finance/settings");
		if (r.ok && r.data) set({ settings: r.data.settings, countries: r.data.countries });
	},
	loadDashboard: async (months = 6) => {
		set({ loading: true });
		const r = await apiCall<FinanceDashboard>(`/api/finance/dashboard?months=${months}`);
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
	sendInvoice: async (id) => {
		const r = await apiCall<Invoice>(`/api/invoices/${id}/send`, "POST", {});
		if (!r.ok || !r.data) return r.message;
		set((s) => ({ invoices: s.invoices.map((i) => (i.id === id ? (r.data as Invoice) : i)) }));
		return null;
	},
	payInvoice: async (id, amount) => {
		const r = await apiCall<Invoice>(`/api/invoices/${id}/pay`, "POST", amount !== undefined ? { amount } : {});
		if (!r.ok || !r.data) return r.message;
		set((s) => ({ invoices: s.invoices.map((i) => (i.id === id ? (r.data as Invoice) : i)) }));
		return null;
	},

	createExpense: async (data) => {
		const r = await apiCall<Expense>("/api/expenses", "POST", data);
		if (!r.ok || !r.data) return r.message;
		set((s) => ({ expenses: [r.data as Expense, ...s.expenses] }));
		return null;
	},
	deleteExpense: async (id) => { const before = get().expenses; set({ expenses: before.filter((e) => e.id !== id) }); const r = await apiCall(`/api/expenses/${id}`, "DELETE"); if (!r.ok) set({ expenses: before }); },
}));
