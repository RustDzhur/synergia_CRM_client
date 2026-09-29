"use client";
import RecordsPage from "../shared/records/RecordsPage";
import { INVENTORY } from "./config";

// Inventory Management (/crm/inventory): шесть вкладок (Inventory, Sales Orders, Transfers, Write-Offs, Customers, Products).
// Вся логика таблицы, окна записи и хранилища общая — см. shared/records; здесь только описание раздела (config.ts).
export default function Inventory() {
	return <RecordsPage config={INVENTORY} />;
}
