"use client";
import React, { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbBuildingSkyscraper, TbCheck, TbChevronDown, TbPlus } from "react-icons/tb";
import { useActiveOrg, useOrgStore } from "@/store/useOrgStore";
import Dropdown from "@/utils/Dropdown";
import { useClickOutside } from "@/utils/useClickOutside";

// Карточка «AKTIVE ORGANISATION» в сайдбаре: подпись сверху, название фирмы снизу.
// По клику — список фирм пользователя, создание новой и переименование текущей.
// Свёрнутый сайдбар показывает только плитку с иконкой: карточка целиком туда не помещается.
export default function OrgSwitcher({ collapsed = false }: { collapsed?: boolean }) {
	const t = useTranslations("navBar");
	const { orgs, activeId, load, switchOrg, create, rename } = useOrgStore();
	const active = useActiveOrg();
	const [open, setOpen] = useState(false);
	const [mode, setMode] = useState<"none" | "new" | "rename">("none");
	const [name, setName] = useState("");
	const rootRef = useRef<HTMLDivElement>(null);
	useClickOutside(rootRef, open, () => { setOpen(false); setMode("none"); });

	useEffect(() => { load(); }, [load]);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		const value = name.trim();
		if (!value) return;
		const res = mode === "new" ? await create(value) : await rename(value);
		if (!res.ok) return void toast.error(res.message);
		setMode("none");
		setOpen(false);
	}

	const canRename = active?.role === "owner" || active?.role === "admin";

	return (
		<div ref={rootRef} className="relative">
			<button
				type="button"
				aria-label={collapsed ? active?.name ?? t("company") : undefined}
				aria-expanded={open}
				onClick={() => setOpen((v) => !v)}
				className={
					collapsed
						? "fs-card flex h-40 w-full items-center justify-center transition-colors hover:bg-[rgba(255,255,255,0.05)]"
						: "fs-card flex w-full items-center gap-10 p-10 text-left transition-colors hover:bg-[rgba(255,255,255,0.05)]"
				}>
				{collapsed ? (
					<TbBuildingSkyscraper size={18} className="text-[#c6ff4d]" />
				) : (
					<>
						<span className="fs-icon-tile h-34 w-34 shrink-0">
							<TbBuildingSkyscraper size={18} />
						</span>
						<span className="min-w-0 flex-1">
							<span className="fs-nav-group block">{t("activeOrg")}</span>
							<span className="mt-4 block truncate text-14 font-medium text-[#f1f4ee]">{active ? active.name : t("company")}</span>
						</span>
						<TbChevronDown size={16} className={`shrink-0 text-[#8c948b] transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
					</>
				)}
			</button>

			<Dropdown open={open} className={collapsed ? "left-full top-0 ml-8 w-240" : "left-0 right-0 top-full mt-6"}>
				<div className="fs-popover overflow-hidden">
					<ul className="fs-scroll max-h-[280px] overflow-y-auto">
						{orgs.map((o) => (
							<li key={o.id} className="border-b border-[rgba(255,255,255,0.05)] last:border-b-0">
								<button
									type="button"
									onClick={() => (o.id === activeId ? setOpen(false) : switchOrg(o.id))}
									className="fs-popover-row flex w-full items-center gap-10 px-12 py-10 text-left transition-colors">
									<span className="min-w-0 flex-1">
										<span className="block truncate text-14 font-medium">{o.name}</span>
										<span className="mt-2 block text-11 text-[#8c948b]">{t(`role_${o.role}`)}</span>
									</span>
									{o.id === activeId && <TbCheck size={16} className="shrink-0 text-[#c6ff4d]" />}
								</button>
							</li>
						))}
					</ul>
					{mode === "none" ? (
						<div className="border-t border-[rgba(255,255,255,0.07)]">
							<button
								type="button"
								onClick={() => { setName(""); setMode("new"); }}
								className="fs-popover-row flex w-full items-center gap-8 px-12 py-10 text-left text-13 font-medium text-[#c6ff4d] transition-colors">
								<TbPlus size={16} /> {t("newFirm")}
							</button>
							{canRename && (
								<button
									type="button"
									onClick={() => { setName(active?.name ?? ""); setMode("rename"); }}
									className="fs-popover-row flex w-full items-center px-12 py-10 text-left text-13 text-[#8c948b] transition-colors">
									{t("renameFirm")}
								</button>
							)}
						</div>
					) : (
						<form onSubmit={submit} className="flex items-center gap-8 border-t border-[rgba(255,255,255,0.07)] p-10">
							<input
								value={name}
								onChange={(e) => setName(e.target.value)}
								maxLength={80}
								autoFocus
								placeholder={t("firmName")}
								aria-label={t("firmName")}
								className="fs-field h-38 min-w-0 flex-1 px-10 text-14 outline-none"
							/>
							<button type="submit" className="fs-btn fs-btn-primary h-38 shrink-0 px-14 text-13">
								{mode === "new" ? t("create") : t("save")}
							</button>
						</form>
					)}
				</div>
			</Dropdown>
		</div>
	);
}
