import { sendFromAccount } from "@/lib/mail";
import Integration from "@/models/Integration";

type Lang = "de" | "en" | "ua";

const TEXT: Record<Lang, (o: { firm: string; url: string; existing: boolean }) => { subject: string; text: string }> = {
    de: ({ firm, url, existing }) => ({
        subject: `Einladung zu ${firm} in Firmspace CRM`,
        text: existing
            ? `Sie wurden zur Firma «${firm}» in Firmspace CRM hinzugefügt.\n\nMelden Sie sich mit Ihrem bestehenden Konto an und wählen Sie die Firma im Firmenwechsler: ${url}`
            : `Sie wurden zur Firma «${firm}» in Firmspace CRM eingeladen.\n\nRegistrieren Sie sich mit dieser E-Mail-Adresse, dann erscheint die Firma automatisch in Ihrem Konto: ${url}`,
    }),
    en: ({ firm, url, existing }) => ({
        subject: `Invitation to ${firm} in Firmspace CRM`,
        text: existing
            ? `You were added to the firm «${firm}» in Firmspace CRM.\n\nSign in with your existing account and pick the firm in the firm switcher: ${url}`
            : `You were invited to the firm «${firm}» in Firmspace CRM.\n\nSign up with this email address and the firm appears in your account automatically: ${url}`,
    }),
    ua: ({ firm, url, existing }) => ({
        subject: `Запрошення до «${firm}» у Firmspace CRM`,
        text: existing
            ? `Вас додано до фірми «${firm}» у Firmspace CRM.\n\nУвійдіть у свій акаунт і оберіть фірму в перемикачі фірм: ${url}`
            : `Вас запрошено до фірми «${firm}» у Firmspace CRM.\n\nЗареєструйтеся з цією e-mail адресою — і фірма з’явиться у вашому акаунті автоматично: ${url}`,
    }),
};

// Письмо о доступе к фирме. Уходит из почтового ящика самой фирмы (своего отправителя у платформы нет);
// нет ящика или отправка не удалась — возвращаем false, доступ или приглашение при этом уже сохранены.
export async function sendInviteEmail(org: string, to: string, firm: string, url: string, existing: boolean, lang: string): Promise<boolean> {
    try {
        const account = await Integration.findOne({ owner: org, type: "mail", status: "connected" });
        if (!account) return false;
        const { subject, text } = TEXT[(["de", "en", "ua"].includes(lang) ? lang : "en") as Lang]({ firm, url, existing });
        await sendFromAccount(account, { to, subject, text });
        return true;
    } catch {
        return false;
    }
}
