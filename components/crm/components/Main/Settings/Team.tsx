"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdClose } from "react-icons/md";
import { ASSIGNABLE_ROLES, GRANTABLE, type Module, type Role } from "@/lib/access";
import { apiCall } from "@/app/store/crmApi";
import { useActiveOrg } from "@/app/store/useOrgStore";
import ConfirmDialog from "../shared/ConfirmDialog";
import SettingsTabs from "./SettingsTabs";

interface Member { userId: string; name: string; email: string; role: Role; modules: string[]; effective: Module[]; you: boolean }
interface Invitation { id: string; email: string; role: Role; modules: string[]; createdAt: string }

// Settings → Team (/crm/settings/team): сотрудники фирмы, их роли и доступ к разделам. Видно владельцу и администраторам.
export default function Team() {
	const t = useTranslations("settings");
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
		const res = await apiCall<{ added: boolean }>("/api/orgs/members", "POST", { email, role, modules: role === "admin" ? [] : custom });
		setBusy(false);
		if (!res.ok) return void toast.error(res.message);
		toast.success(res.data?.added ? t("teamAdded") : t("teamInvited"));
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
		const base = m.modules.length ? m.modules : m.effective.filter((x) => (GRANTABLE as string[]).includes(x));
		change(m, { modules: base.includes(mod) ? base.filter((x) => x !== mod) : [...base, mod] });
	};

	async function confirmRemove() {
		const m = remove;
		setRemove(null);
		if (!m) return;
		const res = await apiCall(`/api/orgs/members/${m.userId}`, "DELETE");
		if (!res.ok) toast.error(res.message);
		load();
	}

	const select = "h-[40px] rounded-8 border border-[#E6E6E6] bg-white px-10 text-16 text-[#666666] outline-none focus:border-[#5EA8F5]";
	const canAdmin = org?.role === "owner";

	return (
		<div className="p-16 md:p-30">
			<div className="flex flex-col gap-30 lg:flex-row">
				<SettingsTabs className="shrink-0 md:self-start" />
				<div className="min-w-0 flex-1">
					{denied ? (
						<p className="rounded-16 bg-white p-24 text-16 text-[#666666] shadow-heroImage">{t("teamNoAccess")}</p>
					) : (
						<>
							<h2 className="mb-6 text-24 font-semibold text-[#333333]">{org?.name}</h2>
							<p className="mb-20 text-14 text-[#999999]">{t("teamHelp")}</p>

							<form onSubmit={invite} className="mb-24 rounded-16 bg-white p-20 shadow-heroImage">
								<h3 className="mb-12 text-18 font-medium text-[#333333]">{t("teamAdd")}</h3>
								<div className="flex flex-col gap-12 md:flex-row">
									<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@example.com" aria-label="Email" className={`${select} min-w-0 flex-1`} />
									<select value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label={t("teamRole")} className={select}>
										{ASSIGNABLE_ROLES.filter((r) => r !== "admin" || canAdmin).map((r) => <option key={r} value={r}>{t(`role_${r}`)}</option>)}
									</select>
									<button type="submit" disabled={busy} className="h-[40px] rounded-8 bg-primaryColor px-20 text-16 font-medium text-white shadow-custom transition-opacity hover:opacity-80 disabled:opacity-60">{t("teamInvite")}</button>
								</div>
								{role !== "admin" && (
									<fieldset className="mt-12">
										<legend className="mb-6 text-14 text-[#999999]">{t("teamModulesHint")}</legend>
										<div className="flex flex-wrap gap-x-16 gap-y-6">
											{GRANTABLE.map((mod) => (
												<label key={mod} className="flex cursor-pointer items-center gap-6 text-14 text-[#666666]">
													<input type="checkbox" checked={custom.includes(mod)} onChange={() => setCustom(custom.includes(mod) ? custom.filter((x) => x !== mod) : [...custom, mod])} className="accent-[#5EA8F5]" />
													{t(`module_${mod}`)}
												</label>
											))}
										</div>
									</fieldset>
								)}
								<p className="mt-10 text-12 text-[#B3B3B3]">{t("teamInviteNote")}</p>
							</form>

							<ul className="flex flex-col gap-12">
								{members.map((m) => (
									<li key={m.userId} className="rounded-16 bg-white p-16 shadow-heroImage">
										<div className="flex flex-wrap items-center gap-x-16 gap-y-8">
											<div className="min-w-0 flex-1">
												<p className="truncate text-16 font-medium text-[#333333]">{m.name} {m.you && <span className="text-12 font-normal text-[#999999]">({t("teamYou")})</span>}</p>
												<p className="truncate text-14 text-[#999999]">{m.email}</p>
											</div>
											{m.role === "owner" ? (
												<span className="rounded-4 bg-[#EEF5FF] px-10 py-2 text-14 font-medium text-primaryColor">{t("role_owner")}</span>
											) : (
												<>
													<select value={m.role} onChange={(e) => change(m, { role: e.target.value as Role })} disabled={m.role === "admin" && !canAdmin} aria-label={t("teamRole")} className={select}>
														{ASSIGNABLE_ROLES.filter((r) => r !== "admin" || canAdmin || m.role === "admin").map((r) => <option key={r} value={r}>{t(`role_${r}`)}</option>)}
													</select>
													{!(m.role === "admin" && !canAdmin) && (
														<button type="button" onClick={() => setRemove(m)} aria-label={t("teamRemove")} title={t("teamRemove")} className="text-[#999999] transition-colors hover:text-danger"><MdClose size={22} /></button>
													)}
												</>
											)}
										</div>
										{m.role !== "owner" && m.role !== "admin" && (
											<div className="mt-10 flex flex-wrap gap-x-16 gap-y-6">
												{GRANTABLE.map((mod) => (
													<label key={mod} className="flex cursor-pointer items-center gap-6 text-14 text-[#666666]">
														<input type="checkbox" checked={m.effective.includes(mod)} onChange={() => toggleModule(m, mod)} className="accent-[#5EA8F5]" />
														{t(`module_${mod}`)}
													</label>
												))}
											</div>
										)}
									</li>
								))}
							</ul>

							{invites.length > 0 && (
								<div className="mt-24">
									<h3 className="mb-8 text-16 font-medium text-[#666666]">{t("teamPending")}</h3>
									<ul className="flex flex-col gap-8">
										{invites.map((i) => (
											<li key={i.id} className="flex items-center gap-12 rounded-8 bg-[#F5F8FA] px-16 py-10 text-14 text-[#666666]">
												<span className="min-w-0 flex-1 truncate">{i.email}</span>
												<span className="text-[#999999]">{t(`role_${i.role}`)}</span>
												<button type="button" aria-label={t("teamRemove")} onClick={async () => { await apiCall(`/api/orgs/invitations/${i.id}`, "DELETE"); load(); }} className="text-[#999999] hover:text-danger"><MdClose size={20} /></button>
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
