// Движок телефонии: одинаковый набор действий для любого провайдера (Twilio, SIP). Хранилище звонков (useCallStore)
// не знает, кто именно звонит — оно управляет движком и показывает состояние.
export type LinkStatus = "connecting" | "ready" | "offline";

export interface EndInfo {
    answered: boolean; // разговор состоялся
    reason?: "busy" | "failed" | "canceled"; // для неотвеченных исходящих: занято / ошибка / сами отменили
}

export interface EngineHandlers {
    link(status: LinkStatus): void; // регистрация у провайдера
    incoming(peer: string): void;
    connected(): void;
    ended(info: EndInfo): void;
    // token — провайдер отклонил ключи, mic — нет доступа к микрофону, иначе текст ошибки
    error(code: "token" | "mic" | string): void;
}

export interface PhoneEngine {
    start(): Promise<void>; // регистрация; отклоняет промис, если провайдер не принял реквизиты
    stop(): void;
    dial(number: string): Promise<void>;
    answer(): void;
    decline(): void;
    hangup(): void;
    mute(on: boolean): void;
    dtmf(digit: string): void;
}

export interface PhoneProvider {
    integrationId: string;
    type: "twilio" | "sip";
    name: string;
}
