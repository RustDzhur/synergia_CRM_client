import { twiml } from "@/lib/channels/twilio";
import { normalizePhone } from "@/lib/channels/twilio";
import { twilioHook } from "@/lib/channels/twilioHook";
import { recordMessage } from "@/lib/channels";

export const dynamic = "force-dynamic";

// Входящее SMS на подключённый номер
export async function POST(req: Request, { params }: { params: { token: string } }) {
    const hook = await twilioHook(req, params.token);
    if (!hook) return new Response("Not found", { status: 404 });
    if (hook === "forbidden") return new Response("Forbidden", { status: 403 });

    const { integration, params: p } = hook;
    const from = normalizePhone(p.From ?? "") ?? p.From;
    if (from) {
        const media = Number(p.NumMedia) > 0 ? " [media]" : "";
        await recordMessage(integration, { externalId: from, name: from, text: `${p.Body ?? ""}${media}`.trim(), messageId: p.MessageSid });
    }
    return twiml(); // пустой ответ: автоответ не нужен
}
