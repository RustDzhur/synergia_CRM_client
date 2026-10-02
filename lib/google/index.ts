import { ProviderError } from "@/lib/http";
import { packSecrets, secretsOf } from "@/lib/integrations";
import { randomToken } from "@/lib/crypto";
import { Tokens, refreshTokens } from "@/lib/mail/oauth";
import { prisma } from "@/lib/prisma";
import { createFolder, driveUser } from "./drive";

type Doc = any;

// Подключение Google Drive пользователя (одно на пользователя): токены зашифрованы, как у почты
export const findDrive = (owner: string) => prisma.integration.findFirst({ where: { owner, type: "gdrive" } });

export async function connectDrive(owner: string, tokens: Tokens) {
    if (!tokens.refreshToken) throw new ProviderError("Google did not allow offline access. Remove the app in your Google account permissions and connect again.");
    const email = await driveUser(tokens.accessToken).catch(() => "");
    const existing = await findDrive(owner);
    // при повторном подключении корневую папку в Drive сохраняем
    const prev = (existing?.config ?? {}) as any;
    const data = { name: email || "Google Drive", config: { email, rootFolderId: prev.rootFolderId ?? "" } as any, secrets: packSecrets(tokens), status: "connected", error: "" };
    return existing
        ? prisma.integration.update({ where: { id: existing.id }, data })
        : prisma.integration.create({ data: { owner, type: "gdrive", token: randomToken(), ...data } });
}

// Токен доступа живёт около часа: перед запросом при необходимости обновляем его по refresh-токену
export async function driveToken(d: Doc): Promise<string> {
    const s = secretsOf<Tokens>(d);
    if (s.expiresAt > Date.now() + 60_000) return s.accessToken;
    if (!s.refreshToken) throw new ProviderError("Connect Google Drive again");
    try {
        const fresh = await refreshTokens("google", s.refreshToken);
        await prisma.integration.update({ where: { id: d.id }, data: { secrets: packSecrets(fresh) } });
        return fresh.accessToken;
    } catch {
        const error = "Google Drive access was revoked. Connect it again.";
        await prisma.integration.update({ where: { id: d.id }, data: { status: "error", error } });
        throw new ProviderError(error);
    }
}

// Папка Drive для документа: корневая «Firmspace CRM» или зеркало папки CRM (создаются при первом документе в них)
export async function driveParent(token: string, drive: Doc, folderId: string | null): Promise<string> {
    if (!folderId) {
        const cfg = (drive.config ?? {}) as any;
        if (!cfg.rootFolderId) {
            const root = await createFolder(token, "Firmspace CRM");
            drive.config = { ...cfg, rootFolderId: root.id };
            await prisma.integration.update({ where: { id: drive.id }, data: { config: drive.config as any } });
        }
        return (drive.config as any).rootFolderId as string;
    }
    const folder = await prisma.docFolder.findUnique({ where: { id: folderId } });
    if (!folder) return driveParent(token, drive, null);
    if (folder.driveId) return folder.driveId;
    const parent = await driveParent(token, drive, folder.parent ? String(folder.parent) : null);
    const created = await createFolder(token, folder.name, parent);
    await prisma.docFolder.update({ where: { id: folder.id }, data: { driveId: created.id } });
    return created.id;
}

// ── Google Calendar ─────────────────────────────────────────────────────────────────────────────────────
// Отдельная интеграция со своими токенами: Drive и Календарь подключаются независимо, и отзыв доступа
// к одному не должен ломать другой. Токен обновляется так же, как у Drive.

export const findGcal = (owner: string) => prisma.integration.findFirst({ where: { owner, type: "gcal" } });

export async function connectGcal(owner: string, tokens: Tokens) {
    if (!tokens.refreshToken) throw new ProviderError("Google did not allow offline access. Remove the app in your Google account permissions and connect again.");
    const existing = await findGcal(owner);
    const prev = (existing?.config ?? {}) as any;
    // Список календарей и имя подключённого аккаунта: основной календарь Google называется почтой владельца
    let email = "";
    let calendars = prev.calendars ?? [];
    try {
        const { listCalendars, toCalendarEntries } = await import("@/lib/google/calendar");
        const list = await listCalendars(tokens.accessToken);
        email = list.find((c) => c.primary)?.id ?? "";
        // Отметки «синхронизировать» не трогаем, если список уже был: их расставил человек
        if (!Array.isArray(calendars) || !calendars.length) calendars = toCalendarEntries(list);
    } catch (e) {
        // Календарный API в проекте Google Cloud включается отдельно от Drive и почты. Пока он выключен,
        // подключение бесполезно, и сказать об этом нужно сразу.
        const message = e instanceof Error ? e.message : "";
        if (/has not been used in project|is disabled|accessNotConfigured/i.test(message)) throw new ProviderError(message);
    }
    // Выбранные календари и календарь для записи сохраняем при переподключении: человек их уже отметил.
    const data = {
        name: email || "Google Calendar",
        config: { email, calendars, target: prev.target ?? "", scopes: tokens.scope || prev.scopes || "" } as any,
        secrets: packSecrets(tokens),
        status: "connected",
        error: "",
    };
    return existing
        ? prisma.integration.update({ where: { id: existing.id }, data })
        : prisma.integration.create({ data: { owner, type: "gcal", token: randomToken(), ...data } });
}

export async function gcalToken(d: Doc): Promise<string> {
    const s = secretsOf<Tokens>(d);
    if (s.expiresAt > Date.now() + 60_000) return s.accessToken;
    if (!s.refreshToken) throw new ProviderError("Connect Google Calendar again");
    try {
        const fresh = await refreshTokens("google", s.refreshToken);
        await prisma.integration.update({ where: { id: d.id }, data: { secrets: packSecrets(fresh) } });
        return fresh.accessToken;
    } catch {
        const error = "Google Calendar access was revoked. Connect it again.";
        await prisma.integration.update({ where: { id: d.id }, data: { status: "error", error } });
        throw new ProviderError(error);
    }
}
