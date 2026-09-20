import { activityHandlers } from "@/lib/activities";
import Company from "@/models/Company";

export const { POST, DELETE } = activityHandlers(Company);
