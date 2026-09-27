// Разбор iCalendar (RFC 5545) — формат, которым отдают события CalDAV-серверы, в том числе iCloud.
// Готовой библиотеки нет и поставить нечего, поэтому парсер свой. Он намеренно узкий: читает то,
// что нужно календарю (VEVENT с датой, временем, названием, описанием, местом и повторами),
// и не пытается покрыть весь стандарт.
//
// Функции чистые — принимают текст, возвращают данные, поэтому проверяются тестом без сервера.

import { shiftDay } from "@/lib/events";

export interface IcalOccurrence {
    uid: string;
    title: string;
    description: string;
    location: string;
    start: string;   // "YYYY-MM-DDTHH:mm"
    end: string;     // "YYYY-MM-DDTHH:mm"
    allDay: boolean;
    /** RECURRENCE-ID: у повтора конкретной даты свой экземпляр — его импортируем отдельным событием */
    recurrenceId?: string;
}

/** Разворачивает свёрнутые строки: длинные значения переносятся с пробелом в начале следующей строки */
function unfold(text: string): string[] {
    const raw = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    const out: string[] = [];
    for (const line of raw) {
        if (/^[ \t]/.test(line) && out.length) out[out.length - 1] += line.slice(1);
        else out.push(line);
    }
    return out;
}

/** «DTSTART;TZID=Europe/Berlin:20260927T143000» → { name: "DTSTART", params: {...}, value: "20260927T143000" } */
function splitProperty(line: string): { name: string; params: Record<string, string>; value: string } | null {
    // двоеточие вне кавычек отделяет значение от имени и параметров
    let idx = -1;
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') quoted = !quoted;
        else if (ch === ":" && !quoted) { idx = i; break; }
    }
    if (idx === -1) return null;
    const head = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const [name, ...rest] = head.split(";");
    const params: Record<string, string> = {};
    for (const part of rest) {
        const eq = part.indexOf("=");
        if (eq > 0) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).replace(/^"|"$/g, "");
    }
    return { name: name.toUpperCase(), params, value };
}

const unescapeText = (v: string) =>
    v.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();

