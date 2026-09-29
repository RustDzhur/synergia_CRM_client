import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { serverError } from "@/lib/api";
import { reportError } from "@/lib/reportError";
import FinanceSettings from "@/models/FinanceSettings";
import Invitation from "@/models/Invitation";
import Membership from "@/models/Membership";
import User from "@/models/User";

// Реквизиты фирмы приходят только со вкладки «Company»: там регистрируют фирму, а не человека,
// поэтому фамилия не спрашивается, а название фирмы становится именем аккаунта
interface CompanyInput { name?: unknown; taxNumber?: unknown; phone?: unknown; address?: unknown }

const text = (v: unknown, max = 120) => (typeof v === "string" ? v.replace(/[\p{Cc}<>]/gu, " ").trim().slice(0, max) : "");

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { firstname, lastname, email, password } = body as Record<string, unknown>;
        const firm = (body.company ?? null) as CompanyInput | null;
        const companyName = text(firm?.name, 80);
        if (!text(firstname) || !text(email) || !password || String(password).length < 8 || (!text(lastname) && !companyName)) {
            return NextResponse.json({ message: "Invalid data" }, { status: 400 });
        }
        await connectDB();
        const normalized = String(email).toLowerCase();
        if (await User.findOne({ email: normalized })) {
            return NextResponse.json({ message: "Email already in use" }, { status: 409 });
        }
        const passwordHash = await bcrypt.hash(String(password), 12);
        const created = await User.create({
            firstname: text(firstname, 80),
            lastname: text(lastname, 80),
            email: normalized,
            passwordHash,
            company: companyName,
            phone: text(firm?.phone, 40),
        });
        // Личная фирма нового аккаунта получает _id пользователя (lib/auth.ts), поэтому реквизиты
        // из формы можно положить в настройки бухгалтерии сразу: в счетах будут верные данные
        if (companyName) {
            await FinanceSettings.create({
                org: created._id,
                legalName: companyName,
                taxId: text(firm?.taxNumber, 60),
                address: text(firm?.address, 200),
                phone: text(firm?.phone, 40),
                email: normalized,
            }).catch((e) => reportError("signup:finance-settings", e)); // регистрация из-за этого падать не должна
        }
        // приглашён в фирму до регистрации — доступ появляется сразу
        const invites = await Invitation.find({ email: normalized, expiresAt: { $gt: new Date() } });
        for (const inv of invites) await Membership.updateOne({ org: inv.org, user: created._id }, { $setOnInsert: { role: inv.role, modules: inv.modules } }, { upsert: true });
        if (invites.length) await Invitation.deleteMany({ email: normalized });
        return NextResponse.json({ ok: true }, { status: 201 });
    } catch (e) {
        return serverError(e);
    }
}
