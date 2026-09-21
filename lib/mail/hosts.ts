import { lookup } from "dns/promises";
import { isIP } from "net";
import { ProviderError } from "@/lib/http";

// Свой IMAP/SMTP-сервер вводит пользователь, а подключается к нему наш сервер. Чтобы так нельзя было
// «постучаться» во внутреннюю сеть (localhost, 10.x, 192.168.x, облачные метаданные 169.254.x), такие адреса запрещены.
// Для локальной проверки с тестовым почтовым сервером — MAIL_ALLOW_PRIVATE_HOSTS=1.
function isPrivate(ip: string) {
    if (ip.includes(":")) {
        const v = ip.toLowerCase();
        return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:");
    }
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
}

export async function assertPublicHost(host: string) {
    if (process.env.MAIL_ALLOW_PRIVATE_HOSTS === "1") return;
    if (!/^[a-zA-Z0-9.-]{1,253}$/.test(host)) throw new ProviderError("Invalid server address");
    let addresses: string[];
    try {
        addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
    } catch {
        throw new ProviderError(`Server ${host} was not found`);
    }
    if (addresses.some(isPrivate)) throw new ProviderError("This server address is not allowed");
}