/** «20260927T143000» / «20260927» → { date: "2026-09-27", time: "14:30", allDay } */
export function parseIcalDate(value: string, isDate = false): { date: string; time: string; allDay: boolean } | null {
    const v = value.trim();
    if (/^\d{8}$/.test(v) || isDate) {
        const m = /^(\d{4})(\d{2})(\d{2})/.exec(v);
        return m ? { date: `${m[1]}-${m[2]}-${m[3]}`, time: "00:00", allDay: true } : null;
    }
    const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/.exec(v);
    return m ? { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}`, allDay: false } : null;
}

/** Сдвиг UTC-времени в местное. События iCloud приходят в UTC (с «Z»), показывать их нужно по-местному. */
function fromUtc(date: string, time: string, offsetMinutes: number): { date: string; time: string } {
    const [y, mo, d] = date.split("-").map(Number);
    const [h, mi] = time.split(":").map(Number);
    const t = new Date(Date.UTC(y, mo - 1, d, h, mi) + offsetMinutes * 60_000);
    return {
        date: `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`,
        time: `${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`,
    };
}

interface RawEvent {
    uid: string;
    title: string;
    description: string;
    location: string;
    start?: { date: string; time: string; allDay: boolean; utc: boolean };
    end?: { date: string; time: string; allDay: boolean; utc: boolean };
    rrule: string;
    exdates: string[];
    recurrenceId?: string;
    cancelled: boolean;
}

const addDays = shiftDay; // один и тот же пересчёт дат, что и у календарей провайдеров (lib/events.ts)

const addMonths = (date: string, months: number) => {
    const [y, m, d] = date.split("-").map(Number);
    const t = new Date(Date.UTC(y, m - 1 + months, d));
    // 31-е в коротком месяце перескакивает — возвращаем последний день нужного месяца
    if (t.getUTCDate() !== d) t.setUTCDate(0);
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
};

const WEEKDAY: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

/**
 * Разворачивает повтор в список дат внутри окна [from, to].
 * Поддержаны DAILY, WEEKLY (в том числе BYDAY), MONTHLY и YEARLY с INTERVAL, COUNT и UNTIL —
 * этого достаточно для обычных календарей. EXDATE исключает отдельные даты.
 */
export function expandRecurrence(startDate: string, rrule: string, exdates: string[], from: string, to: string, limit = 400): string[] {
    const parts: Record<string, string> = {};
    for (const chunk of rrule.split(";")) {
        const eq = chunk.indexOf("=");
        if (eq > 0) parts[chunk.slice(0, eq).toUpperCase()] = chunk.slice(eq + 1);
    }
    const freq = (parts.FREQ ?? "").toUpperCase();
    const interval = Math.max(1, Number(parts.INTERVAL) || 1);
    const count = Number(parts.COUNT) || 0;
    const until = parts.UNTIL ? parseIcalDate(parts.UNTIL)?.date ?? "" : "";
    const byDay = (parts.BYDAY ?? "").split(",").map((d) => WEEKDAY[d.trim().slice(-2).toUpperCase()]).filter((n) => n !== undefined);
    const skip = new Set(exdates);

    const out: string[] = [];
    let produced = 0;
    let cursor = startDate;

    // WEEKLY с BYDAY даёт несколько дней в неделю: считаем от начала недели события
    const weekStart = (date: string, weekday: number) => {
        const [y, m, d] = date.split("-").map(Number);
        const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
        return addDays(date, -(dow - weekday));
    };

    for (let guard = 0; guard < 5000 && produced < limit; guard++) {
        let dates: string[];
        if (freq === "WEEKLY" && byDay.length) {
            const base = weekStart(cursor, 1);
            dates = byDay.map((wd: number) => weekStart(cursor, wd)).filter((d: string) => d >= startDate).sort();
            void base;
        } else {
            dates = [cursor];
        }

        let past = true;
        for (const date of dates) {
            if (until && date > until) return out;
            if (count && produced >= count) return out;
            produced++;
            if (date >= from && date <= to && !skip.has(date)) out.push(date);
            if (date >= from) past = false;
        }

        const last = dates[dates.length - 1] ?? cursor;
        if (last > to && !(count && produced < count)) break;
        if (past && last < from) {
            // ещё не дошли до окна — шагаем дальше
        }

        if (freq === "DAILY") cursor = addDays(cursor, interval);
        else if (freq === "WEEKLY") cursor = addDays(cursor, 7 * interval);
        else if (freq === "MONTHLY") cursor = addMonths(cursor, interval);
        else if (freq === "YEARLY") cursor = addMonths(cursor, 12 * interval);
        else break;
    }
    return out;
}

/** Все события из текста iCalendar. Повторы разворачиваются в отдельные события внутри окна. */
export function parseIcal(text: string, from: string, to: string, tzOffsetMinutes = 0): IcalOccurrence[] {
    const lines = unfold(text);
    const raw: RawEvent[] = [];
    let cur: RawEvent | null = null;

    for (const line of lines) {
        const prop = splitProperty(line);
        if (!prop) continue;
        if (prop.name === "BEGIN" && prop.value.trim().toUpperCase() === "VEVENT") {
            cur = { uid: "", title: "", description: "", location: "", rrule: "", exdates: [], cancelled: false };
            continue;
        }
        if (prop.name === "END" && prop.value.trim().toUpperCase() === "VEVENT") {
            if (cur) raw.push(cur);
            cur = null;
            continue;
        }
        if (!cur) continue;

        switch (prop.name) {
            case "UID": cur.uid = prop.value.trim(); break;
            case "SUMMARY": cur.title = unescapeText(prop.value); break;
            case "DESCRIPTION": cur.description = unescapeText(prop.value); break;
            case "LOCATION": cur.location = unescapeText(prop.value); break;
            case "RRULE": cur.rrule = prop.value.trim(); break;
            case "EXDATE": {
                for (const v of prop.value.split(",")) {
                    const d = parseIcalDate(v, prop.params.VALUE === "DATE");
                    if (d) cur.exdates.push(d.date);
                }
                break;
            }
            case "RECURRENCE-ID": {
                const d = parseIcalDate(prop.value, prop.params.VALUE === "DATE");
                if (d) cur.recurrenceId = `${d.date}T${d.time}`;
                break;
            }
            case "STATUS": if (prop.value.trim().toUpperCase() === "CANCELLED") cur.cancelled = true; break;
            case "DTSTART": {
                const d = parseIcalDate(prop.value, prop.params.VALUE === "DATE");
                if (d) cur.start = { ...d, utc: /Z$/i.test(prop.value.trim()) };
                break;
            }
            case "DTEND": {
                const d = parseIcalDate(prop.value, prop.params.VALUE === "DATE");
                if (d) cur.end = { ...d, utc: /Z$/i.test(prop.value.trim()) };
                break;
            }
            default: break;
        }
    }

    const out: IcalOccurrence[] = [];
    for (const ev of raw) {
        if (ev.cancelled || !ev.start || !ev.uid) continue;
        // события без конца считаем часовыми: так они читаются в сетке календаря
        const duration = ev.end && ev.end.date >= ev.start.date
            ? Math.max(0, Date.parse(`${ev.end.date}T${ev.end.time}:00Z`) - Date.parse(`${ev.start.date}T${ev.start.time}:00Z`))
            : 60 * 60_000;

        const starts = ev.rrule && !ev.recurrenceId
            ? expandRecurrence(ev.start.date, ev.rrule, ev.exdates, from, to)
            : [ev.start.date];

        for (const date of starts) {
            // время при повторax берём от исходного события
            const shiftDays = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${ev.start.date}T00:00:00Z`)) / 86_400_000);
            let s = { date, time: ev.start.time };
            let e = { date: addDays(date, 0), time: ev.start.time };
            const endMs = Date.parse(`${date}T${ev.start.time}:00Z`) + duration;
            e = {
                date: new Date(endMs).toISOString().slice(0, 10),
                time: new Date(endMs).toISOString().slice(11, 16),
            };
            void shiftDays;
            if (ev.start.utc) { s = fromUtc(s.date, s.time, tzOffsetMinutes); e = fromUtc(e.date, e.time, tzOffsetMinutes); }
            out.push({
                // у каждого повторa свой экземпляр: id отличается датой начала
                uid: starts.length > 1 || ev.recurrenceId ? `${ev.uid}_${date}T${ev.start.time}` : ev.uid,
                title: ev.title,
                description: ev.description,
                location: ev.location,
                start: `${s.date}T${s.time}`,
                end: `${e.date}T${e.time}`,
                allDay: ev.start.allDay,
                recurrenceId: ev.recurrenceId,
            });
        }
    }
    return out;
}
