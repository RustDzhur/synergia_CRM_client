"use client";
import RecordsPage from "../shared/records/RecordsPage";
import { MARKETING } from "./config";
import AdsPanel from "../Ads/AdsPanel";
import StartTab from "./StartTab";

// Marketing (/crm/marketing): Start (создать кампанию по каналу), Campaigns, Ads, Ad performance (Google Ads / Meta Ads), Segments, Sales Boost, My Templates.
// Таблицы общие — см. shared/records; здесь описание раздела (config.ts) и вкладка Start.
export default function Marketing() {
	return <RecordsPage config={MARKETING} openTabOnParam={{ param: "ads", tab: "performance" }} renderCustom={(tab, api) => (tab === "performance" ? <AdsPanel /> : <StartTab {...api} />)} />;
}
