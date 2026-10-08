import { NextResponse } from "next/server";
import { failure } from "@/lib/api";
import type { AuthContext } from "@/lib/auth";
import { OfficeError } from "./store";
import type { OfficeCtx } from "./runner";
import { isPlatformAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

/** Видит ли вызывающий роботов платформы: только администратор платформы. Остальным они не существуют (404, нет в списках и в ответах Айрис). */
export async function platformScope(user: AuthContext): Promise<{ platform: boolean }> {
    const row = await prisma.user.findUnique({ where: { id: user.userId } });
    return { platform: await isPlatformAdminUser(row as never) };
}

// Общие мелочи маршрутов /api/office: контекст для ИИ и разбор ошибок (понятный текст — 400, остальное — как везде)
export function officeCtx(user: AuthContext, locale?: unknown, platformAdmin = false): OfficeCtx {
    const now = new Date().toISOString().slice(0, 16);
    return { org: user.id, userId: user.userId, role: user.role, modules: user.modules, today: now.slice(0, 10), now, orgName: user.orgName, platformAdmin, locale: typeof locale === "string" ? locale.slice(0, 8) : undefined };
}

export function officeFailure(e: unknown) {
    if (e instanceof OfficeError) return NextResponse.json({ message: e.message }, { status: 400 });
    return failure(e);
}
