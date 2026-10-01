import { promises as fs } from "node:fs";
import path from "node:path";
import { ProviderError } from "@/lib/http";

// Локальное файловое хранилище (замена Firebase Storage). Файлы лежат в каталоге LOCAL_STORAGE_ROOT
// по тем же путям, что и в Firebase: users/<user>/<file>/<name>, messages/<owner>/<token>/<name>.
// Нужна одна переменная окружения:
//   LOCAL_STORAGE_ROOT — абсолютный путь к корню хранилища (на сервере, например, /data/crm-storage).
// Плюсы: пути совпадают с бакетом, поэтому объекты можно перенести из Firebase простым копированием.

const root = () => (process.env.LOCAL_STORAGE_ROOT ?? "").trim().replace(/\/+$/, "");

export function storageProblem(): string {
    const r = root();
    if (!r) return "LOCAL_STORAGE_ROOT is not set: point it to an absolute directory for uploaded files and photos";
    if (!path.isAbsolute(r)) return "LOCAL_STORAGE_ROOT must be an absolute path";
    return "";
}

export const storageConfigured = () => !!root();

// Резолвим относительный путь внутри корня. Отбрасываем «..» и абсолютные пути, чтобы клиент не вышел за пределы хранилища.
function safePath(p: string): string {
    const r = root();
    if (!r) throw new ProviderError("File storage is not configured");
    const clean = String(p).replace(/\\/g, "/").replace(/^\/+/, "");
    if (!clean) throw new ProviderError("Invalid storage path");
    const resolved = path.resolve(r, clean);
    const rel = path.relative(r, resolved);
    if (rel.startsWith("..") || path.isAbsolute(rel)) throw new ProviderError("Invalid storage path");
    return resolved;
}

export async function putObject(p: string, data: Buffer, _contentType: string) {
    // contentType в локальном хранилище не нужен: mime и так лежит в БД (DocItem.mime), а путь его не кодирует.
    const target = safePath(p);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, data);
}

// Возвращает Response, чтобы вызывающие могли забрать res.body и отдать потоком, как с Firebase.
// null — объекта нет (аналог 404 в бакете).
export async function getObject(p: string): Promise<Response | null> {
    let target: string;
    try {
        target = safePath(p);
    } catch {
        return null;
    }
    try {
        const data = await fs.readFile(target);
        return new Response(new Uint8Array(data));
    } catch (e) {
        if ((e as NodeJS.ErrnoException)?.code === "ENOENT") return null;
        throw new ProviderError(`Local storage read error: ${(e as Error)?.message ?? e}`);
    }
}

export async function deleteObject(p: string) {
    let target: string;
    try {
        target = safePath(p);
    } catch {
        return;
    }
    await fs.unlink(target).catch((e) => {
        if ((e as NodeJS.ErrnoException)?.code !== "ENOENT") throw e;
    });
}

// Проверка хранилища: корень существует и в него можно писать (для админ-кабинета / health).
export async function checkBucket() {
    const r = root();
    if (!r) throw new ProviderError("LOCAL_STORAGE_ROOT is not set");
    await fs.mkdir(r, { recursive: true });
    const probe = path.join(r, ".write-probe");
    await fs.writeFile(probe, "ok");
    await fs.unlink(probe);
}
