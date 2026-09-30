import { ProviderError, fetchProvider } from "@/lib/http";

// Нова Пошта: доставка для украинских фирм. API у неё одно на всё — POST с телом
// { apiKey, modelName, calledMethod, methodProperties } на https://api.novaposhta.ua/v2.0/json/.
// Здесь только запросы и разбор ответов; где хранится ключ и что делать с ТТН — в lib/finance/delivery.ts.

const apiUrl = () => process.env.NOVA_POSHTA_API_URL || "https://api.novaposhta.ua/v2.0/json/";

interface NpResponse<T> {
    success?: boolean;
    data?: T[];
    errors?: string[];
    warnings?: string[];
    info?: string[];
}

async function call<T>(apiKey: string, modelName: string, calledMethod: string, methodProperties: Record<string, unknown> = {}): Promise<T[]> {
    const res = await fetchProvider(apiUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, modelName, calledMethod, methodProperties }),
    });
    const json = (await res.json().catch(() => null)) as NpResponse<T> | null;
    if (!res.ok || !json) throw new ProviderError(`Нова Пошта не ответила (${res.status})`);
    if (!json.success) {
        const message = (json.errors ?? []).filter(Boolean).join("; ");
        // Отдельно объясняем самый частый отказ: ключ неверный или просрочен
        throw new ProviderError(message || "Нова Пошта отклонила запрос");
    }
    return json.data ?? [];
}

// Проверка ключа при подключении: дёшево и сразу видно, рабочий ли он
export async function checkApiKey(apiKey: string): Promise<void> {
    const data = await call<{ Description?: string }>(apiKey, "Common", "getTimeIntervals", {});
    if (!Array.isArray(data)) throw new ProviderError("Не вдалося перевірити ключ Нової Пошти");
}

export interface NpCity { ref: string; name: string; area: string }
export interface NpWarehouse { ref: string; name: string; number: string }

// Города: ищем по названию; limit ограничивает выборку, чтобы ответ не раздувался
export async function searchCities(apiKey: string, query: string, limit = 20): Promise<NpCity[]> {
    const data = await call<{ Ref: string; Description: string; AreaDescription?: string }>(apiKey, "Address", "searchSettlements", {
        CityName: query,
        Limit: String(limit),
        Page: "1",
    });
    // searchSettlements отвечает иерархией (область → населённые пункты) — разворачиваем её плоско
    const out: NpCity[] = [];
    const walk = (nodes: unknown[]) => {
        for (const node of nodes as { Ref?: string; Present?: string; MainDescription?: string; Area?: string; Addresses?: unknown[] }[]) {
            if (node?.Ref && node.Present) {
                out.push({ ref: node.Ref, name: node.Present, area: node.Area ?? node.MainDescription ?? "" });
            }
            if (Array.isArray(node?.Addresses)) walk(node.Addresses);
            if (out.length >= limit) return;
        }
    };
    walk(data as unknown[]);
    return out.slice(0, limit);
}

// Отделения города: по ref города
export async function cityWarehouses(apiKey: string, cityRef: string, query = "", limit = 50): Promise<NpWarehouse[]> {
    const data = await call<{ Ref: string; Description: string; Number?: string }>(apiKey, "Address", "getWarehouses", {
        CityRef: cityRef,
        FindByString: query,
        Limit: String(limit),
        Page: "1",
    });
    return data.map((w) => ({ ref: w.Ref, name: w.Description, number: w.Number ?? "" }));
}

export interface WaybillInput {
    cityRecipient: string; // ref города получателя
    warehouseRecipient: string; // ref отделения
    recipientName: string;
    recipientPhone: string;
    weight: number; // кг
    description: string;
    cost: number; // объявленная стоимость, ₴
    serviceType?: string; // WarehouseWarehouse, WarehouseDoors, DoorsWarehouse…
    payerType?: "Recipient" | "Sender";
    codAmount?: number; // наложений платёж, ₴ (0 — не брать)
    seats?: number;
}

export interface Waybill {
    ref: string;
    number: string; // номер ТТН, который называют клиенту
    cost: number; // стоимость доставки по расчёту Новой Пошты
    estimatedDelivery: string;
}

