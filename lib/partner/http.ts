import { NextResponse } from "next/server";
import { requireUser, type AuthContext } from "@/lib/auth";
import { failure, unauthorized } from "@/lib/api";
import { PartnerError, partnerOfUser } from "./service";

export function partnerFailure(e: unknown) {
    if (e instanceof PartnerError) return NextResponse.json({ message: e.message }, { status: e.status });
    return failure(e);
}

/** Маршруты кабинета банка: только сотрудник банка-партнёра, иначе 404 («такого кабинета нет»). Никаких запросов к данным фирм. */
export function withPartner(handler: (req: Request, ctx: { partner: { id: string; name: string; bankProvider: string }; user: AuthContext }, params: Record<string, string>) => Promise<Response>) {
    return async (req: Request, { params }: { params?: Record<string, string> } = {}) => {
        const user = await requireUser(req);
        if (!user) return unauthorized(req);
        const partner = await partnerOfUser(user.userId);
        if (!partner) return NextResponse.json({ message: "Not found" }, { status: 404 });
        try {
            return await handler(req, { partner, user }, params ?? {});
        } catch (e) {
            return partnerFailure(e);
        }
    };
}
