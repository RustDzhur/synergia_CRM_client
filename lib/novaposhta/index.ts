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

// Новая Пошта принимает телефон только цифрами в формате 380XXXXXXXXX: «+380 67 123-45-67»
// и «0671234567» приводим к нему; что не похоже на украинский номер — оставляем как есть
export function normalizeNpPhone(raw: string): string {
    const digits = (raw || "").replace(/\D/g, "");
    if (digits.length === 10 && digits.startsWith("0")) return `38${digits}`;
    if (digits.length === 12 && digits.startsWith("380")) return digits;
    return digits || raw.trim();
}

// Выбор города из подсказок Нової Пошти: точное совпадение, потом начало названия, потом первая
// подсказка (это даёт писать «Киев» — НП вернёт «Київ»). Чистая функция — проверяется тестом.
export function pickCity(cities: NpCity[], name: string): NpCity | null {
    const q = name.trim().toLowerCase();
    return (
        cities.find((c) => c.name.toLowerCase() === q) ??
        cities.find((c) => c.name.toLowerCase().startsWith(q)) ??
        cities[0] ??
        null
    );
}

// Выбор отделения: сперва по вхождению текста в название, потом по номеру («Відділення №1» → 1),
// и только если вариант один — он и есть ответ. Иначе null: угадывать чужое отделение нельзя.
export function pickWarehouse(list: NpWarehouse[], text: string): NpWarehouse | null {
    const q = text.trim().toLowerCase();
    const digits = q.match(/\d+/)?.[0];
    return (
        list.find((w) => w.name.toLowerCase().includes(q)) ??
        (digits ? list.find((w) => w.number === digits) : undefined) ??
        (list.length === 1 ? list[0] : null)
    );
}

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
    // Адресная доставка (ServiceType с Doors): улица, дом, квартира и населённый пункт текстом —
    // Нова Пошта привязывает их к своему классификатору сама
    address?: { cityName: string; area?: string; street: string; house: string; flat?: string };
}

// ── Расчёт стоимости ────────────────────────────────────────────────────────────────────────────────
// Стоимость видно до создания ТТН: иначе фирма узнаёт цену доставки уже после отправки.

export interface PriceEstimate {
    cost: number; // доставка, ₴
    redelivery: number; // обратная доставка (наложенный платёж), ₴
    assessed: number; // оценка стоимости услуги
}

export async function documentPrice(
    apiKey: string,
    input: { citySender: string; cityRecipient: string; weight: number; cost: number; serviceType?: string; seats?: number; codAmount?: number }
): Promise<PriceEstimate> {
    const data = await call<{ Cost?: string | number; CostRedelivery?: string | number; AssessedCost?: string | number; CostOnSite?: string | number }>(
        apiKey,
        "InternetDocument",
        "getDocumentPrice",
        {
            CitySender: input.citySender,
            CityRecipient: input.cityRecipient,
            Weight: String(Math.max(0.1, Number(input.weight) || 0.1)),
            ServiceType: input.serviceType ?? "WarehouseWarehouse",
            Cost: String(Math.max(1, Math.round(Number(input.cost) || 1))),
            CargoType: "Cargo",
            SeatsAmount: String(input.seats ?? 1),
            ...(input.codAmount ? { RedeliveryCalculate: { CargoType: "Money", Amount: String(Math.round(input.codAmount)) } } : {}),
        }
    );
    const row = data[0] ?? {};
    return {
        cost: Number(row.Cost ?? row.CostOnSite) || 0,
        redelivery: Number(row.CostRedelivery) || 0,
        assessed: Number(row.AssessedCost) || 0,
    };
}

// ── Удаление и печать ───────────────────────────────────────────────────────────────────────────────
// Отменить можно только непринятую посылку: если курьер уже забрал её, Новая Пошта отвечает отказом —
// тогда путь один, возврат/перенаправление (AdditionalService).

export async function deleteWaybills(apiKey: string, refs: string[]): Promise<void> {
    const list = refs.filter(Boolean);
    if (!list.length) return;
    await call(apiKey, "InternetDocument", "delete", { DocumentRefs: list });
}

/** Печать бланков: маркировка 100×100 и полная накладная A4. Ссылки ведут на печатный сервис
 *  Новой Пошты и содержат ключ фирмы, поэтому наружу их отдаёт только серверный прокси. */
export function markingUrl(apiKey: string, ref: string): string {
    return `https://my.novaposhta.ua/orders/printMarking100x100/orders/${encodeURIComponent(ref)}/type/pdf/apiKey/${encodeURIComponent(apiKey)}`;
}
export function documentPrintUrl(apiKey: string, ref: string): string {
    return `https://my.novaposhta.ua/orders/printDocument/orders/${encodeURIComponent(ref)}/type/pdf/apiKey/${encodeURIComponent(apiKey)}`;
}

