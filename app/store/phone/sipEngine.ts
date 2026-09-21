import type { Inviter, Invitation, Registerer, Session, UserAgent, Web } from "sip.js";
import type { EndInfo, EngineHandlers, PhoneEngine } from "./types";

// Реквизиты SIP-провайдера (сервер отдаёт их вошедшему пользователю: GET /api/sip/credentials)
export interface SipCreds {
    server: string; // wss://…
    domain: string;
    username: string;
    authUser?: string;
    displayName?: string;
    password: string;
}

const REGISTER_TIMEOUT_MS = 15000;
const ICE = [{ urls: "stun:stun.l.google.com:19302" }];

// «+49 (177) 55-19-322» → «+491775519322»; добавочные и буквенные имена остаются как есть
export const dialTarget = (raw: string) => {
    const v = raw.trim().replace(/^sips?:/i, "");
    return /^[+\d\s().-]+$/.test(v) ? v.replace(/[\s().-]/g, "") : v;
};

// SIP по WebSocket прямо из браузера (RFC 7118) на SIP.js: работает с любой АТС/оператором, где включён WSS.
// Итог каждого звонка в журнал CRM отправляет хранилище (POST /api/calls), сервер CRM в SIP не участвует.
export function createSipEngine(cfg: SipCreds, h: EngineHandlers): PhoneEngine {
    let ua: UserAgent | null = null;
    let registerer: Registerer | null = null;
    let session: Inviter | Invitation | null = null;
    let audio: HTMLAudioElement | null = null;
    let stopped = false;
    let registered = false;
    let everRegistered = false; // повторная регистрация после обрыва — только если первая уже удалась
    let SIP: typeof import("sip.js") | null = null;

    // подключаем удалённый звук к <audio> и подсказываем, у кого какой поток
    function bindMedia(s: Session) {
        const sdh = s.sessionDescriptionHandler as Web.SessionDescriptionHandler | undefined;
        const pc = sdh?.peerConnection;
        if (!pc || !audio) return;
        const remote = new MediaStream();
        pc.getReceivers().forEach((r) => r.track && remote.addTrack(r.track));
        audio.srcObject = remote;
        audio.play().catch(() => { /* автовоспроизведение заблокировано — звук пойдёт после клика */ });
    }

    function track(s: Inviter | Invitation, direction: "in" | "out") {
        session = s;
        let answered = false;
        let status = 0; // код ответа на исходящий INVITE, если его отклонили
        s.stateChange.addListener((state) => {
            if (!SIP) return;
            if (state === SIP.SessionState.Established) {
                answered = true;
                bindMedia(s);
                h.connected();
            } else if (state === SIP.SessionState.Terminated) {
                if (session !== s) return;
                session = null;
                if (audio) audio.srcObject = null;
                // код отказа (486 «занято», 404…) приходит в requestDelegate уже после смены состояния — читаем его на следующем тике
                setTimeout(() => {
                    const end: EndInfo = { answered };
                    if (!answered && direction === "out") end.reason = status === 486 || status === 600 || status === 603 ? "busy" : status === 487 ? "canceled" : status ? "failed" : "canceled";
                    h.ended(end);
                }, 0);
            }
        });
        return {
            setStatus: (code: number) => { status = code; },
        };
    }

    function start() {
        return new Promise<void>((resolve, reject) => {
            (async () => {
                const lib = await import("sip.js");
                SIP = lib;
                if (stopped) return reject(new Error("stopped"));
                audio = document.createElement("audio");
                audio.autoplay = true;
                audio.style.display = "none";
                document.body.appendChild(audio);

                const uri = lib.UserAgent.makeURI(`sip:${cfg.username}@${cfg.domain}`);
                if (!uri) throw new Error("Invalid SIP username or domain");
                h.link("connecting");
                const agent = new lib.UserAgent({
                    uri,
                    transportOptions: { server: cfg.server, connectionTimeout: 10, keepAliveInterval: 30 },
                    authorizationUsername: cfg.authUser || cfg.username,
                    authorizationPassword: cfg.password,
                    displayName: cfg.displayName || undefined,
                    logLevel: "error",
                    sessionDescriptionHandlerFactoryOptions: { peerConnectionConfiguration: { iceServers: ICE } },
                    delegate: {
                        onInvite: (invitation) => {
                            if (session) return void invitation.reject({ statusCode: 486 }); // уже идёт разговор
                            track(invitation, "in");
                            h.incoming(invitation.remoteIdentity.uri.user || invitation.remoteIdentity.uri.toString());
                        },
                        onConnect: () => { if (everRegistered && !registered && registerer) registerer.register().catch(() => undefined); },
                        onDisconnect: (error) => {
                            registered = false;
                            h.link("offline");
                            if (error && !stopped) {
                                // разрыв сети: пробуем переподключиться, регистрация восстановится в onConnect
                                setTimeout(() => { if (!stopped) ua?.reconnect().catch(() => undefined); }, 5000);
                            }
                        },
                    },
                });
                ua = agent;

                let settled = false;
                const done = (err?: Error) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    err ? reject(err) : resolve();
                };
                const timer = setTimeout(() => done(new Error("The SIP server did not answer. Check the server address (wss://…) and that WebSocket is enabled.")), REGISTER_TIMEOUT_MS);

                const reg = new lib.Registerer(agent, { expires: 300 });
                registerer = reg;
                reg.stateChange.addListener((state) => {
                    if (state === lib.RegistererState.Registered) {
                        registered = true;
                        everRegistered = true;
                        h.link("ready");
                        done();
                    }
                });
                await agent.start().catch((e: Error) => { throw new Error(`Cannot reach the SIP server: ${e?.message ?? e}`); });
                await reg.register({
                    requestDelegate: {
                        onReject: (res) => {
                            h.link("offline");
                            const code = res.message.statusCode;
                            done(new Error(code === 401 || code === 403 ? "The SIP server rejected the login or password" : `Registration failed: ${code} ${res.message.reasonPhrase}`));
                        },
                    },
                });
            })().catch((e: Error) => { h.link("offline"); reject(e); });
        });
    }

    return {
        start,

        stop() {
            stopped = true;
            try { session && (session.state === "Established" ? (session as Session).bye() : undefined); } catch { /* уже завершён */ }
            if (everRegistered) registerer?.unregister().catch(() => undefined); // при неудачной регистрации отменять нечего
            setTimeout(() => { ua?.stop().catch(() => undefined); audio?.remove(); }, 300);
            session = null;
        },

        async dial(number) {
            if (!ua || !SIP) throw new Error("Phone is not connected");
            const target = SIP.UserAgent.makeURI(`sip:${encodeURIComponent(dialTarget(number)).replace(/%2B/g, "+")}@${cfg.domain}`);
            if (!target) throw new Error("Invalid number");
            const inviter = new SIP.Inviter(ua, target, { sessionDescriptionHandlerOptions: { constraints: { audio: true, video: false } } });
            const t = track(inviter, "out");
            try {
                await inviter.invite({ requestDelegate: { onReject: (res) => t.setStatus(res.message.statusCode ?? 0) } });
            } catch (e) {
                const name = (e as Error)?.name ?? "";
                h.error(name === "NotAllowedError" || name === "NotFoundError" ? "mic" : (e as Error)?.message ?? "Call failed");
            }
        },

        answer() {
            if (session && "accept" in session) session.accept({ sessionDescriptionHandlerOptions: { constraints: { audio: true, video: false } } }).catch((e: Error) => h.error(e?.name === "NotAllowedError" ? "mic" : e?.message ?? "Call failed"));
        },

        decline() {
            if (session && "reject" in session) session.reject({ statusCode: 603 }).catch(() => undefined);
        },

        hangup() {
            const s = session;
            if (!s || !SIP) return;
            if (s.state === SIP.SessionState.Established) s.bye().catch(() => undefined);
            else if ("cancel" in s) s.cancel().catch(() => undefined); // исходящий, ещё не отвеченный
            else if ("reject" in s) s.reject({ statusCode: 603 }).catch(() => undefined);
        },

        mute(on) {
            const pc = (session?.sessionDescriptionHandler as Web.SessionDescriptionHandler | undefined)?.peerConnection;
            pc?.getSenders().forEach((s) => { if (s.track) s.track.enabled = !on; });
        },

        // Цифры в разговоре: сначала по RTP (RFC 2833), а если провайдер этого не согласовал — SIP INFO
        dtmf(digit) {
            const s = session;
            if (!s) return;
            let sent = false;
            try { sent = !!(s.sessionDescriptionHandler as Web.SessionDescriptionHandler | undefined)?.sendDtmf(digit); } catch { sent = false; }
            if (!sent) void s.info({ requestOptions: { body: { contentDisposition: "render", contentType: "application/dtmf-relay", content: `Signal=${digit}\r\nDuration=160` } } }).catch(() => undefined);
        },
    };
}

// Проверка реквизитов перед сохранением (окно подключения): регистрируемся у провайдера и сразу отключаемся
export async function testSipRegistration(cfg: SipCreds): Promise<{ ok: true } | { ok: false; message: string }> {
    let engine: PhoneEngine | null = null;
    try {
        engine = createSipEngine(cfg, { link() {}, incoming() {}, connected() {}, ended() {}, error() {} });
        await engine.start();
        return { ok: true };
    } catch (e) {
        return { ok: false, message: (e as Error)?.message || "Connection failed" };
    } finally {
        engine?.stop();
    }
}
