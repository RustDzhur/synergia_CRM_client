import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";
import { ActivitySchema } from "@/lib/activities";

// Задача (раздел Tasks and Projects и лента на Dashboard).
// Статус считается на лету: completed -> «Completed»; не выполнена и срок прошёл -> «Ended»; иначе «Active».
const TaskSchema = new Schema(
    {
        owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        title: { type: String, required: true },
        description: { type: String, default: "" },
        deadline: { type: String, default: "" }, // "YYYY-MM-DDTHH:mm" (локальное время, как отдаёт datetime-local)
        responsible: { type: String, default: "" },
        createdBy: { type: String, default: "" }, // имя автора на момент создания
        completed: { type: Boolean, default: false },
        pinned: { type: Boolean, default: false },
        muted: { type: Boolean, default: false },
        activities: { type: [ActivitySchema], default: [] }, // комментарии к задаче (type: "comment", meta: имя автора)
    },
    { timestamps: true }
);

export default registerModel("Task", TaskSchema);
