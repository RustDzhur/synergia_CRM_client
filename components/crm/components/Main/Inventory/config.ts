import { SectionConfig, seedRecord as rec } from "../shared/records/config";

// Раздел Inventory Management. В макете описана только вкладка Inventory (Name, Inventory Document, Type, Status,
// Responsible Person); колонки остальных вкладок — по смыслу раздела.
export const INVENTORY: SectionConfig = {
	section: "inventory",
	namespace: "inventory",
	tabs: ["inventory", "sales", "transfers", "writeoffs", "customers", "products"],
	fields: {
		inventory: [
			{ key: "name", type: "text", required: true },
			{ key: "document", type: "text", wide: true },
			{ key: "type", type: "select", options: ["full", "partial", "cycle"] },
			{ key: "status", type: "select", options: ["draft", "in_progress", "completed"] },
			{ key: "responsible", type: "text", wide: true },
		],
		sales: [
			{ key: "name", type: "text", required: true },
			{ key: "customer", type: "text" },
			{ key: "date", type: "date" },
			{ key: "status", type: "select", options: ["draft", "confirmed", "shipped", "closed"] },
			{ key: "total", type: "number" },
			{ key: "responsible", type: "text", wide: true },
		],
		transfers: [
			{ key: "name", type: "text", required: true },
			{ key: "from", type: "text" },
			{ key: "to", type: "text" },
			{ key: "date", type: "date" },
			{ key: "status", type: "select", options: ["draft", "in_transit", "received"] },
			{ key: "responsible", type: "text", wide: true },
		],
		writeoffs: [
			{ key: "name", type: "text", required: true },
			{ key: "reason", type: "select", options: ["damaged", "expired", "lost", "other"] },
			{ key: "date", type: "date" },
			{ key: "amount", type: "number" },
			{ key: "status", type: "select", options: ["draft", "approved"] },
			{ key: "responsible", type: "text", wide: true },
		],
		customers: [
			{ key: "name", type: "text", required: true },
			{ key: "email", type: "text", wide: true },
			{ key: "phone", type: "text" },
			{ key: "company", type: "text" },
			{ key: "status", type: "select", options: ["active", "inactive"] },
			{ key: "responsible", type: "text", wide: true },
		],
		products: [
			{ key: "name", type: "text", required: true },
			{ key: "sku", type: "text" },
			{ key: "category", type: "text" },
			{ key: "stock", type: "number" },
			{ key: "price", type: "number" },
			{ key: "status", type: "select", options: ["in_stock", "low", "out"] },
		],
	},
	seed: {
		inventory: [
			rec("inv-1", { name: "Main warehouse", document: "INV-2023-001", type: "full", status: "completed", responsible: "Tarik Abaza" }),
			rec("inv-2", { name: "Store no. 2", document: "INV-2023-002", type: "partial", status: "in_progress", responsible: "Oliver Miller" }),
			rec("inv-3", { name: "Spare parts", document: "INV-2023-003", type: "cycle", status: "draft", responsible: "Sven Back" }),
		],
		sales: [
			rec("so-1", { name: "SO-1001", customer: "Acme GmbH", date: "2023-06-20", status: "shipped", total: "1250", responsible: "Tarik Abaza" }),
			rec("so-2", { name: "SO-1002", customer: "Nordic Trade", date: "2023-06-22", status: "confirmed", total: "480", responsible: "Oliver Miller" }),
		],
		transfers: [
			rec("tr-1", { name: "TR-501", from: "Main warehouse", to: "Store no. 2", date: "2023-06-18", status: "received", responsible: "Sven Back" }),
			rec("tr-2", { name: "TR-502", from: "Store no. 2", to: "Spare parts", date: "2023-06-23", status: "in_transit", responsible: "Tarik Abaza" }),
		],
		writeoffs: [
			rec("wo-1", { name: "WO-77", reason: "damaged", date: "2023-06-15", amount: "35", status: "approved", responsible: "Oliver Miller" }),
		],
		customers: [
			rec("cu-1", { name: "Acme GmbH", email: "office@acme.example", phone: "+49 30 1234567", company: "Acme", status: "active", responsible: "Tarik Abaza" }),
			rec("cu-2", { name: "Nordic Trade", email: "info@nordic.example", phone: "+46 8 555 010", company: "Nordic Trade AB", status: "inactive", responsible: "Sven Back" }),
		],
		products: [
			rec("pr-1", { name: "Office chair", sku: "CH-001", category: "Furniture", stock: "24", price: "89", status: "in_stock" }),
			rec("pr-2", { name: "Desk lamp", sku: "LP-014", category: "Lighting", stock: "3", price: "19", status: "low" }),
			rec("pr-3", { name: "Monitor stand", sku: "MS-220", category: "Accessories", stock: "0", price: "45", status: "out" }),
		],
	},
};
