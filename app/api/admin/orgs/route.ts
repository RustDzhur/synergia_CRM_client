import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { effectivePlan } from "@/lib/billing";
import Membership from "@/models/Membership";
import Organization from "@/models/Organization";
import User from "@/models/User";

export const dynamic = "force-dynamic";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /api/admin/orgs?q= — фирмы платформы: владелец, тариф, подписка, число участников (последние 200)
export async function GET(req: Request) {
    const admin = await requirePlatformAdmin(req);
    if (!admin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);
    let filter: Record<string, unknown> = {};
    if (q) {
        const re = new RegExp(escapeRe(q), "i");
        const owners = await User.find({ $or: [{ email: re }, { firstname: re }, { lastname: re }] }).select("_id");
        filter = { $or: [{ name: re }, { ownerUser: { $in: owners.map((o) => o._id) } }] };
    }
    const orgs = await Organization.find(filter).sort({ createdAt: -1 }).limit(200);
    const owners = await User.find({ _id: { $in: orgs.map((o) => o.ownerUser) } }).select("email firstname lastname");
    const counts = await Membership.aggregate([{ $match: { org: { $in: orgs.map((o) => o._id) } } }, { $group: { _id: "$org", n: { $sum: 1 } } }]);
    return NextResponse.json(
        orgs.map((o) => {
            const u = owners.find((x) => String(x._id) === String(o.ownerUser));
            return {
                id: String(o._id),
                name: o.name,
                ownerEmail: u?.email ?? "",
                ownerName: u ? `${u.firstname} ${u.lastname}` : "",
                plan: effectivePlan(o),
                stripePlan: o.plan,
                override: o.planOverride || "",
                overrideUntil: o.planOverrideUntil ? o.planOverrideUntil.toISOString() : "",
                status: o.billing?.status ?? "",
                interval: o.billing?.interval ?? "",
                periodEnd: o.billing?.currentPeriodEnd ? o.billing.currentPeriodEnd.toISOString() : "",
                cancelAtPeriodEnd: !!o.billing?.cancelAtPeriodEnd,
                hasSubscription: !!o.billing?.subscriptionId && ["active", "trialing", "past_due"].includes(o.billing?.status ?? ""),
                members: counts.find((c) => String(c._id) === String(o._id))?.n ?? 0,
                blocked: !!o.blocked,
                createdAt: o.createdAt.toISOString(),
            };
        })
    );
}
