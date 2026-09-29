// Общие типы CRM: запись ленты активности и сущности с ней.

export type ActivityType =
    | "activity" | "comment" | "task" | "sms" | "whatsapp" | "telegram" | "email" | "note" | "call" | "schedule"
    | "stage" | "created"; // последние два — системные, создаются сервером

export interface Activity {
    _id: string;
    type: ActivityType;
    text: string;
    meta?: string;
    createdAt: string;
}

export interface WithActivities {
    activities?: Activity[];
}
