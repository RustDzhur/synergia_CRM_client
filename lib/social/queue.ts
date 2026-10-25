import { prisma } from "@/lib/prisma";
import type { PublishResult } from "./publish";

// Очередь постов соцсетей платформы. Пять тем на немецком (CRM, Buchhaltung, Bürokratie, KI-Agenten,
// Automatisierung) — по одной на публикацию, три публикации в день. Тексты живут в базе (таблица social_posts):
// сид кладёт их один раз, дальше очередь можно пополнять и править без выкладки кода.
// Когда очередь пройдена, самый давний опубликованный пост возвращается в оборот — робот не «умирает»
// через два дня, а продолжает публиковать по кругу. Это осознанное решение: замену темам дописывает владелец.

export interface QueuedPost {
    id: string;
    key: string;
    text: string;
    image: string;
}

interface SeedPost {
    key: string;
    text: string;
    image: string;
}

export const DEFAULT_POSTS: SeedPost[] = [
    {
        key: "crm-kundenbeziehungen",
        image: "public/brand/agents.png",
        text: `Kundenbeziehungen scheitern selten am Produkt – meistens an der Nachverfolgung.

Ein Angebot raus, drei Wochen Funkstille, und niemand weiß, ob der Kunde noch interessiert ist. Genau dort verliert ein kleiner Betrieb Umsatz, ohne es zu merken.

In Firmspace steht alles an einer Stelle:
• Wer hat zuletzt gesprochen – und wann?
• Welche Deals stehen still?
• Welche Aufgabe ist heute fällig?

Der Vertriebs-Roboter schaut jeden Morgen nach und legt Follow-ups an, statt dass jemand in Erinnerungen kramt.

Weniger Zettel, weniger Vergessen, mehr Klarheit im Alltag.

#CRM #Vertrieb #Kundenbindung #KMU #Firmspace`,
    },
    {
        key: "buchhaltung-rechnungen",
        image: "public/brand/avatar.png",
        text: `Rechnungen schreiben ist kein Geschäft – es hält nur das Geschäft auf.

Belege sammeln, Rechnungen nachhalten, Mahnungen formulieren: Für viele kleine Betriebe sind das zwei verlorene Abende pro Woche.

Firmspace macht daraus einen Ablauf:
• Rechnung direkt aus dem Angebot erstellen
• Zahlungseingang im Blick behalten
• freundliche Zahlungserinnerung vorbereiten
• Ausgaben und Belege an einem Ort

Der Buchhaltungs-Roboter rechnet nicht selbst, er hält alles bereit – entscheiden und freigeben tut weiterhin der Mensch.

#Buchhaltung #Rechnungen #Mahnwesen #KMU #Firmspace`,
    },
    {
        key: "buerokratie-fristen",
        image: "public/brand/avatar.png",
        text: `Bürokratie ist kein Nebenthema – sie ist der unsichtbare zweite Job.

E-Rechnung, Fristen, Formulare, Nachweise: Wer das nur „nebenbei“ macht, arbeitet abends weiter.

Unser Ansatz: nicht mehr Papierkram, sondern weniger Sucherei.
• Fristen und offene Punkte an einer Stelle
• Belege und Dokumente auffindbar statt verstreut
• Erinnerungen, bevor etwas zu spät ist
• KI-Agenten bereiten vor, der Mensch prüft

Bürokratie verschwindet nicht. Aber sie kann aufhören, den ganzen Tag zu fressen.

#Bürokratie #Digitalisierung #EInvoicing #KMU #Firmspace`,
    },
    {
        key: "ki-agenten-im-buero",
        image: "public/brand/agents.png",
        text: `„KI“ heißt im Alltag selten Raketenwissenschaft. Meistens heißt es: weniger nachfragen, weniger suchen, weniger vergessen.

Im Firmspace-Roboterbüro arbeiten Agenten mit klaren Aufgaben:
• Vertrieb: offene Deals und Follow-ups
• Buchhaltung: Rechnungen, Ausgaben, Zahlungserinnerungen
• Lager: Bestände und Nachbestellungen
• Postfach: Mails sortieren, Antworten vorbereiten

Wichtig: Die Agenten schlagen vor und bereiten vor. Freigeben tut der Mensch – und jede Aktion ist im Protokoll nachlesbar.

#KIAgenten #KI #Automatisierung #KMU #Firmspace`,
    },
    {
        key: "routineaufgaben-laufen-lassen",
        image: "public/brand/agents.png",
        text: `Was passiert, wenn Routineaufgaben einfach laufen?

Jeden Morgen dieselben Fragen: Welche Rechnung ist offen? Welcher Kunde wartet? Was ist heute fällig?

Firmspace beantwortet sie, ohne dass jemand danach sucht:
• regelmäßige Aufgaben für jeden Roboter – täglich oder alle paar Stunden
• Ergebnisse landen im Protokoll, nicht im Nirwana
• der Mensch bestätigt, was wirklich rausgeht

Nicht mehr Tools. Weniger Reibung.

#Automatisierung #CRM #Bürokratie #KI #Firmspace`,
    },
];

