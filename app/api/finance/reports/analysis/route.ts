import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, serverError, unauthorized } from "@/lib/api";
import { aiConfigured, complete } from "@/lib/ai/provider";
import { ProviderError } from "@/lib/http";
import { businessAnalysis, incomeSurplus, periodRange, trialBalance, vatReturn, type PeriodKind } from "@/lib/finance/reports";
import { planFor } from "@/config/plans";
import { effectivePlan } from "@/lib/billing";
import { dailyLimit, takeQuota, usedToday } from "@/lib/ai/run";
import Organization from "@/models/Organization";

export const dynamic = "force-dynamic";

const KINDS = ["vat", "eur", "bwa", "susa"] as const;
type Kind = (typeof KINDS)[number];
const PERIODS: PeriodKind[] = ["month", "quarter", "year"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const LANG: Record<string, string> = { en: "English", de: "German", ua: "Ukrainian" };

// GET /api/finance/reports/analysis?kind=…&period=…&locale=…
// Разбор отчёта человеческим языком. Цифры считает сервер (lib/finance/reports.ts) и отдаёт модели
// уже готовыми — модель ничего не вычисляет, только объясняет. Это важно: ошибиться в арифметике она не может.
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    const url = new URL(req.url);
    const kind = url.searchParams.get("kind") as Kind | null;
    if (!kind || !KINDS.includes(kind)) return badRequest("kind must be one of: vat, eur, bwa, susa");
    const localeParam = url.searchParams.get("locale") ?? "de";
    const locale = ["en", "de", "ua"].includes(localeParam) ? localeParam : "de";

    if (!aiConfigured()) return badRequest("AI is not configured on this site");

    const periodParam = url.searchParams.get("period");
    const period: PeriodKind = PERIODS.includes(periodParam as PeriodKind) ? (periodParam as PeriodKind) : "quarter";
    const preset = periodRange(period);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const from = fromParam && DATE.test(fromParam) ? fromParam : preset.from;
    const to = toParam && DATE.test(toParam) ? toParam : preset.to;

    await connectDB();

    // Разбор отчёта тратит ту же дневную квоту ИИ, что и чат с ассистентом — иначе отчёты обходили бы тариф.
    const [limit, used] = await Promise.all([dailyLimit(user.id), usedToday(user.id)]);
    if (used >= limit) return badRequest("The daily AI limit for your plan is used up");

    try {
        const report =
            kind === "vat" ? await vatReturn(user.id, from, to) :
            kind === "eur" ? await incomeSurplus(user.id, from, to) :
            kind === "bwa" ? await businessAnalysis(user.id, from, to) :
            await trialBalance(user.id, from, to);

        if (!(await takeQuota(user.id, limit))) return badRequest("The daily AI limit for your plan is used up");

        const org = await Organization.findById(user.id).lean<{ name?: string; plan?: string; planOverride?: string }>();
        const plan = planFor(effectivePlan(org ?? {}));

        const system = `You are Firmspace AI, the accounting assistant inside Firmspace CRM. The firm is "${org?.name ?? "the company"}".
You explain financial reports to a small-business owner who is not an accountant. Reply in ${LANG[locale]}.

Strict rules:
- The figures in the report are computed by the system. NEVER recalculate, add to, or contradict them. Quote them as given.
- Never invent numbers, customers, dates or legal requirements you are not sure about.
- Structure the answer in short sections with plain headings: 1) what the figures say, 2) what stands out (only real anomalies visible in the data), 3) what to do next, 4) for VAT: which line of the ELSTER form each figure goes into — use the "kennzahl"/"where" fields provided.
- Pick the frame that fits the report: for "vat" (UStVA) focus on the VAT payable or refundable and map every figure to its ELSTER line; for "eur" (EÜR) focus on profit or loss and which cost blocks drive it; for "bwa" focus on the monthly trend, whether revenue covers costs and which category grew; for "susa" explain that this is a management trial balance built from the documents in the system, that no statutory chart of accounts is kept, and that the totals must balance.
- This is not tax advice. Say plainly that the figures must be checked by a tax adviser before filing.
- Be concrete and short. No filler, no marketing tone.`;

        const prompt = `Report type: ${kind}. Period: ${from} to ${to}. Plan: ${plan.id}.
Data (JSON):
${JSON.stringify(report)}`;

        const reply = await complete(system, [{ role: "user", text: prompt }], []);
        return NextResponse.json({ kind, from, to, text: reply.text.trim() });
    } catch (e) {
        if (e instanceof ProviderError) return badRequest(e.message);
        return serverError(e);
    }
}
