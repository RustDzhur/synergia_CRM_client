// Общий модуль «вкладки + таблица записей + окно записи». Раздел описывается одним объектом SectionConfig
// (вкладки, поля, тестовые данные), а сама страница — <RecordsPage config={...} />. Так сделаны Inventory и Marketing.

export type FieldType = "text" | "number" | "date" | "select";

export interface Field {
	key: string; // ключ значения и часть ключа перевода: f_<key> (в namespace раздела)
	type: FieldType;
	options?: string[]; // для select: значения, переводятся как o_<value>; если не заданы — список даёт страница (fieldOptions)
	required?: boolean;
	wide?: boolean; // в окне записи поле на всю ширину
}

export interface RecordItem { id: string; values: Record<string, string> }

// Пункт списка, который страница подставляет в поле динамически (например, этапы сделок из CRM)
export interface FieldOption { value: string; label: string }

export interface SectionConfig {
	section: string; // ключ раздела в хранилище: "inventory", "marketing"
	namespace: string; // i18n namespace с ключами tab_<tab>, s_<tab>, f_<field>, o_<option>
	tabs: string[];
	// поля таблицы вкладки; у вкладок без таблицы (customTabs) полей нет
	fields: Record<string, Field[]>;
	// вкладки с собственным содержимым вместо таблицы (например, Start в Marketing)
	customTabs?: string[];
	// тестовые данные: показываются, пока пользователь ничего не менял; после первой правки вкладка сохраняется в localStorage
	seed: Record<string, RecordItem[]>;
	// цвет точки статуса по значению
	statusColors?: Record<string, string>;
}

// Запись тестовых данных: id задаётся явно, чтобы он был одинаковым на сервере и в браузере
export const seedRecord = (id: string, values: Record<string, string>): RecordItem => ({ id, values });

// Палитра статусов из макета CRM
export const STATUS_COLORS: Record<string, string> = {
	draft: "#999999", inactive: "#999999", paused: "#999999",
	in_progress: "#34A2E8", confirmed: "#34A2E8", in_transit: "#34A2E8", scheduled: "#34A2E8",
	completed: "#2DDEB6", shipped: "#2DDEB6", closed: "#2DDEB6", received: "#2DDEB6", approved: "#2DDEB6", active: "#2DDEB6", in_stock: "#2DDEB6", sent: "#2DDEB6", finished: "#2DDEB6",
	low: "#F4A100", out: "#EB5757",
};
