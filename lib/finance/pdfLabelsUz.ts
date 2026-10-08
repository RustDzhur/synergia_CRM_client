// Подписи PDF для рынка UZ: узбекский (латиница) и русский. Документ узбекской фирмы по умолчанию двуязычный — «uz / ru»
// в названии, шапках таблицы и итогах (docs/TZ_UZBEKISTAN_AND_ROBOTS.md, 7.6: язык документов на уровне закона не подтверждён
// однозначно, поэтому печатаются обе версии). Тексты — черновик: юридические и бухгалтерские термины вычитывает специалист рынка.
export const UZ_LABELS: Record<string, string> = {
    invoice: "Hisob-faktura", credit_note: "Tuzatish hisob-fakturasi", quote: "Tijorat taklifi", order: "Buyurtma", contract: "Shartnoma",
    delivery_note: "Yuk xati", packing_list: "Qadoqlash varaqasi", deliveryDate: "Yetkazib berish sanasi", ourOrder: "Bizning buyurtma",
    level_1: "To‘lov eslatmasi", level_2: "1-ogohlantirish", level_3: "2-ogohlantirish", level_4: "Oxirgi ogohlantirish",
    creditFor: "Hisob-fakturaga tuzatish", billTo: "Xaridor", issueDate: "Berilgan sana", dueDate: "To‘lov muddati", date: "Sana", orderDate: "Buyurtma sanasi",
    supplyDate: "Xizmat ko‘rsatilgan sana", supplyPeriod: "Xizmat ko‘rsatish davri",
    dunningLevel: "To‘lov eslatmasi", dunningFee: "Eslatma uchun to‘lov", dunningNewDue: "Yangi to‘lov muddati",
    validUntil: "Amal qilish muddati", startDate: "Boshlanishi", endDate: "Tugashi", contractValue: "Shartnoma summasi", contractNo: "Shartnoma",
    description: "Nomi", qty: "Soni", unitPrice: "Narxi", tax: "QQS", lineTotal: "Summa",
    net: "QQSsiz jami", taxTotal: "QQS", gross: "To‘lov uchun jami", taxOn: "dan",
    sumInWords: "Summa yozuv bilan",
    smallBusiness: "QQS hisoblanmaydi: firma QQS to‘lovchisi emas.",
    paymentTerms: "To‘lov muddati", days: "kun", iban: "Hisob raqami", bic: "MFO", bank: "Bank", notes: "Izohlar",
    seller: "Sotuvchi", payByQr: "QR-kod orqali to‘lash", qrHint: "Bank ilovasida skanerlang", continued: "davomi",
    uahTotal: "Jami", uahRate: "kurs",
    act: "Bajarilgan ishlar dalolatnomasi", actDate: "Tuzilgan sana", actFor: "hisob-faktura bo‘yicha",
    signedBy: "Ijrochi", signedByCustomer: "Buyurtmachi", issuedBy: "Topshirdi", receivedBy: "Qabul qildi",
    hsCode: "TIF TN kodi", weightKg: "Og‘irligi, kg", origin: "Mamlakat", totalWeight: "Umumiy og‘irlik", packingDate: "Qadoqlash sanasi",
    inn: "STIR", pinfl: "JShShIR", vatCode: "QQS to‘lovchisi kodi",
};

export const RU_LABELS: Record<string, string> = {
    invoice: "Счёт-фактура", credit_note: "Корректировочный счёт-фактура", quote: "Коммерческое предложение", order: "Заказ", contract: "Договор",
    delivery_note: "Товарная накладная", packing_list: "Упаковочный лист", deliveryDate: "Дата поставки", ourOrder: "Наш заказ",
    level_1: "Напоминание об оплате", level_2: "1-е напоминание", level_3: "2-е напоминание", level_4: "Последнее напоминание",
    creditFor: "Корректировка к счёту-фактуре", billTo: "Покупатель", issueDate: "Дата выписки", dueDate: "Срок оплаты", date: "Дата", orderDate: "Дата заказа",
    supplyDate: "Дата оказания услуг", supplyPeriod: "Период оказания услуг",
    dunningLevel: "Напоминание об оплате", dunningFee: "Плата за напоминание", dunningNewDue: "Новый срок оплаты",
    validUntil: "Действительно до", startDate: "Начало", endDate: "Окончание", contractValue: "Сумма договора", contractNo: "Договор",
    description: "Наименование", qty: "Кол-во", unitPrice: "Цена", tax: "НДС", lineTotal: "Сумма",
    net: "Итого без НДС", taxTotal: "НДС", gross: "Итого к оплате", taxOn: "от",
    sumInWords: "Сумма прописью",
    smallBusiness: "НДС не начисляется: фирма не является плательщиком НДС.",
    paymentTerms: "Срок оплаты", days: "дн.", iban: "Расчётный счёт", bic: "МФО", bank: "Банк", notes: "Примечания",
    seller: "Продавец", payByQr: "Оплата по QR-коду", qrHint: "Сканируйте в банковском приложении", continued: "продолжение",
    uahTotal: "Итого", uahRate: "курс",
    act: "Акт выполненных работ", actDate: "Дата составления", actFor: "к счёту-фактуре",
    signedBy: "Исполнитель", signedByCustomer: "Заказчик", issuedBy: "Сдал", receivedBy: "Принял",
    hsCode: "Код ТН ВЭД", weightKg: "Вес, кг", origin: "Страна", totalWeight: "Общий вес", packingDate: "Дата упаковки",
    inn: "ИНН", pinfl: "ПИНФЛ", vatCode: "Код плательщика НДС",
};

// Ключи, которые печатаются в двух языках сразу («uz / ru»): названия документов, стороны, даты, итоги и главные колонки.
// Остальные (мелкие подписи, подсказки) остаются на одном языке — узбекском, чтобы строки таблицы и шапки не разъезжались по ширине.
const BILINGUAL = new Set([
    "invoice", "credit_note", "quote", "order", "contract", "delivery_note", "packing_list", "act",
    "billTo", "seller", "issueDate", "dueDate", "date", "orderDate", "description", "net", "taxTotal", "gross", "signedBy", "signedByCustomer", "issuedBy", "receivedBy",
]);

/** Подписи узбекского документа. only === "ru" — только русский; иначе двуязычные «uz / ru» (по умолчанию). */
export function uzDocumentLabels(only?: "uz" | "ru" | null): Record<string, string> {
    if (only === "ru") return { ...UZ_LABELS, ...RU_LABELS };
    if (only === "uz") return { ...UZ_LABELS };
    const out: Record<string, string> = { ...UZ_LABELS };
    for (const k of Array.from(BILINGUAL)) if (UZ_LABELS[k] && RU_LABELS[k]) out[k] = `${UZ_LABELS[k]} / ${RU_LABELS[k]}`;
    return out;
}
