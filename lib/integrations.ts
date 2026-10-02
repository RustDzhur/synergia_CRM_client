import type { IntegrationDTO, IntegrationType } from "@/types/integrations";
import { decryptJSON, encryptJSON } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

// Документ интеграции — запись Prisma. По полям она совместима с прежним Mongoose-документом,
// поэтому DTO и secretsOf работают одинаково.
type Doc = any;

export function webhookPath(type: IntegrationType, token: string) {
    if (type === "twilio") return `/api/webhooks/twilio/${token}`;
    if (type === "webchat") return `/api/webchat/${token}`;
    // У платёжек адрес общий на четверых: /api/webhooks/pay/<провайдер>/<маркер фирмы>
    // (см. app/api/webhooks/pay/[provider]/[token]) — иначе провайдер звал бы несуществующий адрес
    if (type === "monobank" || type === "liqpay" || type === "wayforpay" || type === "cryptopay") return `/api/webhooks/pay/${type}/${token}`;
    return `/api/webhooks/${type}/${token}`;
}

export function toIntegrationDTO(doc: Doc, origin: string): IntegrationDTO {
    // У WhatsApp адрес вебхука один на всё приложение Meta (фирма определяется по номеру из события),
    // поэтому в окне показываем именно его, а не адрес с маркером этой фирмы
    const url = doc.type === "whatsapp" ? `${origin}/api/webhooks/whatsapp/app` : `${origin}${webhookPath(doc.type, doc.token)}`;
    return {
        // id есть у Prisma-записи, _id — у Mongoose-документа
        id: String(doc.id ?? doc._id?.toString?.() ?? ""),
        type: doc.type,
        name: doc.name,
        status: doc.status,
        error: doc.error,
        config: doc.config ?? {},
        webhookUrl: url,
        createdAt: doc.createdAt?.toISOString?.() ?? "",
    };
}

export const secretsOf = <T = Record<string, string>>(doc: Doc) => decryptJSON<T>(doc.secrets);
export const packSecrets = (value: unknown) => encryptJSON(value);

// Подключение фирмы по типу (площадки, доставка, касса): нужен сам документ, а не DTO
export const findIntegrationByType = (owner: string, type: string) => prisma.integration.findFirst({ where: { owner, type } });

// Интеграция по адресу вебхука (запрос от провайдера, без пользователя)
export async function findByToken(type: IntegrationType, token: string) {
    return prisma.integration.findFirst({ where: { type, token } });
}
