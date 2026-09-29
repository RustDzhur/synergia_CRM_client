export interface Summary { orgs: number; users: number; byPlan: Record<string, number>; mrr: number; blocked: number; newRequests: number }
export interface OrgRow { id: string; name: string; ownerEmail: string; ownerName: string; plan: string; stripePlan: string; override: string; overrideUntil: string; status: string; interval: string; periodEnd: string; cancelAtPeriodEnd: boolean; hasSubscription: boolean; members: number; blocked: boolean; createdAt: string; features: Record<string, boolean>; featureOverrides: Record<string, boolean> }
export interface Check { id: string; ok: boolean; message: string }
export interface Req { id: string; orgId: string; orgName: string; email: string; plan: string; interval: string; company: string; vatId: string; note: string; status: "new" | "done"; createdAt: string }

export const PLANS = ["free", "standard", "professional"];
export const day = (iso: string) => (iso ? iso.slice(0, 10) : "");
export const addDays = (n: number) => new Date(Date.now() + n * 86400_000).toISOString();

export const cardClass = "fs-card p-16";
export const inputClass = "fs-field h-34 px-10 text-12 outline-none";
