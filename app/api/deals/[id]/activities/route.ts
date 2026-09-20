import { activityHandlers } from "@/lib/activities";
import Deal from "@/models/Deal";

export const { POST, DELETE } = activityHandlers(Deal);
