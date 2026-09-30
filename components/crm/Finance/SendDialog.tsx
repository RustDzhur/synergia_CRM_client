"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import Modal from "../shared/Modal";
import FormField from "../shared/FormField";
import { apiCall } from "@/store/crmApi";
import { explainCompliance } from "@/lib/finance/complianceLabels";
import type { SendOutcome } from "@/store/useFinanceStore";

// Окно отправки финансового документа клиенту (КП, счёт): адресат и ЯЩИК ОТПРАВКИ.
// Раньше ящик выбирался сервером молча — первый подключённый в Web Mails, — и письмо могло уйти
// с личного адреса, хотя у фирмы подключён свой. Теперь видно, с какого адреса уйдёт письмо,
// и его можно выбрать; выбор запоминается для следующих отправок.

export interface MailAccountOption { id: string; email: string; name?: string; status: string; canSend?: boolean }

const ACCOUNT_KEY = "finance.sendAccount";

export default function SendDialog({ open, onClose, onSubmit }: {
	open: boolean;
	onClose: () => void;
	onSubmit: (opts: { to: string; accountId: string }) => Promise<SendOutcome>;
}) {
	const t = useTranslations("finance");
	const locale = useLocale();
	const [accounts, setAccounts] = useState<MailAccountOption[] | null>(null);
	const [accountId, setAccountId] = useState("");
	const [to, setTo] = useState("");
	const [busy, setBusy] = useState(false);
	const [notice, setNotice] = useState("");

	useEffect(() => {
		if (!open) return;
		setNotice("");
		setTo("");
		void apiCall<{ accounts: MailAccountOption[] }>("/api/mail/accounts").then((r) => {
			const list = r.ok && r.data ? r.data.accounts : [];
			setAccounts(list);
			let saved = "";
			try { saved = localStorage.getItem(ACCOUNT_KEY) ?? ""; } catch { /* приватный режим */ }
			// Предпочитаем рабочий ящик: подключённый и с правом отправки (согласие Google/Microsoft
			// можно дать только на чтение — такой ящик при отправке откажет провайдер)
			const usable = (a: MailAccountOption) => a.status === "connected" && a.canSend !== false;
			const preferred = list.find((a) => a.id === saved && usable(a)) ?? list.find(usable) ?? list.find((a) => a.status === "connected") ?? list[0];
			setAccountId(preferred?.id ?? "");
		});
	}, [open]);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (busy) return;
		setBusy(true);
		setNotice("");
		const outcome = await onSubmit({ to: to.trim(), accountId });
		setBusy(false);
		if (outcome.ok) {
			toast.success(t("sentTo", { email: outcome.sentTo }));
			onClose();
			return;
		}
		// Отказ чек-листа реквизитов покажет вызывающий экран (explainCompliance) — здесь только
		// «нет адреса» и «нет ящика», которые лечатся прямо в этом окне
		if (outcome.code === "no_recipient") return void setNotice(t("sendNeedEmail"));
		if (outcome.code === "no_mailbox") return void setNotice(t("sendNoMailbox"));
		// Отказ чек-листа реквизитов — словами с подсказкой, где заполнить (иначе «seller_ua_id»)
		if (outcome.code === "compliance" && outcome.missing.length) return void setNotice(explainCompliance(outcome.missing, locale));
		setNotice(outcome.message);
	}

	const current = accounts?.find((a) => a.id === accountId) ?? null;

	return (
		<Modal open={open} onClose={onClose} label={t("sendTitle")} className="w-full max-w-[520px]">
			<form onSubmit={submit} className="fs-popover p-20 md:p-24">
				<h2 className="mb-8 text-16 font-semibold text-[#f1f4ee]">{t("sendTitle")}</h2>
				{/** Подсказка объясняет обе возможности: адрес можно ввести, а можно оставить пустым */}
				<p className="mb-16 text-12 leading-[1.6] text-[#8c948b]">{t("sendHint")}</p>
				<div className="flex flex-col gap-12">
					<FormField label={t("email")} type="email" value={to} onChange={(e) => setTo(e.target.value)} maxLength={200} autoFocus placeholder={t("sendToPlaceholder")} />
					{accounts === null ? (
						<p className="text-12 text-[#8c948b]">{t("loading")}</p>
					) : accounts.length === 0 ? (
						<p className="text-12 text-[#F4A100]">{t("sendNoMailbox")}</p>
					) : (
						<label className="block">
							<span className="mb-6 block text-12 text-[#8c948b]">{t("sendFrom")}</span>
							<select value={accountId} onChange={(e) => { setAccountId(e.target.value); try { localStorage.setItem(ACCOUNT_KEY, e.target.value); } catch { /* приватный режим */ } }} className="fs-field h-40 w-full px-12 text-13 outline-none">
								{accounts.map((a) => <option key={a.id} value={a.id}>{a.email || a.name}{a.status !== "connected" || a.canSend === false ? ` · ${t("sendAccountError")}` : ""}</option>)}
							</select>
							{current && <span className="mt-[4px] block text-11 text-[#9AA396]">{t("sendFromHint", { email: current.email || current.name })}</span>}
						</label>
					)}
				</div>
				{notice && <p className="mt-12 text-12 leading-[1.5] text-[#F4A100]">{notice}</p>}
				<div className="mt-20 flex justify-end gap-10">
					<button type="button" onClick={onClose} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
					<button type="submit" disabled={busy || !accounts?.length} className="fs-btn fs-btn-primary h-40 disabled:opacity-60">{t("send")}</button>
				</div>
			</form>
		</Modal>
	);
}
