import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";
import { ActivitySchema } from "@/lib/activities";

// Компания-клиент (вкладка Companies в CRM). Не путать с «Switch Company» в шапке —
// там компании самого пользователя.
const CompanySchema = new Schema(
    {
        owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        name: { type: String, required: true }, // «Legal entity's full name»
        email: { type: String, default: "" },
        field: { type: String, default: "" }, // сфера деятельности (Engineering, IT ...)
        status: { type: String, default: "" }, // «Legal entity's status»
        code: { type: String, default: "" }, // «USREOU code»
        registrationDate: { type: String, default: "" }, // "YYYY-MM-DD"
        authorisedPerson: { type: String, default: "" },
        businessType: { type: String, default: "" }, // «Type of business entity»
        ownershipForm: { type: String, default: "" }, // «Form of ownership»
        address: { type: String, default: "" }, // «Contacts»
        // Оптовые условия клиента (ТЗ §12): тип цены, кредитный лимит и отсрочка. Акт сверки и
        // контроль долга считаются по ним, а не «на глаз».
        priceType: { type: String, default: "" }, // «опт», «партнер»… — по нему выбирается цена товара
        creditLimit: { type: Number, default: 0 }, // 0 — без лимита
        paymentDays: { type: Number, default: 0 }, // отсрочка по умолчанию для его счетов
        activities: { type: [ActivitySchema], default: [] },
    },
    { timestamps: true }
);

export default registerModel("Company", CompanySchema);
