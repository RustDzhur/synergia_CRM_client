import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { failure, unauthorized } from "@/lib/api";
import { requireMarket } from "@/lib/finance/marketGuard";
import { ProviderError } from "@/lib/http";
import { secretsOf } from "@/lib/integrations";
import { counterparties, postOffices, senderAddresses } from "@/lib/ukrposhta";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Укрпошта: состояние подключения и справочники для создания отправления.
//   GET              — подключена ли и какие адреса отправки есть у контрагента по договору;
//   GET ?offices=…   — справочник отделений (поиск по городу или индексу).
// Договор с Укрпоштою обязателен: без него справочники вернутся пустыми, и интерфейс скажет об этом.

async function token(org: string): Promise<string> {
    const doc = await prisma.integration.findFirst({ where: { owner: org, type: "ukrposhta", status: "connected" } });
    if (!doc) throw new ProviderError("Укрпошту не підключено — додайте bearer-токен у Налаштуваннях → Інтеграції");
    const value = String(secretsOf<{ token?: string }>(doc).token ?? "");
    if (!value) throw new ProviderError("У кабінеті Укрпошти не збережено токен");
    return value;
}

export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const url = new URL(req.url);
    try {
        await requireMarket(user.id, "UA");
        const t = await token(user.id);

        if (url.searchParams.has("offices")) {
            return NextResponse.json({ offices: await postOffices(t, url.searchParams.get("offices") ?? "") });
        }

        const parties = await counterparties(t);
        const sender = parties[0];
        const addresses = sender ? await senderAddresses(t, sender.uuid) : [];
        return NextResponse.json({
            connected: true,
            counterparty: sender ?? null,
            addresses,
        });
    } catch (e) {
        return failure(e);
    }
}
