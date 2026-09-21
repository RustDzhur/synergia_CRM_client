import { twiml } from "@/lib/channels/twilio";
import { twilioHook } from "@/lib/channels/twilioHook";
import { recordMessage } from "@/lib/channels";

export const dynamic = "force-dynamic";

// Итог звонка (Twilio вызывает после завершения <Dial>): пишем в беседу с этим номером запись о звонке
export async function POST(req: Request, { params }: { params: { token: string } }) {
    const hook = await twilioHook(req, params.token);
    if (!hook) return new Response("Not found", { status: 404 });
    if (hook === "forbidden") return new Response("Forbidden", { status: 403 });

    const { integration, params: p } = hook;
    const q = new URL(req.url).searchParams;
    const dir = q.get("dir") === "in" ? "in" : "out";
    const peer = q.get("peer") ?? "";
    const status = p.DialCallStatus || "failed"; // completed | no-answer | busy | failed | canceled
    if (peer) {
        await recordMessage(integration, {
            externalId: peer,
            name: peer,
            text: dir === "in" ? "Incoming call" : "Outgoing call",
            direction: dir,
            kind: "call",
            meta: { status, duration: Number(p.DialCallDuration) || 0 },
            messageId: p.CallSid ? `call:${p.CallSid}:${dir}` : undefined,
        });
    }
    // никто не ответил на входящий — вежливо сообщаем звонящему
    if (dir === "in" && status !== "completed") return twiml("<Say>Nobody is available right now. Please try again later.</Say><Hangup/>");
    return twiml();
}
