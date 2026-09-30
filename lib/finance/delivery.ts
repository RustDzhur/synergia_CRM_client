import type { HydratedDocument } from "mongoose";
import { ProviderError } from "@/lib/http";
import { packSecrets, secretsOf } from "@/lib/integrations";
import Integration from "@/models/Integration";
import { createWaybill, searchCities, cityWarehouses, trackWaybills, type NpCity, type NpWarehouse, type TrackingInfo, type Waybill } from "@/lib/novaposhta";

// Доставка «Новою Поштою»: ключ и данные отправителя лежат в интеграции (Integration type "novaposhta"),
// секрет зашифрован — как у почты и каналов. Здесь — доступ к ним и операции, которыми пользуются маршруты.

export const findDelivery = (org: string) => Integration.findOne({ owner: org, type: "novaposhta", status: "connected" });

type DeliveryDoc = HydratedDocument<any>;

async function apiKeyOf(doc: DeliveryDoc): Promise<string> {
    const key = String(secretsOf<{ apiKey?: string }>(doc).apiKey ?? "");
    if (!key) throw new ProviderError("Ключ Нової Пошти не збережено — підключіть доставку в Налаштуваннях → Інтеграції");
    return key;
}

export interface DeliverySender { city: string; cityRef: string; warehouse: string; name: string; phone: string }

export const senderOf = (doc: { config?: Record<string, string> }): DeliverySender => ({
    city: String(doc.config?.senderCity ?? ""),
    cityRef: String(doc.config?.senderCityRef ?? ""),
    warehouse: String(doc.config?.senderWarehouse ?? ""),
    name: String(doc.config?.senderName ?? ""),
    phone: String(doc.config?.senderPhone ?? ""),
});

// Города и отделения ищутся по ключу фирмы: справочники у Новой Пошты общие, но ключ всё равно нужен
export async function cities(org: string, query: string): Promise<NpCity[]> {
    const doc = await findDelivery(org);
    if (!doc) throw new ProviderError("Доставка «Новою Поштою» не підключена");
    return searchCities(await apiKeyOf(doc), query);
}

export async function warehouses(org: string, cityRef: string, query = ""): Promise<NpWarehouse[]> {
    const doc = await findDelivery(org);
    if (!doc) throw new ProviderError("Доставка «Новою Поштою» не підключена");
    return cityWarehouses(await apiKeyOf(doc), cityRef, query);
}

export interface WaybillRequest {
    cityRef: string;
    cityName: string;
    warehouseRef: string;
    warehouseName: string;
    recipient: string;
    phone: string;
    weight: number;
    cost: number;
    cod: number;
    description: string;
}

// Создание ТТН по заказу: данные отправителя берём из настроек, получателя — из запроса
export async function createOrderWaybill(org: string, input: WaybillRequest): Promise<Waybill> {
    const doc = await findDelivery(org);
    if (!doc) throw new ProviderError("Доставка «Новою Поштою» не підключена");
    const sender = senderOf(doc);
    if (!sender.cityRef || !sender.warehouse || !sender.phone) {
        throw new ProviderError("У налаштуваннях доставки не заповнені місто, відділення або телефон відправника");
    }
    return createWaybill(await apiKeyOf(doc), { city: sender.cityRef, warehouse: sender.warehouse, name: sender.name, phone: sender.phone }, {
        cityRecipient: input.cityRef,
        warehouseRecipient: input.warehouseRef,
        recipientName: input.recipient,
        recipientPhone: input.phone,
        weight: input.weight,
        description: input.description,
        cost: input.cost,
        codAmount: input.cod,
    });
}

// Статусы: Нова Пошта принимает до 100 номеров за раз, поэтому режем список
export async function trackStatuses(org: string, numbers: string[]): Promise<TrackingInfo[]> {
    const doc = await findDelivery(org);
    if (!doc) throw new ProviderError("Доставка «Новою Поштою» не підключена");
    const key = await apiKeyOf(doc);
    const out: TrackingInfo[] = [];
    for (let i = 0; i < numbers.length; i += 100) {
        out.push(...(await trackWaybills(key, numbers.slice(i, i + 100))));
    }
    return out;
}

// Сохранение подключения: ключ проверяется запросом к Новой Поште до записи — как у ботов и почты,
// иначе неверный ключ лежал бы в базе и «работал» до первой отправки
export async function saveDelivery(org: string, input: { apiKey: string; senderCity: string; senderWarehouse: string; senderName: string; senderPhone: string; senderCityRef?: string }) {
    const doc = (await Integration.findOne({ owner: org, type: "novaposhta" })) ?? new Integration({ owner: org, type: "novaposhta" });
    const previous = (() => {
        try { return secretsOf<{ apiKey?: string }>(doc); } catch { return {} as { apiKey?: string }; }
    })();
    const apiKey = input.apiKey.trim() || previous.apiKey || "";
    if (!apiKey) throw new ProviderError("Вкажіть ключ API Нової Пошти");
    doc.set({
        name: "Нова Пошта",
        config: { senderCity: input.senderCity.trim(), senderCityRef: input.senderCityRef ?? doc.config?.senderCityRef ?? "", senderWarehouse: input.senderWarehouse.trim(), senderName: input.senderName.trim(), senderPhone: input.senderPhone.trim() },
        secrets: packSecrets({ apiKey }),
        status: "connected",
        error: "",
    });
    doc.markModified("config");
    await doc.save();
    return doc;
}
