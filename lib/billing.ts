import { type PlanId } from "@/config/plans";

// Тарифы платформы оплачиваются переводом (банк или USDT, см. lib/transferPay.ts); оплату подтверждает администратор,
// и тариф включается полем planOverride + planOverrideUntil. Здесь — общие определения тарифа фирмы.
export type Interval = "month" | "year";
export const PAID_PLANS = ["standard", "professional"] as const;

export const isPaidPlan = (v: unknown): v is (typeof PAID_PLANS)[number] => (PAID_PLANS as readonly string[]).includes(String(v));

// Тариф фирмы: назначенный (оплачено или выдано администратором) действует, пока не истёк срок; иначе — базовый тариф фирмы
export function effectivePlan(org: { plan?: string; planOverride?: string; planOverrideUntil?: Date | null }): PlanId {
    if (org.planOverride && (!org.planOverrideUntil || org.planOverrideUntil.getTime() > Date.now())) return org.planOverride as PlanId;
    return (org.plan as PlanId) || "free";
}