// Создание ТТН. Отправитель задаётся в настройках интеграции (город, отделение, имя, телефон);
// здесь — только получатель и параметры посылки.
export async function createWaybill(apiKey: string, sender: { city: string; warehouse: string; name: string; phone: string }, input: WaybillInput): Promise<Waybill> {
    // Идентификаторы отправителя Нова Пошта выдаёт по её же справочникам: адрес, контакт и контрагент
    const [senderAddress, senderContact, counterparty] = await Promise.all([
        call<{ Ref: string }>(apiKey, "Address", "getWarehouseByRef", { Ref: sender.warehouse }).catch(() => []),
        call<{ Ref: string; ContactRef?: string }>(apiKey, "Counterparty", "getCounterpartyContactPersons", {}).catch(() => []),
        call<{ Ref: string; ContactPerson?: { data?: { Ref?: string }[] } }>(apiKey, "Counterparty", "getCounterparties", { CounterpartyProperty: "Sender", Page: "1" }).catch(() => []),
    ]);
    const senderRef = counterparty[0]?.Ref;
    const contactRef = senderContact[0]?.Ref ?? counterparty[0]?.ContactPerson?.data?.[0]?.Ref;
    const cityRef = sender.city;
    const addressRef = senderAddress[0]?.Ref ?? sender.warehouse;
    if (!senderRef || !contactRef || !cityRef || !addressRef) {
        throw new ProviderError("В налаштуваннях Нової Пошти не вистачає даних відправника — перевірте місто й відділення");
    }

    const data = await call<{ Ref: string; IntDocNumber: string; CostOnSite?: string; EstimatedDeliveryDate?: string }>(apiKey, "InternetDocument", "save", {
        PayerType: input.payerType ?? "Recipient",
        PaymentMethod: "Cash",
        DateTime: new Date().toISOString().slice(0, 10),
        CargoType: "Cargo",
        // вес считаем в килограммах целыми долями, минимум 0.1 кг — меньше Нова Пошта не принимает
        Weight: String(Math.max(0.1, Number(input.weight) || 0.1)),
        ServiceType: input.serviceType ?? "WarehouseWarehouse",
        SeatsAmount: String(input.seats ?? 1),
        Description: input.description.slice(0, 200) || "Товар",
        Cost: String(Math.max(1, Math.round(Number(input.cost) || 1))),
        CitySender: cityRef,
        Sender: senderRef,
        SenderAddress: addressRef,
        ContactSender: contactRef,
        SendersPhone: sender.phone,
        CityRecipient: input.cityRecipient,
        RecipientAddress: input.warehouseRecipient,
        RecipientName: input.recipientName.slice(0, 100),
        RecipientsPhone: input.recipientPhone,
        ...(input.codAmount ? { BackwardDeliveryData: [{ PayerType: "Recipient", CargoType: "Money", RedeliveryString: String(Math.round(input.codAmount)) }] } : {}),
    });
    const created = data[0];
    if (!created?.IntDocNumber) throw new ProviderError("Не вдалося створити ТТН");
    return {
        ref: created.Ref,
        number: created.IntDocNumber,
        cost: Number(created.CostOnSite) || 0,
        estimatedDelivery: created.EstimatedDeliveryDate ?? "",
    };
}

export interface TrackingInfo {
    number: string;
    status: string; // человеческий статус из Новой Пошты
    statusCode: string;
    warehouse: string; // где сейчас посылка
    scheduled: string; // ожидаемая дата прибытия
}

// Статус посылки по номеру ТТН — то, что видно клиенту в карточке заказа
export async function trackWaybills(apiKey: string, numbers: string[]): Promise<TrackingInfo[]> {
    if (!numbers.length) return [];
    const data = await call<{ Number: string; Status: string; StatusCode?: string; WarehouseRecipient?: string; ScheduledDeliveryDate?: string }>(
        apiKey,
        "TrackingDocument",
        "getStatusDocuments",
        { Documents: numbers.map((n) => ({ DocumentNumber: n, Phone: "" })) }
    );
    return data.map((d) => ({
        number: d.Number,
        status: d.Status ?? "",
        statusCode: d.StatusCode ?? "",
        warehouse: d.WarehouseRecipient ?? "",
        scheduled: d.ScheduledDeliveryDate ?? "",
    }));
}
