import { isPublicHttps } from "@/lib/appUrl";
import { adminEmails } from "@/lib/admin";
import { ProviderError } from "@/lib/http";
import { getRequisites, readiness } from "@/lib/transferPay";
import { checkBucket, storageProblem } from "@/lib/storage";
import { metaApp } from "@/lib/platformSettings";
import { prisma } from "@/lib/prisma";

export interface Check { id: string; ok: boolean; message: string }

const attempt = async (id: string, fn: () => Promise<string>): Promise<Check> => {
    try {
        return { id, ok: true, message: await fn() };
    } catch (e) {
        return { id, ok: false, message: e instanceof ProviderError ? e.message : (e as Error)?.message || "Failed" };
    }
};

// Проверка настройки: каждая проверка отвечает «работает» или «что не так». Секреты не показываются — только наличие и результат обращения к сервису.
export async function systemCheck(): Promise<Check[]> {
    const google = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    return Promise.all([
        attempt("database", async () => { await prisma.$queryRaw`SELECT 1`; return "PostgreSQL connected"; }),
        attempt("appUrl", async () => {
            const url = process.env.APP_URL ?? "";
            if (!isPublicHttps(url)) throw new Error("APP_URL must be a public https address without a trailing slash");
            return url;
        }),
        attempt("payments", async () => {
            const r = await getRequisites();
            const de = readiness(r, "DE"), ua = readiness(r, "UA");
            const missing = [!de.bank && "bank transfer (Germany, EUR)", !ua.bank && "bank transfer (Ukraine, UAH: requisites and UAH prices)", !de.usdt && "USDT wallet"].filter(Boolean);
            if (missing.length) throw new Error(`Payment requisites are not filled in: ${missing.join("; ")} (Admin → Payment requisites)`);
            return "Bank transfer (EUR, UAH) and USDT requisites are set";
        }),
        attempt("storage", async () => {
            const problem = storageProblem();
            if (problem) throw new Error(problem);
            await checkBucket();
            return `Local storage is writable (${process.env.LOCAL_STORAGE_ROOT})`;
        }),
        attempt("google", async () => {
            if (!google) throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are missing (needed for Gmail and Google Drive sign-in)");
            return "Google sign-in keys are set (enable the Google Drive API in Google Cloud for documents)";
        }),
        attempt("admin", async () => {
            // Доступ к админ-кабинету не зависит от переменной: администратором считается адрес из ADMIN_EMAILS, пользователь с отметкой
            // «администратор» или самый первый аккаунт (lib/admin.ts). Переменная нужна лишь чтобы закрепить конкретный адрес.
            const pinned = adminEmails().length;
            return pinned ? `${pinned} administrator address(es) pinned by ADMIN_EMAILS` : "Administrator is the first registered account (optional: set ADMIN_EMAILS to pin an address)";
        }),
        attempt("cron", async () => {
            if (!process.env.CRON_SECRET) throw new Error("CRON_SECRET is not set");
            return "Daily automation job is protected";
        }),
        attempt("meta", async () => {
            const app = await metaApp();
            if (!app.appId) throw new Error("The Meta app is not set (Messenger and WhatsApp sign-in needs it; add it in the admin panel)");
            if (!app.appSecret) throw new Error("The App Secret is missing — add it in the admin panel (Messenger and WhatsApp sign-in needs it)");
            return `Meta app ${app.appId} is set (pages and WhatsApp numbers connect by Facebook sign-in)`;
        }),
    ]);
}
