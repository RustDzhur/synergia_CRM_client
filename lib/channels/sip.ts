import { ProviderError } from "@/lib/http";

// SIP-провайдер (любой): браузер сам регистрируется у него по SIP через WebSocket (WSS) и звонит — сервер CRM
// только хранит реквизиты (пароль зашифрован) и записывает журнал звонков. Работает с любой АТС/оператором,
// у которых включён SIP over WebSocket: Asterisk, FreeSWITCH, 3CX, FusionPBX, Kamailio, облачные АТС и т.д.
export interface SipConfig {
    server: string; // wss://sip.example.com:7443
    domain: string; // SIP-домен (realm), например sip.example.com
    username: string;
    authUser: string; // логин для авторизации, если отличается от username
    displayName: string;
    provider: string; // из каталога app/config/callProviders.ts: telnyx | asterisk | freeswitch | custom
}

const SIP_PROVIDERS = ["telnyx", "asterisk", "freeswitch", "custom"];
const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]"]);
const DOMAIN = /^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?(:\d{1,5})?$/i;
const USER = /^[A-Za-z0-9._+*#%@=-]{1,64}$/;

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Адрес WebSocket: только wss:// (страница CRM работает по https, обычный ws:// браузер заблокирует); ws:// — лишь для localhost
export function parseWsUrl(raw: string) {
    let u: URL;
    try {
        u = new URL(raw);
    } catch {
        throw new ProviderError("Server address must look like wss://sip.example.com:7443");
    }
    if (u.protocol !== "wss:" && !(u.protocol === "ws:" && LOCAL.has(u.hostname))) {
        throw new ProviderError("Server address must start with wss:// (browsers cannot use plain SIP over UDP/TCP)");
    }
    if (u.username || u.password) throw new ProviderError("Do not put the login or password into the server address");
    const out = u.toString();
    return u.pathname === "/" && !u.search && !u.hash ? out.replace(/\/$/, "") : out;
}

export function parseSip(input: Record<string, unknown>) {
    const server = parseWsUrl(clean(input.server, 300));
    const domain = clean(input.domain, 255).replace(/^sips?:/i, "");
    if (!DOMAIN.test(domain)) throw new ProviderError("SIP domain must be a host name, e.g. sip.example.com");
    const username = clean(input.username, 64);
    if (!USER.test(username)) throw new ProviderError("SIP username is required (letters, digits and . _ + - only)");
    const authUser = clean(input.authUser, 64);
    if (authUser && !USER.test(authUser)) throw new ProviderError("Auth username contains invalid characters");
    const password = clean(input.password, 200);
    if (!password) throw new ProviderError("SIP password is required");
    const displayName = clean(input.displayName, 40).replace(/["<>\\]/g, "");
    const provider = SIP_PROVIDERS.includes(clean(input.provider, 20)) ? clean(input.provider, 20) : "custom";
    const config: SipConfig = { server, domain, username, authUser, displayName, provider };
    return { config, secrets: { password } };
}
