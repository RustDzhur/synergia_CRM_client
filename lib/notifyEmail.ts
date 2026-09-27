import { sendFromAccount } from "@/lib/mail";
import Integration from "@/models/Integration";
import User from "@/models/User";

// Уведомление на почту. Настройки в профиле («уведомления по почте» и тихие часы) до этого только
// хранились и никем не читались: письма не уходили вообще. Отправляем через почтовый ящик самой фирмы —
// своего транзакционного отправителя у платформы нет, а чужой ящик без согласия фирмы использовать нельзя.
//
// Если ящик не подключён или пользователь выключил письма, функция молча ничего не делает:
// это не ошибка, а нормальный случай, и напоминание всё равно останется в колокольчике.

const toMinutes = (t: string) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(t ?? "");
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

// Попадает ли текущее время в тихие часы. Промежуток может переходить через полночь (22:00–08:00).
export function inQuietHours(prefs: { muteEmail?: boolean; muteFrom?: string; muteTo?: string }, now = new Date()): boolean {
    if (!prefs.muteEmail) return false;
    const from = toMinutes(prefs.muteFrom ?? "");
    const to = toMinutes(prefs.muteTo ?? "");
    if (from === null || to === null || from === to) return false;
    const cur = now.getHours() * 60 + now.getMinutes();
    return from < to ? cur >= from && cur < to : cur >= from || cur < to;
}

// Письмо о событии календаря. Возвращает true, если письмо действительно ушло.
export async function emailReminder(org: string, userId: string, subject: string, text: string): Promise<boolean> {
    try {
        const user = await User.findById(userId).select("email notifications");
        if (!user?.email) return false;
        const prefs = (user.notifications ?? {}) as { email?: boolean; muteEmail?: boolean; muteFrom?: string; muteTo?: string };
        if (!prefs.email) return false;
        if (inQuietHours(prefs)) return false;

        // Ящик фирмы: тот же, из которого уходят письма клиентам (Web-Mails)
        const account = await Integration.findOne({ owner: org, type: "mail", status: "connected" });
        if (!account) return false;

        const sent = await sendFromAccount(account, { to: user.email, subject, text });
        return !!sent;
    } catch {
        // почта не должна ронять напоминание: уведомление в колокольчике уже создано
        return false;
    }
}
