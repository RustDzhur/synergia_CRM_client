import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Товар или услуга — общий каталог для склада, заказов, счетов и предложений. Услуга (type "service") не имеет остатка
// (stockQty игнорируется); товар (type "good") — есть, и его меняют только StockMovement-записи, не прямая правка поля
// (см. lib/finance/stock.ts), чтобы остаток всегда сходился с историей движений.
const ProductSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        name: { type: String, required: true },
        // Артикул (SKU) — внутренний код товара: по нему сопоставляется импорт и ищут товар
        sku: { type: String, default: "" },
        // Штрихкод с этикетки: сканер вводит его как обычный текст, поиск товара ищет и по нему
        barcode: { type: String, default: "" },
        type: { type: String, enum: ["good", "service"], default: "service" },
        unit: { type: String, default: "pcs" }, // «pcs», «h», «kg»...
        purchasePrice: { type: Number, default: 0 }, // закупочная цена — себестоимость для отчёта о прибыли
        salePrice: { type: Number, default: 0 },
        taxRate: { type: Number, default: null }, // null — берём ставку по умолчанию из FinanceSettings на момент выставления счёта
        stockQty: { type: Number, default: 0 }, // только для type "good"; источник истины — сумма StockMovement
        reorderLevel: { type: Number, default: 0 }, // ниже этого — «Low stock» на дашборде
        image: { type: String, default: "" }, // ссылка на картинку товара (импорт из каталога); файлы не храним — только URL
        // ВЭД (ТЗ §12, «Импорт/экспорт»): код УКТ ЗЕД / HS, вес единицы и страна происхождения —
        // без них не собрать упаковочный лист и данные для брокера
        hsCode: { type: String, default: "" },
        weightKg: { type: Number, default: 0 },
        originCountry: { type: String, default: "" },
        // Типы цен и ступени по количеству (ТЗ §12, «Опт»): набор цен «роздріб/опт/партнер»
        // и ступени — от какого количества какая цена действует. Пусто — работает salePrice.
        prices: { type: [{ _id: false, type: String, price: Number, minQty: Number }], default: [] },
        archived: { type: Boolean, default: false },
    },
    { timestamps: true }
);
ProductSchema.index({ org: 1, name: 1 });
// Поиск по штрихкоду сканером — обычный случай, индекс не помешает
ProductSchema.index({ org: 1, barcode: 1 });

export default registerModel("Product", ProductSchema);
