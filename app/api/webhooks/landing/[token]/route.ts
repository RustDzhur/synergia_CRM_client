import { mkActivity } from "@/lib/activities";
import { emit } from "@/lib/automation/emit";
import { corsJson, corsPreflight } from "@/lib/channels/webchat";
import { findByToken } from "@/lib/integrations";
import { landingExternalId, landingSite, parseLandingLead } from "@/lib/landingLeads";
import { notify } from "@/lib/notify";
import { notifyTeamTelegram } from "@/lib/notifyTeam";
import { prisma } from "@/lib/prisma";
import { rateLimited } from "@/lib/rateLimit";
import { ensureStages } from "@/lib/stages";

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

// POST /api/webhooks/landing/<token> — публичный приём заявок с лендингов (burokratie-copilot,
// automatisation). Тело — супермножество полей обоих лендингов (см. lib/landingLeads.ts).
// Заявка создаёт контакт (source=landing:<site>) и сделку в первой колонке («New Lead») с защитой
// от дублей по externalId = <site>:<id запроса>, плюс уведомления — как лиды из почты (lib/leads.ts).
export async function POST(req: Request, { params }: { params: { token: string } }) {
    try {
        // 1. Интеграция «landing» по токену из пути → фирма-владелец; токен не совпал — 404
        const integration = await findByToken("landing", params.token);
        if (!integration) return corsJson({ ok: false, message: "Not found" }, 404);
        const site = landingSite(integration.config);
        if (!site) return corsJson({ ok: false, message: "Landing site is not configured" }, 500);
        const owner = String(integration.owner);

        // 2. Лимит запросов на токен+IP (как у публичных маршрутов виджета чата)
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
        if (rateLimited(`landing:${params.token}:${ip}`, 10, 60_000)) {
            return corsJson({ ok: false, message: "Too many requests" }, 429);
        }

        // 3. Валидация и нормализация
        const body = await req.json().catch(() => null);
        const parsed = parseLandingLead(body);
        if (!parsed.lead) return corsJson({ ok: false, message: "Bad request", fields: parsed.errors }, 400);
        const lead = parsed.lead;

        // 4. Дедупликация: та же заявка (тот же id с того же лендинга) уже в CRM — просто подтверждаем
        const externalId = lead.id ? landingExternalId(site, lead.id) : "";
        if (externalId) {
            const existing = await prisma.deal.findFirst({ where: { owner, externalId }, select: { id: true } });
            if (existing) return corsJson({ ok: true }, 201);
        }

        const clientName = `${lead.company || lead.name} — Anfrage vom Landing`;

        // 5. Контакт: ищем по почте (без учёта регистра), иначе создаём с источником landing:<site>
        let contact = await prisma.contact.findFirst({ where: { owner, email: { equals: lead.email, mode: "insensitive" } } });
        if (!contact) {
            const [firstName, ...rest] = lead.name.split(" ");
            contact = await prisma.contact.create({
                data: {
                    owner,
                    name: lead.name,
                    firstName: rest.length ? firstName : "",
                    lastName: rest.join(" "),
                    email: lead.email,
                    phone: lead.phone || undefined,
                    company: lead.company || undefined,
                    source: `landing:${site}`,
                },
            });
        }

        // 6. Сделка в первой колонке доски («New Lead»), как в lib/leads.ts createLeadsFromMail
        const firstStage = String((await ensureStages(owner))[0]._id);
        const order = await prisma.deal.count({ where: { owner, stage: firstStage } });
        const utm = [lead.utm.source, lead.utm.medium, lead.utm.campaign].filter(Boolean).join("|") || lead.sourcePage;
        // Структурированные поля формы — одной строкой в карточке, чтобы владелец видел их сразу
        const detailPairs: [string, string][] = [
            ["Mandanten", lead.mandantCount],
            ["Belege/Monat", lead.belegVolume],
            ["DATEV-Workflow", lead.datevWorkflow],
            ["Kontaktweg", lead.contactChannel],
            ["Unternehmensgröße", lead.companySize],
            ["Branche", lead.industry],
            ["Software", lead.software],
            ["Anfragetyp", lead.requestType],
        ];
        const detailNote = detailPairs.map(([k, v]) => (v ? `${k}: ${v}` : "")).filter(Boolean).join(", ");
        const deal = await prisma.deal.create({
            data: {
                owner,
                stage: firstStage,
                clientName,
                contactName: lead.name,
                contact: contact.id,
                order,
                source: "landing",
                externalId,
                utm,
                activities: [
                    mkActivity("created", clientName),
                    mkActivity("note", lead.text),
                    mkActivity("note", `Landing: ${site}${lead.sourcePage ? ` ${lead.sourcePage}` : ""}`),
                    ...(detailNote ? [mkActivity("note", detailNote)] : []),
                ],
            },
        });

        // 7. Автоматизация, уведомление в CRM и уведомление команде в Telegram
        await emit(owner, { type: "lead_created", data: { id: deal.id, dealId: deal.id, contactId: contact.id, name: lead.name, contactName: lead.name, email: lead.email, subject: clientName } });
        await notify(owner, { type: "lead", params: { name: lead.name, subject: clientName }, link: "/crm/crm", key: `landing:${site}:${lead.email}:${new Date().toISOString().slice(0, 10)}` });
        void notifyTeamTelegram(owner, [
            `📥 Заявка с лендинга ${site}`,
            `Имя: ${lead.name}`,
            lead.company ? `Компания: ${lead.company}` : "",
            `Почта: ${lead.email}${lead.phone ? ` · Телефон: ${lead.phone}` : ""}`,
            lead.text,
        ]
            .filter(Boolean)
            .join("\n"));

        return corsJson({ ok: true }, 201);
    } catch (e) {
        // Содержимое заявки в логи не пишем — только факт ошибки
        console.error("landing webhook failed", e instanceof Error ? e.message : "unknown");
        return corsJson({ ok: false, message: "Internal error" }, 500);
    }
}
