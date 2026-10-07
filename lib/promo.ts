import { prisma } from "@/lib/prisma";
import { PROMO, type PromoInfo } from "@/config/promo";

// Сколько мест программы уже занято: фирмы с отметкой billing.promo (её ставит администратор, когда открывает доступ)
export async function promoInfo(): Promise<PromoInfo> {
    const rows = await prisma.$queryRaw<{ n: bigint }[]>`select count(*) as n from organizations where billing -> 'promo' is not null`;
    const taken = Number(rows[0]?.n ?? 0);
    return { seats: PROMO.seats, taken, left: Math.max(0, PROMO.seats - taken), months: PROMO.months, email: (process.env.PROMO_EMAIL ?? "").trim() };
}