// ── Возврат и перенаправление ───────────────────────────────────────────────────────────────────────
// Возврат оформляется «Дополнительной услугой» и возможен не всегда (зависит от статуса посылки) —
// поэтому сперва спрашиваем возможность, и только потом создаём заявку.

export interface ReturnPossibility { possible: boolean; reason?: string; reasons: Array<{ ref: string; name: string }> }

export async function checkReturn(apiKey: string, number: string): Promise<ReturnPossibility> {
    const [possibility, reasons, subtypes] = await Promise.all([
        call<{ CanCreateReturn?: string | boolean; Reason?: string }>(apiKey, "AdditionalService", "CheckPossibilityCreateReturn", { Number: number }).catch(() => []),
        call<{ Ref: string; Description?: string; Reason?: string; Name?: string }>(apiKey, "AdditionalService", "getReturnReasons", {}).catch(() => []),
        call<{ Ref: string; Description?: string; Reason?: string; Name?: string }>(apiKey, "AdditionalService", "getReturnReasonsSubtypes", {}).catch(() => []),
    ]);
    const row = possibility[0] ?? {};
    const list = (reasons.length ? reasons : subtypes).map((r) => ({ ref: String(r.Ref ?? ""), name: String(r.Description ?? r.Reason ?? r.Name ?? "") })).filter((r) => r.ref);
    return {
        possible: row.CanCreateReturn === true || String(row.CanCreateReturn ?? "").toLowerCase() === "true",
        reason: row.Reason ? String(row.Reason) : undefined,
        reasons: list,
    };
}

export async function createReturn(
    apiKey: string,
    input: { number: string; reasonRef: string; subtypeRef?: string; type?: "Return" | "Redelivery"; note?: string }
): Promise<{ ref: string; number: string }> {
    const data = await call<{ Ref?: string; Number?: string; OrderNumber?: string }>(apiKey, "AdditionalService", "orderCargoReturn", {
        Number: input.number,
        ReasonRef: input.reasonRef,
        ...(input.subtypeRef ? { SubtypeReasonRef: input.subtypeRef } : {}),
        OrderType: input.type ?? "Return",
        ...(input.note ? { Note: input.note.slice(0, 200) } : {}),
    });
    const row = data[0];
    if (!row?.Ref && !row?.Number) throw new ProviderError("Нова Пошта не прийняла заявку на повернення");
    return { ref: String(row.Ref ?? ""), number: String(row.Number ?? row.OrderNumber ?? "") };
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

    // Адресная доставка (Doors…): вместо отделения Новой Пошты передаются части адреса текстом —
    // она сама привязывает их к классификатору. Без улицы и дома такой ТТН не создать.
    const serviceType = input.serviceType ?? "WarehouseWarehouse";
    const byAddress = /Doors/i.test(serviceType);
    if (byAddress && !input.address?.street?.trim()) {
        throw new ProviderError("Для адресної доставки вкажіть вулицю та будинок отримувача");
    }

    const data = await call<{ Ref: string; IntDocNumber: string; CostOnSite?: string; EstimatedDeliveryDate?: string }>(apiKey, "InternetDocument", "save", {
        PayerType: input.payerType ?? "Recipient",
        PaymentMethod: "Cash",
        DateTime: new Date().toISOString().slice(0, 10),
        CargoType: "Cargo",
        // вес считаем в килограммах целыми долями, минимум 0.1 кг — меньше Нова Пошта не принимает
        Weight: String(Math.max(0.1, Number(input.weight) || 0.1)),
        ServiceType: serviceType,
        SeatsAmount: String(input.seats ?? 1),
        Description: input.description.slice(0, 200) || "Товар",
        Cost: String(Math.max(1, Math.round(Number(input.cost) || 1))),
        CitySender: cityRef,
        Sender: senderRef,
        SenderAddress: addressRef,
        ContactSender: contactRef,
        SendersPhone: sender.phone,
        CityRecipient: input.cityRecipient,
        ...(byAddress
            ? {
                  RecipientCityName: input.address!.cityName,
                  RecipientArea: input.address!.area ?? "",
                  RecipientStreet: input.address!.street,
                  RecipientHouse: input.address!.house,
                  ...(input.address!.flat ? { RecipientFlat: input.address!.flat } : {}),
              }
            : { RecipientAddress: input.warehouseRecipient }),
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
