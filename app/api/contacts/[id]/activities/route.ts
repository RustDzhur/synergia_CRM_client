import { activityHandlers } from "@/lib/activities";
import Contact from "@/models/Contact";

export const { POST, DELETE } = activityHandlers(Contact);
