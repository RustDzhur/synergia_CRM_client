import jwt from "jsonwebtoken";
import { ProviderError, fetchProvider } from "@/lib/http";

// Хранилище файлов и фото: Firebase Storage (это обычный бакет Google Cloud Storage). Работаем напрямую через JSON API бакета
// от имени сервисного аккаунта Firebase — без SDK. Нужны две переменные окружения:
//   FIREBASE_SERVICE_ACCOUNT — JSON ключа сервисного аккаунта (Firebase → Project settings → Service accounts → Generate new private key),
//                              можно целиком в одну строку или в base64
//   FIREBASE_STORAGE_BUCKET  — имя бакета, например my-project.firebasestorage.app
// Адреса можно переопределить (GCS_API_URL, GCS_TOKEN_URL) — для проверки без настоящего проекта.
interface ServiceAccount { client_email: string; private_key: string; token_uri?: string }

// Значение переменной с типичными огрехами при вставке: пробелы, обрамляющие кавычки, «gs://» в имени бакета
const unquote = (v: string) => v.trim().replace(/^(["'])([\s\S]*)\1$/, "$2").trim();

function parseAccount(): { account: ServiceAccount | null; problem: string } {
    const raw = unquote(process.env.FIREBASE_SERVICE_ACCOUNT ?? "");
    if (!raw) return { account: null, problem: "FIREBASE_SERVICE_ACCOUNT is not set" };
    let sa: Partial<ServiceAccount>;
    try {
        // JSON целиком или он же в base64 (в том числе base64url)
        sa = JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    } catch {
        return { account: null, problem: "FIREBASE_SERVICE_ACCOUNT is not valid: it must be the whole service-account JSON file, or that file in base64" };
    }
    if (!sa.client_email || !sa.private_key) return { account: null, problem: "FIREBASE_SERVICE_ACCOUNT has no client_email/private_key: use the key file from Project settings → Service accounts → Generate new private key" };
    return { account: { ...(sa as ServiceAccount), private_key: sa.private_key.replace(/\\n/g, "\n") }, problem: "" };
}

const account = () => parseAccount().account;
const bucket = () => unquote(process.env.FIREBASE_STORAGE_BUCKET ?? "").replace(/^gs:\/\//, "").replace(/\/+$/, "");

// Что не так с настройкой хранилища (для проверки системы); пустая строка — всё в порядке. Значения секретов не раскрываются.
export function storageProblem() {
    const { problem } = parseAccount();
    if (problem) return problem;
    if (!bucket()) return "FIREBASE_STORAGE_BUCKET is not set: use the bucket name from Firebase → Storage, e.g. my-project.firebasestorage.app";
    return "";
}

const api = () => (process.env.GCS_API_URL || "https://storage.googleapis.com").replace(/\/+$/, "");
export const storageConfigured = () => !!(account() && bucket());

let cached: { token: string; exp: number } | null = null;

// Токен доступа сервисного аккаунта (OAuth 2.0 JWT bearer): живёт час, держим в памяти
async function accessToken() {
    if (cached && cached.exp > Date.now() + 60_000) return cached.token;
    const sa = account();
    if (!sa) throw new ProviderError("File storage is not configured");
    const tokenUri = process.env.GCS_TOKEN_URL || sa.token_uri || "https://oauth2.googleapis.com/token";
    const assertion = jwt.sign({ scope: "https://www.googleapis.com/auth/devstorage.read_write" }, sa.private_key, {
        algorithm: "RS256",
        issuer: sa.client_email,
        audience: tokenUri,
        expiresIn: 3600,
    });
    const res = await fetchProvider(tokenUri, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
    });
    const json = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number; error_description?: string } | null;
    if (!res.ok || !json?.access_token) throw new ProviderError(json?.error_description || "Firebase rejected the service account key");
    cached = { token: json.access_token, exp: Date.now() + (json.expires_in ?? 3600) * 1000 };
    return cached.token;
}

function storageError(status: number) {
    if (status === 402 || status === 403) return new ProviderError("Firebase Storage refused access. Check that the project is on the Blaze plan and the service account may write to the bucket.");
    if (status === 404) return new ProviderError("Firebase Storage bucket was not found. Check FIREBASE_STORAGE_BUCKET.");
    return new ProviderError(`Firebase Storage error ${status}`);
}

export async function putObject(path: string, data: Buffer, contentType: string) {
    const res = await fetchProvider(`${api()}/upload/storage/v1/b/${encodeURIComponent(bucket())}/o?uploadType=media&name=${encodeURIComponent(path)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": contentType || "application/octet-stream" },
        body: new Uint8Array(data),
    }, 30000);
    if (!res.ok) throw storageError(res.status);
}

// Возвращает ответ хранилища как есть (тело можно отдавать потоком); null — объекта нет
export async function getObject(path: string) {
    const res = await fetchProvider(`${api()}/storage/v1/b/${encodeURIComponent(bucket())}/o/${encodeURIComponent(path)}?alt=media`, {
        headers: { Authorization: `Bearer ${await accessToken()}` },
    }, 30000);
    if (res.status === 404) return null;
    if (!res.ok) throw storageError(res.status);
    return res;
}

export async function deleteObject(path: string) {
    const res = await fetchProvider(`${api()}/storage/v1/b/${encodeURIComponent(bucket())}/o/${encodeURIComponent(path)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${await accessToken()}` },
    });
    if (!res.ok && res.status !== 404) throw storageError(res.status);
}

// Проверка подключения: токен сервисного аккаунта получается и бакет существует (для админ-кабинета)
export async function checkBucket() {
    const res = await fetchProvider(`${api()}/storage/v1/b/${encodeURIComponent(bucket())}`, { headers: { Authorization: `Bearer ${await accessToken()}` } });
    if (!res.ok) throw storageError(res.status);
}
