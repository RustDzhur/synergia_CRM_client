import { appOrigin } from "@/lib/appUrl";
import { connectDB } from "@/lib/mongodb";
import { findByToken, secretsOf } from "@/lib/integrations";
import { TwilioSecrets, verifyTwilioSignature } from "./twilio";

// Общая часть вебхуков Twilio: находим интеграцию по адресу и проверяем подпись X-Twilio-Signature.
// Подпись считается от полного адреса, который вызвал Twilio, поэтому берём публичный origin, а не внутренний адрес функции.
export async function twilioHook(req: Request, token: string) {
    await connectDB();
    const integration = await findByToken("twilio", token);
    if (!integration) return null;
    const secrets = secretsOf<TwilioSecrets>(integration);

    const form = await req.formData();
    const params: Record<string, string> = {};
    form.forEach((v, k) => { if (typeof v === "string") params[k] = v; });

    const url = new URL(req.url);
    const fullUrl = `${appOrigin(req)}${url.pathname}${url.search}`;
    if (!verifyTwilioSignature(fullUrl, params, req.headers.get("x-twilio-signature"), secrets.authToken)) return "forbidden" as const;
    return { integration, secrets, params, hookBase: `${appOrigin(req)}/api/webhooks/twilio/${token}` };
}
