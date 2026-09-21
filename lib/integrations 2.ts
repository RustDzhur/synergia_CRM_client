import type { HydratedDocument } from "mongoose";
import type { IntegrationDTO, IntegrationType } from "@/app/types/integrations";
import { decryptJSON, encryptJSON } from "@/lib/crypto";
import Integration from "@/models/Integration";

type Doc = HydratedDocument<any>;

export function webhookPath(type: IntegrationType, token: string) {
    if (type === "twilio") return `/api/webhooks/twilio/${token}`;
    if (type === "webchat") return `/api/webchat/${token}`;
    return `/api/webhooks/${type}/${token}`;
}

export function toIntegrationDTO(doc: Doc, origin: string): IntegrationDTO {
    return {
        id: doc._id.toString(),
        type: doc.type,
        name: doc.name,
        status: doc.status,
        error: doc.error,
        config: doc.config ?? {},
        webhookUrl: `${origin}${webhookPath(doc.type, doc.token)}`,
        createdAt: doc.createdAt?.toISOString?.() ?? "",
    };
}

export const secretsOf = <T = Record<string, string>>(doc: Doc) => decryptJSON<T>(doc.secrets);
export const packSecrets = (value: unknown) => encryptJSON(value);

// Интеграция по адресу вебхука (запрос от провайдера, без пользователя)
export async function findByToken(type: IntegrationType, token: string) {
    return Integration.findOne({ type, token });
}
