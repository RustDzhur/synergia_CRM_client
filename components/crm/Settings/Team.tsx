"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbX } from "react-icons/tb";
import { type Role, type Module, ASSIGNABLE_ROLES, GRANTABLE, NO_MODULES } from "@/lib/access";
import { apiCall } from "@/store/crmApi";
import { useActiveOrg } from "@/store/useOrgStore";
import PageHeader from "@/components/crm/shared/PageHeader";
import ConfirmDialog from "../shared/ConfirmDialog";
import SettingsTabs from "./SettingsTabs";

interface Member { userId: string; name: string; email: string; role: Role; modules: string[]; effective: Module[]; you: boolean }
interface Invitation { id: string; email: string; role: Role; modules: string[]; createdAt: string }

// Settings → Team (/crm/settings/team): сотрудники фирмы, их роли и доступ к разделам. Видно владельцу и администраторам.
export default function Team() {
	const t = useTranslations("settings");
	const locale = useLocale();
	const org = useActiveOrg();
	const [members, setMembers] = useState<Member[]>([]);
	const [invites, setInvites] = useState<Invitation[]>([]);
	const [denied, setDenied] = useState(false);
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<Role>("employee");
	const [custom, setCustom] = useState<Module[]>([]);
	const [busy, setBusy] = useState(false);
	const [remove, setRemove] = useState<Member | null>(null);

	const load = useCallback(async () => {
		const res = await apiCall<{ members: Member[]; invitations: Invitation[] }>("/api/orgs/members");
		if (res.status === 403) return void setDenied(true);
		if (res.ok && res.data) {
			setDenied(false);
			setMembers(res.data.members);
			setInvites(res.data.invitations);
		}
	}, []);
	useEffect(() => { load(); }, [load]);

	async function invite(e: React.FormEvent) {
		e.preventDefault();
		if (busy) return;
		setBusy(true);
		const res = await apiCall<{ added: boolean; emailed: boolean }>("/api/orgs/members", "POST", { email, role, modules: role === "admin" ? [] : custom, lang: locale });
		setBusy(false);
		if (!res.ok) return void toast.error(res.message);
		toast.success(res.data?.added ? t(res.data.emailed ? "teamAddedMail" : "teamAdded") : t(res.data?.emailed ? "teamInvitedMail" : "teamInvited"));
		setEmail("");
		setCustom([]);
		load();
	}

	async function change(m: Member, patch: { role?: Role; modules?: string[] }) {
		const res = await apiCall(`/api/orgs/members/${m.userId}`, "PATCH", patch);
		if (!res.ok) toast.error(res.message);
		load();
	}
	const toggleModule = (m: Member, mod: Module) => {
		const base = m.modules.length ? m.modules.filter((x) => x !== NO_MODULES) : m.effective.filter((x) => (GRANTABLE as string[]).includes(x));
		const next = base.includes(mod) ? base.filter((x) => x !== mod) : [...base, mod];
		change(m, { modules: next.length ? next : [NO_MODULES] });
	};

	async function confirmRemove() {
		const m = remove;
		setRemove(null);
		if (!m) return;
		const res = await apiCall(`/api/orgs/members/${m.userId}`, "DELETE");
		if (!res.ok) toast.error(res.message);
		load();
	}

	const select = "fs-field h-40 px-12 text-13 outline-none";
	const canAdmin = org?.role === "owner";

	return (
		<div className="px-16 py-20 md:px-24 md:py-24 lg:px-32">
			<PageHeader />
			<div className="flex flex-col gap-20 lg:flex-row">
				<SettingsTabs className="shrink-0 md:self-start" />
				<div className="min-w-0 flex-1">
					{denied ? (
						<p className="fs-card p-20 text-13 text-[#8c948b]">{t("teamNoAccess")}</p>
					) : (
						<>
							<h2 className="mb-6 text-16 font-semibold text-[#f1f4ee]">{org?.name}</h2>
							<p className="mb-20 text-13 text-[#8c948b]">{t("teamHelp")}</p>

							<form onSubmit={invite} className="fs-card mb-24 p-20">
								<h3 className="mb-12 text-14 font-semibold text-[#f1f4ee]">{t("teamAdd")}</h3>
								<div className="flex flex-col gap-12 md:flex-row">
									<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@example.com" aria-label="Email" className={`${select} min-w-0 flex-1`} />
									<select value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label={t("teamRole")} className={select}>
										{ASSIGNABLE_ROLES.filter((r) => r !== "admin" || canAdmin).map((r) => <option key={r} value={r}>{t(`role_${r}`)}</option>)}
									</select>
									<button type="submit" disabled={busy} className="fs-btn fs-btn-primary h-40 disabled:opacity-60">{t("teamInvite")}</button>
								</div>
								{role !== "admin" && (
									<fieldset className="mt-12">
										<legend className="mb-6 text-12 text-[#8c948b]">{t("teamModulesHint")}</legend>
										<div className="flex flex-wrap gap-x-16 gap-y-6">
											{GRANTABLE.map((mod) => (
												<label key={mod} className="flex cursor-pointer items-center gap-6 text-12 text-[#cfd4cb]">
													<input type="checkbox" checked={custom.includes(mod)} onChange={() => setCustom(custom.includes(mod) ? custom.filter((x) => x !== mod) : [...custom, mod])} className="accent-[#c6ff4d]" />
													{t(`module_${mod}`)}
												</label>
											))}
										</div>
									</fieldset>
								)}
								<p className="mt-10 text-11 text-[#9AA396]">{t("teamInviteNote")}</p>
							</form>

							<ul className="flex flex-col gap-10">
								{members.map((m) => (
									<li key={m.userId} className="fs-card p-16">
										<div className="flex flex-wrap items-center gap-x-16 gap-y-8">
											<div className="min-w-0 flex-1">
												<p className="truncate text-13 font-medium text-[#f1f4ee]">{m.name} {m.you && <span className="text-11 font-normal text-[#9AA396]">({t("teamYou")})</span>}</p>
												<p className="truncate text-12 text-[#8c948b]">{m.email}</p>
											</div>
											{m.role === "owner" ? (
												<span className="fs-chip h-24 border-[rgba(198,255,77,0.35)] text-10 text-[#c6ff4d]">{t("role_owner")}</span>
											) : (
												<>
													<select value={m.role} onChange={(e) => change(m, { role: e.target.value as Role })} disabled={m.role === "admin" && !canAdmin} aria-label={t("teamRole")} className={select}>
														{ASSIGNABLE_ROLES.filter((r) => r !== "admin" || canAdmin || m.role === "admin").map((r) => <option key={r} value={r}>{t(`role_${r}`)}</option>)}
													</select>
													{!(m.role === "admin" && !canAdmin) && (
														<button type="button" onClick={() => setRemove(m)} aria-label={t("teamRemove")} title={t("teamRemove")} className="text-[#9AA396] transition-colors hover:text-danger"><TbX size={18} /></button>
													)}
												</>
											)}
										</div>
										{m.role !== "owner" && m.role !== "admin" && (
											<div className="mt-10 flex flex-wrap items-center gap-x-16 gap-y-6">
												{GRANTABLE.map((mod) => (
													<label key={mod} className="flex cursor-pointer items-center gap-6 text-12 text-[#cfd4cb]">
														<input type="checkbox" checked={m.effective.includes(mod)} onChange={() => toggleModule(m, mod)} className="accent-[#c6ff4d]" />
														{t(`module_${mod}`)}
													</label>
												))}
												{m.modules.length > 0 && (
													<button type="button" onClick={() => change(m, { modules: [] })} className="text-12 text-[#c6ff4d] hover:underline">{t("teamResetModules")}</button>
												)}
											</div>
										)}
									</li>
								))}
							</ul>

							{invites.length > 0 && (
								<div className="mt-24">
									<h3 className="mb-8 text-13 font-medium text-[#8c948b]">{t("teamPending")}</h3>
									<ul className="flex flex-col gap-8">
										{invites.map((i) => (
											<li key={i.id} className="flex items-center gap-12 rounded-10 border border-inkLine bg-[rgba(255,255,255,0.02)] px-16 py-10 text-12 text-[#cfd4cb]">
												<span className="min-w-0 flex-1 truncate">{i.email}</span>
												<span className="text-[#8c948b]">{t(`role_${i.role}`)}</span>
												<button type="button" aria-label={t("teamRemove")} onClick={async () => { await apiCall(`/api/orgs/invitations/${i.id}`, "DELETE"); load(); }} className="text-[#9AA396] hover:text-danger"><TbX size={16} /></button>
											</li>
										))}
									</ul>
								</div>
							)}
						</>
					)}
				</div>
			</div>
			<ConfirmDialog open={remove !== null} title={t("teamRemove")} text={t("teamRemoveText", { name: remove?.name ?? "" })} confirmLabel={t("teamRemove")} onCancel={() => setRemove(null)} onConfirm={confirmRemove} />
		</div>
	);
}
