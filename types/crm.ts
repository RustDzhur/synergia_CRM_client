// Общие типы CRM: запись ленты активности и сущности с ней.

export type ActivityType =
    | "activity" | "comment" | "task" | "sms" | "viber" | "telegram" | "email" | "note" | "call" | "schedule"
    | "stage" | "created" // системные, создаются сервером
    | "payment" | "invoice" | "quote" | "contract" | "order" | "expense" | "won"; // события бухгалтерии и сделки (lib/sync/feed.ts)

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
