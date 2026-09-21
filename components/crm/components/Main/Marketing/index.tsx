"use client";
import RecordsPage from "../shared/records/RecordsPage";
import { MARKETING } from "./config";
import StartTab from "./StartTab";

// Marketing (/crm/marketing): Start (создать кампанию по каналу), Campaigns, Ads, Segments, Sales Boost, My Templates.
// Таблицы общие — см. shared/records; здесь описание раздела (config.ts) и вкладка Start.
export default function Marketing() {
	return <RecordsPage config={MARKETING} renderCustom={(_tab, api) => <StartTab {...api} />} />;
}
