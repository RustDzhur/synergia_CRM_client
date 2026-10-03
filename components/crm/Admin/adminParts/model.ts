export interface Summary { orgs: number; users: number; byPlan: Record<string, number>; mrr: number; blocked: number; newRequests: number }
export interface OrgRow { id: string; name: string; ownerEmail: string; ownerName: string; plan: string; override: string; overrideUntil: string; members: number; blocked: boolean; createdAt: string; features: Record<string, boolean>; featureOverrides: Record<string, boolean> }
export interface Check { id: string; ok: boolean; message: string }
export interface OrderRow { id: string; org: string; orgName: string; number: string; plan: string; interval: string; method: "bank" | "usdt"; market: "DE" | "UA"; currency: string; amount: number; usdtAmount: number; company: string; vatId: string; status: "new" | "claimed" | "paid" | "cancelled"; payerRef: string; createdAt: string; claimedAt: string; paidAt: string }

export const PLANS = ["free", "standard", "professional"];
export const day = (iso: string) => (iso ? iso.slice(0, 10) : "");
export const addDays = (n: number) => new Date(Date.now() + n * 86400_000).toISOString();

export const cardClass = "fs-card p-16";
export const inputClass = "fs-field h-34 px-10 text-12 outline-none";
