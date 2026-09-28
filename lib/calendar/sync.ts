import { icloudSync } from "@/lib/ical/icloud";
import { googleSync } from "@/lib/google/calendar";
import { findGcal } from "@/lib/google";
import { findIcloud } from "@/lib/ical/icloud";
import Integration from "@/models/Integration";

// Синхронизация внешних календарей. Провайдеры независимы: если один отключён или упал,
// второй всё равно должен отработать — иначе одна отвалившаяся авторизация остановила бы весь календарь.
//
// Своего расписания у синхронизации нет: она запускается тем же частым обходом, что и напоминания
// (app/api/cron/reminders), а пока кто-то работает в CRM — ещё и опросом уведомлений. Между запусками
// держим паузу, иначе каждый опрос дёргал бы Google и Apple.

const SYNC_THROTTLE_MS = 15 * 60_000;
const lastSync = new Map<string, number>();

export interface SyncResult {
    google?: { created: number; updated: number; removed: number } | null;
    icloud?: { created: number; updated: number; removed: number } | null;
    errors: string[];
}

/** Окно синхронизации: назад на месяц, вперёд на полгода — больше в календаре фирмы и не нужно */
export function syncWindow(now = new Date()): { from: string; to: string } {
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    return { from: iso(new Date(now.getTime() - 30 * 86_400_000)), to: iso(new Date(now.getTime() + 180 * 86_400_000)) };
}

export async function syncCalendars(org: string, opts: { force?: boolean; now?: Date } = {}): Promise<SyncResult> {
    const now = opts.now ?? new Date();
    if (!opts.force) {
        const last = lastSync.get(org) ?? 0;
        if (now.getTime() - last < SYNC_THROTTLE_MS) return { errors: [] };
        lastSync.set(org, now.getTime());
    }

    // Что вообще подключено: незачем ходить к провайдеру, которого нет
    const [gcal, icloud] = await Promise.all([findGcal(org), findIcloud(org)]);
    if (!gcal && !icloud) return { errors: [] };

    const { from, to } = syncWindow(now);
    const result: SyncResult = { errors: [] };

    if (gcal && gcal.status === "connected") {
        try {
            result.google = await googleSync(org, from, to);
        } catch (e) {
            const message = e instanceof Error ? e.message : "Google sync failed";
            result.errors.push(`Google: ${message}`);
            // Ошибку запоминаем в интеграции, чтобы интерфейс показал её и предложил переподключиться
            await Integration.updateOne({ _id: gcal._id }, { $set: { status: "error", error: message } }).catch(() => undefined);
        }
    }

    if (icloud && icloud.status === "connected") {
        try {
            const { warning, ...counts } = await icloudSync(org, from, to);
            result.icloud = counts;
            // Отказ по части календарей — не повод считать подключение сломанным: остальные
            // синхронизируются, а причину показываем в окне настроек.
            // Статус «error» здесь не ставим — с ним синхронизация прекратилась бы совсем.
            if (warning) result.errors.push(`iCloud: ${warning}`);
            await Integration.updateOne({ _id: icloud._id }, { $set: { error: warning ?? "" } }).catch(() => undefined);
        } catch (e) {
            const message = e instanceof Error ? e.message : "iCloud sync failed";
            result.errors.push(`iCloud: ${message}`);
            await Integration.updateOne({ _id: icloud._id }, { $set: { status: "error", error: message } }).catch(() => undefined);
        }
    }

    if (gcal && gcal.status === "connected") await Integration.updateOne({ _id: gcal._id }, { $set: { lastSyncAt: now } }).catch(() => undefined);
    if (icloud && icloud.status === "connected") await Integration.updateOne({ _id: icloud._id }, { $set: { lastSyncAt: now } }).catch(() => undefined);

    return result;
}
