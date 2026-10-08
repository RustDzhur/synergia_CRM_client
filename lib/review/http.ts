import { NextResponse } from "next/server";
import { failure } from "@/lib/api";
import { PeriodError } from "@/lib/finance/periodLock";
import { ReviewError } from "./service";

export function reviewFailure(e: unknown) {
    if (e instanceof ReviewError) return NextResponse.json({ message: e.message }, { status: e.status });
    if (e instanceof PeriodError) return NextResponse.json({ message: e.message, ...((e as { checklist?: unknown }).checklist ? { checklist: (e as { checklist?: unknown }).checklist, code: "open_items" } : {}) }, { status: e.status });
    return failure(e);
}

export const actorOf = async (user: { userId: string; role: string }) => {
    const { prisma } = await import("@/lib/prisma");
    const u = await prisma.user.findUnique({ where: { id: user.userId }, select: { firstname: true, lastname: true } });
    return { userId: user.userId, role: user.role, name: u ? `${u.firstname} ${u.lastname}`.trim() : "" };
};
