import type { HydratedDocument } from "mongoose";
import { ProviderError } from "@/lib/http";
import { packSecrets, secretsOf } from "@/lib/integrations";
import { randomToken } from "@/lib/crypto";
import Integration from "@/models/Integration";
import {
    checkApiKey,
    checkReturn,
    cityWarehouses,
    createReturn,
    createWaybill,
    deleteWaybills,
    documentPrintUrl,
    documentPrice,
    markingUrl,
    normalizeNpPhone,
    pickCity,
    pickWarehouse,
    searchCities,
    trackWaybills,
    type NpCity,
    type NpWarehouse,
    type PriceEstimate,
    type ReturnPossibility,
    type TrackingInfo,
    type Waybill,
} from "@/lib/novaposhta";

// Доставка «Новою Поштою»: ключ и данные отправителя лежат в интеграции (Integration type "novaposhta"),
// секрет зашифрован — как у почты и каналов. Здесь — доступ к ним и операции, которыми пользуются маршруты.

export const findDelivery = (org: string) => Integration.findOne({ owner: org, type: "novaposhta", status: "connected" });

type DeliveryDoc = HydratedDocument<any>;

async function apiKeyOf(doc: DeliveryDoc): Promise<string> {
    const key = String(secretsOf<{ apiKey?: string }>(doc).apiKey ?? "");
    if (!key) throw new ProviderError("Ключ Нової Пошти не збережено — підключіть доставку в Налаштуваннях → Інтеграції");
    return key;
}

export interface DeliverySender { city: string; cityRef: string; warehouse: string; warehouseRef: string; name: string; phone: string }

