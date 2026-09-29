import { SectionConfig, seedRecord as rec } from "../shared/records/config";

const CHANNELS = ["email_campaign", "sms", "messengers", "voice", "audio_call", "email"];

// Раздел Marketing. В макете описана только вкладка Start («Create Campaign» и карточки каналов);
// таблицы остальных вкладок (Campaigns, Ads, Segments, Sales Boost, My Templates) — по смыслу раздела.
export const MARKETING: SectionConfig = {
	section: "marketing",
	namespace: "marketing",
	tabs: ["start", "campaigns", "ads", "performance", "segments", "boost", "templates"],
	customTabs: ["start", "performance"],
	fields: {
		campaigns: [
			{ key: "name", type: "text", required: true },
			{ key: "channel", type: "select", options: CHANNELS },
			{ key: "segment", type: "text" },
			{ key: "status", type: "select", options: ["draft", "scheduled", "sent"] },
			{ key: "date", type: "date" },
			{ key: "recipients", type: "number" },
		],
		ads: [
			{ key: "name", type: "text", required: true },
			{ key: "platform", type: "select", options: ["facebook", "google", "linkedin", "twitter"] },
			{ key: "budget", type: "number" },
			{ key: "status", type: "select", options: ["draft", "active", "paused", "finished"] },
			{ key: "start", type: "date" },
			{ key: "end", type: "date" },
		],
		segments: [
			{ key: "name", type: "text", required: true },
			{ key: "description", type: "text", wide: true },
			{ key: "contacts", type: "number" },
			{ key: "updated", type: "date" },
		],
		boost: [
			{ key: "name", type: "text", required: true },
			{ key: "type", type: "select", options: ["discount", "bundle", "loyalty", "upsell"] },
			{ key: "value", type: "number" },
			{ key: "status", type: "select", options: ["draft", "active", "finished"] },
			{ key: "start", type: "date" },
			{ key: "end", type: "date" },
		],
		templates: [
			{ key: "name", type: "text", required: true },
			{ key: "channel", type: "select", options: CHANNELS },
			{ key: "author", type: "text" },
			{ key: "updated", type: "date" },
		],
	},
	seed: {
		campaigns: [
			rec("cmp-1", { name: "Summer newsletter", channel: "email_campaign", segment: "All customers", status: "sent", date: "2023-06-12", recipients: "1240" }),
			rec("cmp-2", { name: "Flash sale", channel: "sms", segment: "Active customers", status: "scheduled", date: "2023-07-02", recipients: "560" }),
		],
		ads: [
			rec("ad-1", { name: "Brand awareness", platform: "facebook", budget: "500", status: "active", start: "2023-06-01", end: "2023-06-30" }),
			rec("ad-2", { name: "Search: CRM software", platform: "google", budget: "1200", status: "paused", start: "2023-05-15", end: "2023-07-15" }),
		],
		segments: [
			rec("sg-1", { name: "All customers", description: "Everyone in the customer base", contacts: "1240", updated: "2023-06-20" }),
			rec("sg-2", { name: "Active customers", description: "Purchased in the last 90 days", contacts: "560", updated: "2023-06-22" }),
		],
		boost: [
			rec("bo-1", { name: "Summer discount", type: "discount", value: "10", status: "active", start: "2023-06-15", end: "2023-08-31" }),
			rec("bo-2", { name: "Chair + lamp bundle", type: "bundle", value: "15", status: "draft", start: "2023-07-01", end: "2023-07-31" }),
		],
		templates: [
			rec("tp-1", { name: "Welcome e-mail", channel: "email_campaign", author: "Tarik Abaza", updated: "2023-06-10" }),
			rec("tp-2", { name: "Order shipped", channel: "sms", author: "Oliver Miller", updated: "2023-06-18" }),
		],
	},
};