/** Сид очереди идемпотентен: ключ темы уникален, повторный запуск не плодит дубли и не затирает правки из базы. */
export async function ensureSocialQueue(): Promise<void> {
    await prisma.socialPost.createMany({
        data: DEFAULT_POSTS.map((p) => ({ key: p.key, text: p.text, image: p.image })),
        skipDuplicates: true,
    });
}

const toQueued = (row: { id: string; key: string; text: string; image: string }): QueuedPost => ({ id: row.id, key: row.key, text: row.text, image: row.image });

/** Следующий пост: сначала действительно новые, затем (когда очередь пройдена) самый давний опубликованный по кругу. */
export async function nextQueuedPost(): Promise<QueuedPost> {
    await ensureSocialQueue();
    const queued = await prisma.socialPost.findFirst({ where: { status: "queued" }, orderBy: { createdAt: "asc" } });
    if (queued) return toQueued(queued);

    const published = await prisma.socialPost.findFirst({ where: { status: "published" }, orderBy: { publishedAt: "asc" } });
    if (published) {
        const again = await prisma.socialPost.update({ where: { id: published.id }, data: { status: "queued", attempts: 0, error: "" } });
        return toQueued(again);
    }
    // остались только сбойные — даём им ещё один шанс, иначе робот встал бы навсегда
    const failed = await prisma.socialPost.findFirst({ where: { status: "failed" }, orderBy: { updatedAt: "asc" } });
    if (failed) {
        const again = await prisma.socialPost.update({ where: { id: failed.id }, data: { status: "queued", attempts: 0, error: "" } });
        return toQueued(again);
    }
    throw new Error("The social queue is empty: add posts to the social_posts table");
}

export async function markPostPublished(id: string, result: PublishResult): Promise<void> {
    await prisma.socialPost.update({
        where: { id },
        data: {
            status: "published",
            publishedAt: new Date(),
            fbPostId: result.fbPostId,
            fbUrl: result.fbUrl,
            igMediaId: result.igMediaId,
            igUrl: result.igUrl,
            // Instagram мог не принять пост — Facebook уже вышел, поэтому пост считается опубликованным,
            // а причина видна в журнале робота и в этой записи
            error: result.igError ? `Instagram: ${result.igError}`.slice(0, 900) : "",
            attempts: { increment: 1 },
        },
    });
}

/** Сбой публикации: три попытки, потом тема уступает место следующей (иначе одна плохая картинка остановит очередь). */
export async function markPostFailed(id: string, message: string): Promise<void> {
    const row = await prisma.socialPost.findUnique({ where: { id }, select: { attempts: true } });
    const attempts = (row?.attempts ?? 0) + 1;
    await prisma.socialPost.update({
        where: { id },
        data: { attempts, status: attempts >= 3 ? "failed" : "queued", error: message.slice(0, 900) },
    });
}
