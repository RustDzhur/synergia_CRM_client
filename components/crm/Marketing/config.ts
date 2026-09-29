import { SectionConfig } from "../shared/records/config";

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
	seed: {},
};
