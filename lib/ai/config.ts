import { isPlatformAdminUser } from "@/lib/admin";
import { getFirmEnv } from "@/lib/firmEnv";
import { prisma } from "@/lib/prisma";

// Настройки ИИ из переменных окружения АДМИНИСТРАТОРА ПЛАТФОРМЫ (Настройки → Интеграции → «Переменные окружения»): AI_API_URL, AI_API_KEY, AI_MODEL,
// AI_FALLBACK_MODELS, AI_VOICE_MODEL. Так ключ провайдера (например DeepSeek) вносится в кабинете, а не правкой файла на сервере, и подхватывается
// без перезапуска (кэш 60 секунд). Переменные обычных клиентов сюда не попадают: берётся только фирма, владелец которой — администратор платформы.
// Если переменных нет, работают переменные окружения сервера, как раньше.
export interface AiOverrides { apiUrl: string; apiKey: string; model: string; fallbacks: string[]; voiceModel: string; org: string }

const g = globalThis as { __aiOverrides?: { at: number; value: AiOverrides | null } };
const TTL_MS = 60_000;

async function load(): Promise<AiOverrides | null> {
    const rows = await prisma.sectionRecord.findMany({ where: { key: "admin:env", rid: "AI_API_KEY" }, take: 10 });
    for (const row of rows) {
        const org = await prisma.organization.findUnique({ where: { id: row.org }, select: { ownerUser: true } }).catch(() => null);
        const owner = org ? await prisma.user.findUnique({ where: { id: org.ownerUser } }).catch(() => null) : null;
        if (!owner || !(await isPlatformAdminUser(owner as never))) continue;
        const [apiUrl, apiKey, model, fallbacks, voiceModel] = await Promise.all(["AI_API_URL", "AI_API_KEY", "AI_MODEL", "AI_FALLBACK_MODELS", "AI_VOICE_MODEL"].map((n) => getFirmEnv(row.org, n)));
        if (!apiKey) continue;
        return { apiUrl: apiUrl.trim(), apiKey: apiKey.trim(), model: model.trim(), fallbacks: fallbacks.split(",").map((m) => m.trim()).filter(Boolean), voiceModel: voiceModel.trim(), org: row.org };
    }
    return null;
}

/** Настройки ИИ из кабинета администратора платформы или null. Не бросает: сбой базы означает «используем переменные сервера». */
export async function aiOverrides(): Promise<AiOverrides | null> {
    const now = Date.now();
    if (g.__aiOverrides && now - g.__aiOverrides.at < TTL_MS) return g.__aiOverrides.value;
    let value: AiOverrides | null = null;
    try { value = await load(); } catch { value = g.__aiOverrides?.value ?? null; }
    g.__aiOverrides = { at: now, value };
    return value;
}

export const resetAiOverrides = () => { g.__aiOverrides = undefined; };
