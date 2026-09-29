import { SectionConfig } from "../shared/records/config";
import { knowledgeSeed } from "./knowledgeSeed";

// База знаний фирмы: статьи с заголовком, текстом и категорией. Вкладки — категории,
// чтобы инструкции лежали по темам, а не одной свалкой. Данные хранит та же машинерия,
// что и остальные таблицы разделов (SectionRecord), поэтому сервер и права уже работают.
export const KNOWLEDGE: SectionConfig = {
	section: "company",
	namespace: "company",
	tabs: ["general", "sales", "finance", "team"],
	fields: {
		general: [
			{ key: "title", type: "text", required: true },
			{ key: "category", type: "select", options: ["process", "tools", "policy", "onboarding"] },
			{ key: "body", type: "text", wide: true },
			{ key: "author", type: "text" },
			{ key: "updated", type: "date" },
		],
		sales: [
			{ key: "title", type: "text", required: true },
			{ key: "category", type: "select", options: ["script", "pricing", "objection", "process"] },
			{ key: "body", type: "text", wide: true },
			{ key: "author", type: "text" },
			{ key: "updated", type: "date" },
		],
		finance: [
			{ key: "title", type: "text", required: true },
			{ key: "category", type: "select", options: ["invoice", "tax", "expenses", "deadlines"] },
			{ key: "body", type: "text", wide: true },
			{ key: "author", type: "text" },
			{ key: "updated", type: "date" },
		],
		team: [
			{ key: "title", type: "text", required: true },
			{ key: "category", type: "select", options: ["onboarding", "holidays", "contacts", "policy"] },
			{ key: "body", type: "text", wide: true },
			{ key: "author", type: "text" },
			{ key: "updated", type: "date" },
		],
	},
	// Стартовые статьи показываются, пока фирма не добавила свои: пустая база знаний выглядит как ошибка,
	// а так видно, что сюда писать и в каком виде. Здесь — набор по умолчанию (английский);
	// страница «Моя компания» подставляет статьи на языке интерфейса (knowledgeSeed.ts).
	seed: knowledgeSeed("en"),
};
