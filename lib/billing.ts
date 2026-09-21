import type { HydratedDocument } from "mongoose";
import { PLANS, YEAR_MONTHS, type PlanId } from "@/app/config/plans";
import Organization from "@/models/Organization";

// Подписки: состояние берём у Stripe и записываем в пользователя. Функции идемпотентны — повторный вебхук ничего не портит.
export type Interval = "month" | "year";
export const PAID_PLANS = ["standard", "professional"] as const;
const ACTIVE = ["active", "trialing", "past_due"]; // past_due — Stripe ещё повторяет списание, доступ не отбираем сразу

export interface StripeSubscription {
    id: string;
    status: string;
    customer: string | { id: string };
    cancel_at_period_end?: boolean;
    current_period_end?: number;
    items?: { data?: { current_period_end?: number; price?: { recurring?: { interval?: string } } }[] };
    metadata?: Record<string, string>;
}

// Сумма в центах: год = YEAR_MONTHS месяцев
export function amountCents(plan: PlanId, interval: Interval) {
    const def = PLANS.find((p) => p.id === plan);
    if (!def || def.priceMonth <= 0) return 0;
    return def.priceMonth * (interval === "year" ? YEAR_MONTHS : 1) * 100;
}

export const isPaidPlan = (v: unknown): v is (typeof PAID_PLANS)[number] => (PAID_PLANS as readonly string[]).includes(String(v));

const customerId = (c: StripeSubscription["customer"]) => (typeof c === "string" ? c : c?.id ?? "");

// Тариф фирмы: ручное назначение из админ-кабинета (пока не истекло) главнее подписки Stripe
export function effectivePlan(org: { plan?: string; planOverride?: string; planOverrideUntil?: Date | null }): PlanId {
    if (org.planOverride && (!org.planOverrideUntil || org.planOverrideUntil.getTime() > Date.now())) return org.planOverride as PlanId;
    return (org.plan as PlanId) || "free";
}

// Записывает состояние подписки в фирму; фирма находится по metadata.orgId или по id клиента Stripe
export async function applySubscription(sub: StripeSubscription): Promise<HydratedDocument<any> | null> {
    const cid = customerId(sub.customer);
    const byMeta = sub.metadata?.orgId;
    const org = (byMeta ? await Organization.findById(byMeta).catch(() => null) : null) ?? (cid ? await Organization.findOne({ "billing.customerId": cid }) : null);
    if (!org) return null;
    const active = ACTIVE.includes(sub.status);
    const plan = isPaidPlan(sub.metadata?.plan) ? (sub.metadata!.plan as PlanId) : org.plan;
    const end = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
    const interval = sub.items?.data?.[0]?.price?.recurring?.interval ?? sub.metadata?.interval ?? "";
    org.plan = active ? plan : "free";
    org.billing = {
        customerId: cid || org.billing?.customerId || "",
        subscriptionId: sub.id,
        status: sub.status,
        interval: interval === "year" || interval === "month" ? interval : "",
        currentPeriodEnd: end ? new Date(end * 1000) : undefined,
        cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    };
    await org.save();
    return org;
}
