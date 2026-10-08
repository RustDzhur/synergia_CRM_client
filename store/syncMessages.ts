import toast from "react-hot-toast";

// Тексты отказов сервера при удалении клиента и колонки воронки. Хранилища не знают о next-intl, поэтому язык берётся
// из адреса страницы (/de, /en, /ua), как в store/crmApi.ts.
type Lang = "de" | "en" | "ua";
const lang = (): Lang => {
    if (typeof window === "undefined") return "de";
    return ((window.location.pathname.match(/^\/(de|en|ua)(?=\/|$)/) ?? [])[1] as Lang) ?? "de";
};

const TEXT = {
    unpaid: {
        de: (n: number) => `Löschen nicht möglich: ${n} unbezahlte Rechnung(en). Erst bezahlen oder stornieren.`,
        en: (n: number) => `Cannot delete: ${n} unpaid invoice(s). Settle or cancel them first.`,
        ua: (n: number) => `Видалити не можна: неоплачених рахунків — ${n}. Спочатку оплатіть або скасуйте їх.`,
    },
    openWork: {
        de: (d: number, t: number) => `Es gibt ${d} offene Deal(s) und ${t} offene Aufgabe(n). Verknüpfungen werden entfernt, die Einträge bleiben. Trotzdem löschen?`,
        en: (d: number, t: number) => `There are ${d} open deal(s) and ${t} open task(s). Their link will be removed, the records stay. Delete anyway?`,
        ua: (d: number, t: number) => `Є відкритих угод — ${d}, відкритих задач — ${t}. Зв'язок буде знято, самі записи залишаться. Видалити?`,
    },
    lastStage: {
        de: "Die einzige Spalte mit Karten kann nicht gelöscht werden: Es gibt keine Spalte zum Verschieben.",
        en: "The only column with cards cannot be deleted: there is no column to move them to.",
        ua: "Єдину колонку з картками видалити не можна: немає колонки, куди їх перенести.",
    },
    failed: { de: "Aktion fehlgeschlagen", en: "Action failed", ua: "Не вдалося виконати дію" },
};

export interface Blockers { unpaidInvoices?: number; openDeals?: number; openTasks?: number }

export const unpaidMessage = (b: Blockers) => TEXT.unpaid[lang()](b.unpaidInvoices ?? 0);
export const openWorkQuestion = (b: Blockers) => TEXT.openWork[lang()](b.openDeals ?? 0, b.openTasks ?? 0);
export const lastStageMessage = () => TEXT.lastStage[lang()];
export const failedMessage = () => TEXT.failed[lang()];
export const showError = (message: string) => { toast.error(message); };
