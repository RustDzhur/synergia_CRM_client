"use client";
import React, { useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbPlus } from "react-icons/tb";
import { TEMPLATES } from "@/lib/office/templates";
import { useOfficeStore } from "@/store/useOfficeStore";
import Modal from "../shared/Modal";
import RobotAvatar from "./RobotAvatar";
import RobotForm from "./RobotForm";

// Каталог готовых роботов — тот же файл, что использует сервер (lib/office/templates.ts): список не может разойтись.
const CATALOG = TEMPLATES;

export default function HireDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
	const t = useTranslations("office");
	const { robots, hire, maxRobots } = useOfficeStore();
	const [custom, setCustom] = useState(false);
	const [busy, setBusy] = useState<string | null>(null);
	const full = robots.length >= maxRobots;

	async function hireTemplate(id: string) {
		setBusy(id);
		const r = await hire({ template: id });
		setBusy(null);
		if (r) { toast.success(t("hired", { name: r.name })); onClose(); }
	}
	const close = () => { setCustom(false); onClose(); };

	return (
		<Modal open={open} onClose={close} label={t("hireTitle")} align="top" className="w-full max-w-[860px]" flushOnMobile>
			<div className="fs-popover fs-scroll max-h-[92vh] overflow-y-auto p-18 md:p-24">
				<div className="mb-4 flex items-start justify-between gap-12">
					<div>
						<h2 className="text-18 font-semibold text-[#f1f4ee]">{custom ? t("customTitle") : t("hireTitle")}</h2>
						<p className="mt-4 text-13 text-[#8c948b]">{custom ? t("customHint") : t("hireHint")}</p>
					</div>
					<button type="button" onClick={close} className="shrink-0 text-13 text-[#8c948b] hover:text-[#f1f4ee]">{t("close")}</button>
				</div>

				{custom ? (
					<div className="mt-16">
						<RobotForm submitLabel={t("create")} onCancel={() => setCustom(false)} onSubmit={async (input) => { const r = await hire(input); if (r) { toast.success(t("hired", { name: r.name })); close(); } }} />
					</div>
				) : (
					<>
						<ul className="mt-16 grid grid-cols-1 gap-10 md:grid-cols-2">
							{CATALOG.map((c) => {
								const have = robots.filter((r) => r.template === c.id).length;
								return (
									<li key={c.id} className="fs-card flex gap-12 p-14">
										<RobotAvatar accent={c.accent} size={52} />
										<div className="min-w-0 flex-1">
											<p className="text-14 font-semibold text-[#f1f4ee]">{t(`tpl_${c.id}_title`)}</p>
											<p className="mt-2 text-12 text-[#8c948b]">{t(`tpl_${c.id}_desc`)}</p>
											<div className="mt-8 flex flex-wrap gap-4">{c.skills.map((s) => <span key={s} className="rounded-[10px] border border-inkLine px-8 py-[2px] text-10 text-[#8c948b]">{t(`skill_${s}`)}</span>)}</div>
											<div className="mt-10 flex items-center justify-between gap-8">
												<span className="text-11 text-[#8c948b]">{have > 0 ? t("alreadyHired", { n: have }) : ""}</span>
												<button type="button" disabled={full || busy !== null} onClick={() => void hireTemplate(c.id)} className="fs-btn fs-btn-ghost h-32 px-14 text-12 disabled:opacity-50">{busy === c.id ? "…" : t("hireNow")}</button>
											</div>
										</div>
									</li>
								);
							})}
						</ul>
						<button type="button" disabled={full} onClick={() => setCustom(true)} className="fs-card mt-10 flex w-full items-center justify-center gap-8 border-dashed p-14 text-13 font-medium text-[#cfd4cb] transition-colors hover:text-[#c6ff4d] disabled:opacity-50"><TbPlus size={16} aria-hidden />{t("customTitle")}</button>
					</>
				)}
			</div>
		</Modal>
	);
}
