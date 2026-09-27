import type { HydratedDocument } from "mongoose";
import { ProviderError } from "@/lib/http";
import { packSecrets, secretsOf } from "@/lib/integrations";
import { randomToken } from "@/lib/crypto";
import { Tokens, refreshTokens } from "@/lib/mail/oauth";
import Integration from "@/models/Integration";
import DocFolder from "@/models/DocFolder";
import { createFolder, driveUser } from "./drive";

type Doc = HydratedDocument<any>;

// Подключение Google Drive пользователя (одно на пользователя): токены зашифрованы, как у почты
export const findDrive = (owner: string) => Integration.findOne({ owner, type: "gdrive" });

export async function connectDrive(owner: string, tokens: Tokens) {
    if (!tokens.refreshToken) throw new ProviderError("Google did not allow offline access. Remove the app in your Google account permissions and connect again.");
    const email = await driveUser(tokens.accessToken).catch(() => "");
    const doc = (await findDrive(owner)) ?? new Integration({ owner, type: "gdrive", token: randomToken() });
    // при повторном подключении корневую папку в Drive сохраняем
    doc.set({ name: email || "Google Drive", config: { email, rootFolderId: doc.config?.rootFolderId ?? "" }, secrets: packSecrets(tokens), status: "connected", error: "" });
    doc.markModified("config");
    await doc.save();
    return doc;
}

// Токен доступа живёт около часа: перед запросом при необходимости обновляем его по refresh-токену
export async function driveToken(d: Doc): Promise<string> {
    const s = secretsOf<Tokens>(d);
    if (s.expiresAt > Date.now() + 60_000) return s.accessToken;
    if (!s.refreshToken) throw new ProviderError("Connect Google Drive again");
    try {
        const fresh = await refreshTokens("google", s.refreshToken);
        d.secrets = packSecrets(fresh);
        await d.save();
        return fresh.accessToken;
    } catch {
        d.status = "error";
        d.error = "Google Drive access was revoked. Connect it again.";
        await d.save();
        throw new ProviderError(d.error);
    }
}

// Папка Drive для документа: корневая «Firmspace CRM» или зеркало папки CRM (создаются при первом документе в них)
export async function driveParent(token: string, drive: Doc, folderId: string | null): Promise<string> {
    if (!folderId) {
        if (!drive.config.rootFolderId) {
            const root = await createFolder(token, "Firmspace CRM");
            drive.set("config", { ...drive.config, rootFolderId: root.id });
            drive.markModified("config");
            await drive.save();
        }
        return drive.config.rootFolderId as string;
    }
    const folder = await DocFolder.findById(folderId);
    if (!folder) return driveParent(token, drive, null);
    if (folder.driveId) return folder.driveId;
    const parent = await driveParent(token, drive, folder.parent ? String(folder.parent) : null);
    const created = await createFolder(token, folder.name, parent);
    folder.driveId = created.id;
    await folder.save();
    return created.id;
}

// ── Google Calendar ─────────────────────────────────────────────────────────────────────────────────────
// Отдельная интеграция со своими токенами: Drive и Календарь подключаются независимо, и отзыв доступа
// к одному не должен ломать другой. Токен обновляется так же, как у Drive.

export const findGcal = (owner: string) => Integration.findOne({ owner, type: "gcal" });

export async function connectGcal(owner: string, tokens: Tokens) {
    if (!tokens.refreshToken) throw new ProviderError("Google did not allow offline access. Remove the app in your Google account permissions and connect again.");
    const doc = (await findGcal(owner)) ?? new Integration({ owner, type: "gcal", token: randomToken() });
    // Список календарей и имя подключённого аккаунта. Основной календарь Google называется почтой
    // владельца, поэтому он же и есть имя: через Drive его не узнать — календарное согласие прав
    // на Drive не даёт, и тот запрос всегда отвечал отказом.
    let email = "";
    let calendars = doc.config?.calendars ?? [];
    try {
        const { listCalendars, toCalendarEntries } = await import("@/lib/google/calendar");
        const list = await listCalendars(tokens.accessToken);
        email = list.find((c) => c.primary)?.id ?? "";
        // Отметки «синхронизировать» не трогаем, если список уже был: их расставил человек
        if (!Array.isArray(calendars) || !calendars.length) calendars = toCalendarEntries(list);
    } catch {
        // Список не критичен: его можно загрузить из окна «Календари», имя аккаунта останется общим
    }
    // Выбранные календари и календарь для записи сохраняем при переподключении: человек их уже отметил.
    // scopes — то, что Google выдал на самом деле: по ним видно, можно ли писать в календарь.
    doc.set({
        name: email || "Google Calendar",
        config: { email, calendars, target: doc.config?.target ?? "", scopes: tokens.scope || doc.config?.scopes || "" },
        secrets: packSecrets(tokens),
        status: "connected",
        error: "",
    });
    doc.markModified("config");
    await doc.save();
    return doc;
}

export async function gcalToken(d: Doc): Promise<string> {
    const s = secretsOf<Tokens>(d);
    if (s.expiresAt > Date.now() + 60_000) return s.accessToken;
    if (!s.refreshToken) throw new ProviderError("Connect Google Calendar again");
    try {
        const fresh = await refreshTokens("google", s.refreshToken);
        d.secrets = packSecrets(fresh);
        await d.save();
        return fresh.accessToken;
    } catch {
        d.status = "error";
        d.error = "Google Calendar access was revoked. Connect it again.";
        await d.save();
        throw new ProviderError(d.error);
    }
}
