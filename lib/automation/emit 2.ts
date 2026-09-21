import type { AutoEvent } from "./index";

// Точки, где CRM сообщает автоматизации о событии. Модуль движка подгружается лениво (import()), чтобы не создавать
// циклических зависимостей с почтой и каналами, и любая ошибка здесь не должна ломать основное действие пользователя.
export async function emit(org: string, ev: AutoEvent) {
    try {
        await (await import("./index")).fireEvent(org, ev);
    } catch (e) {
        console.error("automation emit failed", e);
    }
}

export async function emitDeal(org: string, deal: Parameters<typeof import("./index")["dealEvent"]>[1], type: "deal_created" | "deal_stage") {
    try {
        const { dealEvent, fireEvent } = await import("./index");
        await fireEvent(org, await dealEvent(org, deal, type));
    } catch (e) {
        console.error("automation emitDeal failed", e);
    }
}
