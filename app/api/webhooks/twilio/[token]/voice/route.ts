import { normalizePhone, twiml, xmlEscape } from "@/lib/channels/twilio";
import { twilioHook } from "@/lib/channels/twilioHook";

export const dynamic = "force-dynamic";

// Голосовой вебхук. Вызывается в двух случаях:
//  • исходящий звонок из браузера (From = "client:<id>", To передаёт Voice SDK) — набираем номер;
//  • входящий звонок на номер — соединяем с браузером владельца (<Client>).
// О результате звонка Twilio сообщит на voice-status (атрибут action).
export async function POST(req: Request, { params }: { params: { token: string } }) {
    const hook = await twilioHook(req, params.token);
    if (!hook) return new Response("Not found", { status: 404 });
    if (hook === "forbidden") return new Response("Forbidden", { status: 403 });

    const { integration, params: p, hookBase } = hook;
    const from = p.From ?? "";

    if (from.startsWith("client:")) {
        const to = normalizePhone(p.To ?? "");
        if (!to) return twiml("<Say>The number is not valid.</Say><Hangup/>");
        const action = `${hookBase}/voice-status?dir=out&amp;peer=${encodeURIComponent(to)}`;
        return twiml(`<Dial callerId="${xmlEscape(integration.config.phone)}" answerOnBridge="true" action="${action}"><Number>${xmlEscape(to)}</Number></Dial>`);
    }

    const peer = normalizePhone(from) ?? from;
    const action = `${hookBase}/voice-status?dir=in&amp;peer=${encodeURIComponent(peer)}`;
    return twiml(`<Dial timeout="25" answerOnBridge="true" action="${action}"><Client>${integration.owner.toString()}</Client></Dial>`);
}