export const senderOf = (doc: { config?: Record<string, string> }): DeliverySender => ({
    city: String(doc.config?.senderCity ?? ""),
    cityRef: String(doc.config?.senderCityRef ?? ""),
    warehouse: String(doc.config?.senderWarehouse ?? ""),
    warehouseRef: String(doc.config?.senderWarehouseRef ?? ""),
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
    /** Адресная доставка: курьер везёт посылку на адрес, а не в отделение */
    address?: { street: string; house: string; flat?: string };
    seats?: number;
}

// Способ доставки: отделение↔отделение или адресная (получатель/отправитель)
const serviceTypeFor = (input: { address?: WaybillRequest["address"] }): string => (input.address?.street ? "WarehouseDoors" : "WarehouseWarehouse");

// Создание ТТН по заказу: данные отправителя берём из настроек, получателя — из запроса
export async function createOrderWaybill(org: string, input: WaybillRequest): Promise<Waybill> {
    const doc = await findDelivery(org);
    if (!doc) throw new ProviderError("Доставка «Новою Поштою» не підключена");
    const sender = senderOf(doc);
    if (!sender.cityRef || !sender.warehouse || !sender.phone) {
        throw new ProviderError("У налаштуваннях доставки не заповнені місто, відділення або телефон відправника");
    }
    if (!sender.warehouseRef) {
        throw new ProviderError("Відділення відправника не знайдено у довіднику Нової Пошти — перезбережіть налаштування доставки");
    }
    return createWaybill(await apiKeyOf(doc), { city: sender.cityRef, warehouse: sender.warehouseRef, name: sender.name, phone: sender.phone }, {
        cityRecipient: input.cityRef,
        warehouseRecipient: input.warehouseRef,
        recipientName: input.recipient,
        recipientPhone: input.phone,
        weight: input.weight,
        description: input.description,
        cost: input.cost,
        codAmount: input.cod,
        seats: input.seats,
        serviceType: serviceTypeFor(input),
        ...(input.address?.street ? { address: { cityName: input.cityName, street: input.address.street, house: input.address.house, flat: input.address.flat } } : {}),
    });
}

/** Стоимость доставки заранее: цена видна до создания ТТН (включая обратную доставку при COD). */
export async function orderPrice(org: string, input: { cityRef: string; weight: number; cost: number; cod?: number; address?: boolean }): Promise<PriceEstimate> {
    const doc = await findDelivery(org);
    if (!doc) throw new ProviderError("Доставка «Новою Поштою» не підключена");
    const sender = senderOf(doc);
    if (!sender.cityRef) throw new ProviderError("У налаштуваннях доставки не заповнене місто відправника");
    return documentPrice(await apiKeyOf(doc), {
        citySender: sender.cityRef,
        cityRecipient: input.cityRef,
        weight: input.weight,
        cost: input.cost,
        codAmount: input.cod,
        serviceType: input.address ? "WarehouseDoors" : "WarehouseWarehouse",
    });
}

/** Удалить ТТН в Новой Поште (до того, как посылку приняли) — её номер перестаёт существовать. */
export async function deleteOrderWaybill(org: string, ref: string): Promise<void> {
    const doc = await findDelivery(org);
    if (!doc) throw new ProviderError("Доставка «Новою Поштою» не підключена");
    await deleteWaybills(await apiKeyOf(doc), [ref]);
}

/** Ссылки на печатные бланки: маркировка 100×100 и накладная A4. Ключ фирмы внутри — наружу
 *  их отдаёт только серверный прокси (app/api/orders/[id]/waybill/label), а не браузер напрямую. */
export async function waybillPrintUrl(org: string, ref: string, kind: "marking" | "document"): Promise<string> {
    const doc = await findDelivery(org);
    if (!doc) throw new ProviderError("Доставка «Новою Поштою» не підключена");
    const key = await apiKeyOf(doc);
    return kind === "document" ? documentPrintUrl(key, ref) : markingUrl(key, ref);
}

/** Возможен ли возврат/перенаправление по этой ТТН и какие причины доступны. */
export async function waybillReturnOptions(org: string, number: string): Promise<ReturnPossibility> {
    const doc = await findDelivery(org);
    if (!doc) throw new ProviderError("Доставка «Новою Поштою» не підключена");
    return checkReturn(await apiKeyOf(doc), number);
}

/** Оформление возврата (или перенаправления) по номеру ТТН. */
export async function createWaybillReturn(org: string, input: { number: string; reasonRef: string; subtypeRef?: string; type?: "Return" | "Redelivery"; note?: string }) {
    const doc = await findDelivery(org);
    if (!doc) throw new ProviderError("Доставка «Новою Поштою» не підключена");
    return createReturn(await apiKeyOf(doc), input);
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
    const doc = (await Integration.findOne({ owner: org, type: "novaposhta" })) ?? new Integration({ owner: org, type: "novaposhta", token: randomToken() });
    const previous = (() => {
        try { return secretsOf<{ apiKey?: string }>(doc); } catch { return {} as { apiKey?: string }; }
    })();
    const apiKey = input.apiKey.trim() || previous.apiKey || "";
    if (!apiKey) throw new ProviderError("Вкажіть ключ API Нової Пошти");
    // Ключ проверяется запросом к Новой Поште до записи: неверный ключ иначе лежал бы в базе и
    // «работал» до первой отправки, а ошибку человек увидел бы уже при создании ТТН
    await checkApiKey(apiKey);
    // Новая Пошта принимает город и отделение отправителя по своим ref, а в окне настроек их вписывают
    // словами («Київ», «Відділення №1»). Находим ref по справочнику здесь — это и есть «склад-отправитель»,
    // без которого ТТН не создать.
    let cityRef = input.senderCityRef ?? String(doc.config?.senderCityRef ?? "");
    if (!cityRef && input.senderCity.trim()) {
        const cities = await searchCities(apiKey, input.senderCity.trim()).catch(() => []);
        cityRef = pickCity(cities, input.senderCity)?.ref ?? "";
    }
    let warehouseRef = "";
    if (cityRef && input.senderWarehouse.trim()) {
        const list = await cityWarehouses(apiKey, cityRef, input.senderWarehouse.trim()).catch(() => []);
        warehouseRef = pickWarehouse(list, input.senderWarehouse)?.ref ?? "";
    }
    doc.set({
        name: "Нова Пошта",
        config: {
            senderCity: input.senderCity.trim(),
            senderCityRef: cityRef,
            senderWarehouse: input.senderWarehouse.trim(),
            senderWarehouseRef: warehouseRef,
            senderName: input.senderName.trim(),
            senderPhone: normalizeNpPhone(input.senderPhone.trim()),
        },
        secrets: packSecrets({ apiKey }),
        status: "connected",
        error: "",
    });
    doc.markModified("config");
    await doc.save();
    return doc;
}
