import { activityHandlers } from "@/lib/activities";
import Task from "@/models/Task";

export const { POST, DELETE } = activityHandlers(Task);
