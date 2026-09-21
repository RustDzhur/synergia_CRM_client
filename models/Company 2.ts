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
        activities: { type: [ActivitySchema], default: [] },
    },
    { timestamps: true }
);

export default registerModel("Company", CompanySchema);
