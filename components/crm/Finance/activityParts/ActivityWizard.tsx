"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import Modal from "../../shared/Modal";
import { useOrgStore } from "@/store/useOrgStore";
import { ACTIVITIES } from "@/config/firmActivities";

// Мастер «Чем занимается фирма?» (ТЗ §18): отмеченные виды деятельности оставляют в финансовом
// разделе только нужные вкладки — «лишнее скрыто». Мастер показывается один раз (по фирме), его
// можно пропустить: тогда показываются все разделы, как раньше.


export default function ActivityWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
	const t = useTranslations("finance");
	const { activeId, saveActivities } = useOrgStore();
	const [picked, setPicked] = useState<string[]>([]);
	const [busy, setBusy] = useState(false);

	async function save() {
		setBusy(true);
		const err = await saveActivities(picked);
		setBusy(false);
		if (!err.ok) return void toast.error(err.message);
		toast.success(t("actSaved"));
		onClose();
	}

	function skip() {
		try { localStorage.setItem(`crm.activityWizardSkipped.${activeId}`, "1"); } catch { /* приватный режим */ }
		onClose();
	}

	return (
		<Modal open={open} onClose={skip} label={t("actTitle")} className="w-full max-w-[520px]">
			<div className="fs-popover flex flex-col gap-12 p-20">
				<h2 className="text-15 font-semibold text-[#f1f4ee]">{t("actTitle")}</h2>
				<p className="text-12 leading-[1.6] text-[#8c948b]">{t("actHint")}</p>
				<div className="flex flex-col gap-8">
					{ACTIVITIES.map((a) => (
						<label key={a} className="flex items-center gap-10 text-13 text-[#cfd4cb]">
							<input
								type="checkbox"
								checked={picked.includes(a)}
								onChange={(e) => setPicked(e.target.checked ? [...picked, a] : picked.filter((x) => x !== a))}
								className="h-16 w-16 accent-[#c6ff4d]"
							/>
							<span>{t(`act_${a}`)}<span className="ml-8 text-11 text-[#8c948b]">{t(`actHint_${a}`)}</span></span>
						</label>
					))}
				</div>
				<div className="mt-4 flex justify-end gap-10">
					<button type="button" onClick={skip} className="fs-btn fs-btn-ghost h-38">{t("actSkip")}</button>
					<button type="button" disabled={busy || !picked.length} onClick={() => void save()} className="fs-btn fs-btn-primary h-38 disabled:opacity-50">{t("actSave")}</button>
				</div>
			</div>
		</Modal>
	);
}
