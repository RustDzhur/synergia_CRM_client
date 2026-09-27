import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Событие календаря (Collaboration → Calendar). Раньше события лежали только в localStorage браузера —
// теперь они в фирме, поэтому их видят все участники и работают напоминания (lib/calendar/reminders.ts).
// calendar "my" — личное событие автора (видит только он), "company" — общее для фирмы.
const EventSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        title: { type: String, required: true },
        description: { type: String, default: "" },
        color: { type: String, default: "" },
        calendar: { type: String, enum: ["my", "company"], default: "my" },
        date: { type: String, default: "" }, // "YYYY-MM-DD" (местное время пользователя, как в форме)
        startTime: { type: String, default: "" }, // "HH:mm"
        endDate: { type: String, default: "" },
        endTime: { type: String, default: "" },
        attendees: { type: String, default: "" },
        location: { type: String, default: "" },
        reminder: { type: Number, default: 0 }, // за сколько минут напомнить; 0 — без напоминания
        // Сдвиг часового пояса автора события от UTC в минутах. Время события хранится «настенным»
        // (date + startTime без пояса), поэтому без этого поля сервер не знает, когда наступает
        // напоминание: у фирмы в другом поясе оно уехало бы на часы. Запоминаем пояс в момент создания.
        tzOffset: { type: Number, default: 0 },
        // Пояс браузера, в котором создано событие («Europe/Berlin»). Сдвиг в минутах верен только на
        // сегодня, поэтому для дат в другом сезоне (когда действует другое время) нужен сам пояс:
        // иначе событие, записанное в Google, уезжает на час.
        tzName: { type: String, default: "" },
        createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        createdByName: { type: String, default: "" }, // имя автора на момент создания
        // Связь с внешним календарём (lib/google/calendar.ts, lib/ical/icloud.ts). source = "google"
        // и "icloud" означает, что событие живёт не только в CRM: у iCloud это только чтение, у Google —
        // в обе стороны. externalId — id события у провайдера: он защищает от дублей при синхронизации
        // и указывает, что именно править. Такое событие может быть и создано в CRM (тогда связь
        // появляется после первой записи в Google), поэтому «пусто у событий из CRM» уже неверно.
        source: { type: String, enum: ["local", "google", "icloud"], default: "local" },
        externalId: { type: String },
        // Календарь провайдера, в котором событие лежит. Нужен, чтобы правка события в CRM
        // уходила в тот же календарь Google, а не в общий для фирмы.
        externalCalendarId: { type: String, default: "" },
    },
    { timestamps: true }
);
EventSchema.index({ org: 1, date: 1 });
EventSchema.index({ org: 1, source: 1, externalId: 1 }, { unique: true, partialFilterExpression: { externalId: { $type: "string" } } });

export default registerModel("Event", EventSchema);
