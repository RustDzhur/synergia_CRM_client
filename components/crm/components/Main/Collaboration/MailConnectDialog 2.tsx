"use client";
import React, { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MdClose } from "react-icons/md";
import { apiCall } from "@/app/store/crmApi";
import type { MailAccountDTO, MailProviderId } from "@/app/types/integrations";
import FormField from "../shared/FormField";
import Modal from "../shared/Modal";

interface Props {
	provider: MailProviderId | null;
	oauth: { google: boolean; microsoft: boolean };
	onClose: () => void;
	onConnected: (account: MailAccountDTO) => void;
}

// Где пользователь создаёт пароль приложения
const APP_PASSWORD_URL: Partial<Record<MailProviderId, string>> = {
	gmail: "https://myaccount.google.com/apppasswords",
	yahoo: "https://login.yahoo.com/account/security",
	icloud: "https://appleid.apple.com/account/manage",
};

const LABEL: Record<MailProviderId, string> = { gmail: "Google Mail", outlook: "Outlook", yahoo: "Yahoo", icloud: "iCloud", office365: "Office 365", imap: "IMAP" };

// Окно подключения почтового ящика. Gmail и Outlook/Office 365 — по кнопке «Войти через …» (если на сервере заданы ключи OAuth)
// или по паролю приложения; Yahoo, iCloud и свой IMAP — по паролю приложения. Пароль уходит на сервер и хранится зашифрованным.
export default function MailConnectDialog({ provider, oauth, onClose, onConnected }: Props) {
	const t = useTranslations("collab");
	const locale = useLocale();
	const [values, setValues] = useState<Record<string, string>>({ imapPort: "993", smtpPort: "465" });
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [shown, setShown] = useState<MailProviderId | null>(provider);
	if (provider && provider !== shown) {
		setShown(provider);
		setError("");
		setShowPassword(false);
	}
	if (!shown) return null;

	const vendor = shown === "gmail" ? "google" : shown === "outlook" || shown === "office365" ? "microsoft" : null;
	const canOAuth = vendor ? oauth[vendor] : false;
	const showForm = !canOAuth || showPassword;
	const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setValues({ ...values, [k]: e.target.value });

	async function oauthSignIn() {
		if (!vendor) return;
		setBusy(true);
		setError("");
		const res = await apiCall<{ url: string }>(`/api/mail/oauth/${vendor}`, "POST", { locale });
		if (!res.ok || !res.data) {
			setBusy(false);
			return setError(res.message);
		}
		window.location.href = res.data.url; // провайдер вернёт пользователя на /api/mail/oauth/callback, а оттуда — обратно в Web Mails
	}

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (busy || !shown) return;
		setBusy(true);
		setError("");
		const res = await apiCall<MailAccountDTO>("/api/mail/accounts", "POST", { provider: shown, ...values });
		setBusy(false);
		if (!res.ok || !res.data) return setError(res.message);
		onConnected(res.data);
	}

	const primary = "h-[44px] rounded-8 bg-primaryColor px-24 text-16 font-medium text-white shadow-custom transition-opacity hover:opacity-80 disabled:opacity-50";
	return (
		<Modal open={provider !== null} onClose={onClose} label={LABEL[shown]} className="w-full max-w-[520px]">
			<div className="max-h-[calc(100vh-32px)] overflow-y-auto rounded-16 bg-white shadow-heroImage">
				<div className="flex items-center justify-between bg-primaryColor px-20 py-12">
					<h2 className="text-20 font-medium text-white">{LABEL[shown]}</h2>
					<button type="button" onClick={onClose} aria-label={t("close")} className="text-white transition-opacity hover:opacity-80"><MdClose size={22} /></button>
				</div>
				<div className="flex flex-col gap-16 p-20 md:p-24">
					<p className="text-14 text-[#666666]">{t(`mailHelp_${shown}`)}</p>
					{APP_PASSWORD_URL[shown] && (
						<a href={APP_PASSWORD_URL[shown]} target="_blank" rel="noopener noreferrer" className="-mt-8 text-14 text-primaryColor underline transition-opacity hover:opacity-80">
							{t("mailCreateAppPassword")}
						</a>
					)}

					{canOAuth && (
						<>
							<button type="button" disabled={busy} onClick={oauthSignIn} className={primary}>
								{vendor === "google" ? t("mailSignInGoogle") : t("mailSignInMicrosoft")}
							</button>
							{!showPassword && (
								<button type="button" onClick={() => setShowPassword(true)} className="text-center text-14 text-primaryColor transition-opacity hover:opacity-80">
									{t("mailUsePassword")}
								</button>
							)}
						</>
					)}

					{showForm && (
						<form onSubmit={submit} className="flex flex-col gap-16">
							<FormField label={t("mailEmail")} type="email" value={values.email ?? ""} onChange={set("email")} autoComplete="off" maxLength={200} required />
							<FormField label={t("mailAppPassword")} type="password" value={values.password ?? ""} onChange={set("password")} autoComplete="new-password" maxLength={200} required />
							{shown === "imap" && (
								<div className="grid grid-cols-[1fr_90px] gap-12">
									<FormField label={t("mailImapHost")} value={values.imapHost ?? ""} onChange={set("imapHost")} placeholder="imap.example.com" maxLength={253} required />
									<FormField label={t("mailPort")} value={values.imapPort} onChange={set("imapPort")} inputMode="numeric" maxLength={5} required />
									<FormField label={t("mailSmtpHost")} value={values.smtpHost ?? ""} onChange={set("smtpHost")} placeholder="smtp.example.com" maxLength={253} required />
									<FormField label={t("mailPort")} value={values.smtpPort} onChange={set("smtpPort")} inputMode="numeric" maxLength={5} required />
								</div>
							)}
							<div className="flex justify-end">
								<button type="submit" disabled={busy} className={primary}>{busy ? "…" : t("mailConnect")}</button>
							</div>
						</form>
					)}
					{error && <p role="alert" className="text-14 text-danger">{error}</p>}
				</div>
			</div>
		</Modal>
	);
}
