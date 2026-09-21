import { connectDB } from "@/lib/mongodb";
import { isPublicHttps } from "@/lib/appUrl";
import { adminEmails } from "@/lib/admin";
import { ProviderError } from "@/lib/http";
import { stripe, stripeConfigured } from "@/lib/stripe";
import { checkBucket, storageProblem } from "@/lib/storage/firebase";

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
        attempt("database", async () => { await connectDB(); return "MongoDB connected"; }),
        attempt("appUrl", async () => {
            const url = process.env.APP_URL ?? "";
            if (!isPublicHttps(url)) throw new Error("APP_URL must be a public https address without a trailing slash");
            return url;
        }),
        attempt("stripe", async () => {
            if (!stripeConfigured()) throw new Error("STRIPE_SECRET_KEY is not set");
            await stripe("GET", "/balance");
            return (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live") ? "Stripe reachable (live mode)" : "Stripe reachable (test mode)";
        }),
        attempt("stripeWebhook", async () => {
            if (!(process.env.STRIPE_WEBHOOK_SECRET ?? "").startsWith("whsec_")) throw new Error("STRIPE_WEBHOOK_SECRET is missing or does not start with whsec_");
            return "Webhook secret is set (Stripe events are verified by signature)";
        }),
        attempt("firebase", async () => {
            const problem = storageProblem();
            if (problem) throw new Error(problem);
            await checkBucket();
            return `Bucket ${process.env.FIREBASE_STORAGE_BUCKET} is reachable`;
        }),
        attempt("google", async () => {
            if (!google) throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are missing (needed for Gmail and Google Drive sign-in)");
            return "Google sign-in keys are set (enable the Google Drive API in Google Cloud for documents)";
        }),
        attempt("admin", async () => {
            if (!adminEmails().length) throw new Error("ADMIN_EMAILS is not set");
            return `${adminEmails().length} administrator address(es)`;
        }),
        attempt("cron", async () => {
            if (!process.env.CRON_SECRET) throw new Error("CRON_SECRET is not set");
            return "Daily automation job is protected";
        }),
    ]);
}
