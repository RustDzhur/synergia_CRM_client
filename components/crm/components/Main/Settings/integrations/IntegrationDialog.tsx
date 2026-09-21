"use client";
import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdClose, MdContentCopy } from "react-icons/md";
import { useCallStore } from "@/app/store/useCallStore";
import { CALL_PROVIDERS, type CallProviderId } from "@/app/config/callProviders";
import { testSipRegistration } from "@/app/store/phone/sipEngine";
import { useIntegrationsStore } from "@/app/store/useIntegrationsStore";
import type { IntegrationType } from "@/app/types/integrations";
import ConfirmDialog from "../../shared/ConfirmDialog";
import FormField from "../../shared/FormField";
import Modal from "../../shared/Modal";
import ProviderLogo from "./ProviderLogo";

type Real = Exclude<IntegrationType, "mail">;
interface FieldDef { key: string; label: string; secret?: boolean; optional?: boolean; placeholder?: string; type?: "color" }

// Реквизиты каждого канала. Секретные поля после подключения не показываются — сервер хранит их зашифрованными.
const FIELDS: Record<Real, FieldDef[]> = {
	twilio: [
		{ key: "accountSid", label: "intfAccountSid", placeholder: "AC…" },
		{ key: "authToken", label: "intfAuthToken", secret: true },
		{ key: "phone", label: "intfPhone", placeholder: "+4915123456789" },
	],
	sip: [
		{ key: "server", label: "intfSipServer", placeholder: "wss://sip.example.com:7443" },
		{ key: "domain", label: "intfSipDomain", placeholder: "sip.example.com" },
		{ key: "username", label: "intfSipUser", placeholder: "1001" },
		{ key: "authUser", label: "intfSipAuthUser", optional: true },
		{ key: "password", label: "intfSipPassword", secret: true },
		{ key: "displayName", label: "intfSipName", optional: true, placeholder: "Firmspace CRM" },
	],
	telegram: [{ key: "botToken", label: "intfBotToken", secret: true, placeholder: "123456:ABC…" }],
	viber: [{ key: "authToken", label: "intfViberToken", secret: true }],
	messenger: [
		{ key: "pageAccessToken", label: "intfPageToken", secret: true },
		{ key: "appSecret", label: "intfAppSecret", secret: true },
	],
	webchat: [
		{ key: "title", label: "intfChatTitle", placeholder: "Chat with us" },
		{ key: "greeting", label: "intfGreeting", placeholder: "Hello! How can we help?" },
		{ key: "color", label: "intfColor", type: "color" },
	],
};

function CopyField({ label, value }: { label: string; value: string }) {
	const t = useTranslations("settings");
	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			toast.success(t("intCopied"));
		} catch {
			toast.error(t("intCopyFailed"));
		}
	}
	return (
		<div>
			<span className="mb-6 block text-16 text-[#999999]">{label}</span>
			<div className="flex items-stretch gap-8">
				<input readOnly value={value} onFocus={(e) => e.currentTarget.select()} aria-label={label} className="h-[40px] min-w-0 flex-1 rounded-8 border border-[#EFEFEF] bg-[#F3F3F3] px-10 text-14 text-[#666666] outline-none" />
				<button type="button" onClick={copy} aria-label={t("intCopy")} className="flex w-[40px] shrink-0 items-center justify-center rounded-8 border border-[#EFEFEF] text-[#666666] transition-colors hover:text-primaryColor">
					<MdContentCopy size={18} />
				</button>
			</div>
		</div>
	);
}

// «Call Provider» — провайдер звонков выбирается плитками с логотипами (app/config/callProviders.ts); одно SIP-подключение на пользователя
const sipBrand = (cfg?: Record<string, string>) => (cfg?.provider || "custom") as CallProviderId;

interface Props { type: Real | null; title: string; onClose: () => void; providerSwitch?: boolean }

// Окно подключения канала (Settings → Integration): форма реквизитов, а у подключённого канала — статус, адреса и «Отключить».
export default function IntegrationDialog({ type, title, onClose, providerSwitch }: Props) {
	const t = useTranslations("settings");
	const { items, connect, patch, remove } = useIntegrationsStore();
	const [values, setValues] = useState<Record<string, string>>({});
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [confirm, setConfirm] = useState(false);
	const [testing, setTesting] = useState(false);
	const [preset, setPreset] = useState<CallProviderId | null>(null); // выбранная плитка провайдера (только у Call Provider)
	// пока окно закрывается, type уже null — держим последний, чтобы содержимое не пропадало посреди анимации
	const [shown, setShown] = useState<Real | null>(type);
	useEffect(() => { if (type) setShown(type); }, [type]);

	const sipItem = items.find((i) => i.type === "sip");
	// SIP один на пользователя: подключённым считаем его только на плитке своего провайдера, на другой плитке подключение заменяется
	const current = !shown ? undefined : providerSwitch && shown === "sip" ? (sipItem && sipBrand(sipItem.config) === preset ? sipItem : undefined) : items.find((i) => i.type === shown);
	const replacing = providerSwitch && shown === "sip" && sipItem && !current ? sipItem : undefined;
	const presetValues = (id: CallProviderId): Record<string, string> => {
		const d = CALL_PROVIDERS.find((p) => p.id === id);
		return d?.type === "sip" ? { server: d.server ?? "", domain: d.domain ?? "" } : {};
	};

	useEffect(() => {
		if (!type) return;
		setError("");
		const cfg = items.find((i) => i.type === type)?.config;
		setValues(type === "webchat" ? { title: cfg?.title ?? "", greeting: cfg?.greeting ?? "", color: cfg?.color ?? "#5EA8F5" } : {});
		// у Call Provider открываем плитку уже подключённого провайдера, а если ничего нет — показываем выбор
		if (providerSwitch) setPreset(type === "sip" ? sipBrand(cfg) : items.some((i) => i.type === "twilio") ? "twilio" : null);
		else setPreset(null);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [type]);

	if (!shown) return null;
	function pickProvider(id: CallProviderId) {
		if (busy || id === preset) return;
		const def = CALL_PROVIDERS.find((p) => p.id === id)!;
		setShown(def.type);
		setPreset(id);
		setValues(presetValues(id));
		setError("");
	}
	const chooserOnly = !!providerSwitch && preset === null;
	const sipDef = CALL_PROVIDERS.find((p) => p.id === preset);
	const tileConnected = (id: CallProviderId) =>
		id === "twilio" ? items.some((i) => i.type === "twilio" && i.status === "connected") : !!sipItem && sipItem.status === "connected" && sipBrand(sipItem.config) === id;
	const fields = FIELDS[shown];
	const isWebchat = shown === "webchat";
	const editable = isWebchat || !current;

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (busy || !shown) return;
		setBusy(true);
		setError("");
		// SIP: пароль проверяет браузер — регистрируется у провайдера и только при успехе реквизиты сохраняются
		if (shown === "sip" && !current) {
			setTesting(true);
			const test = await testSipRegistration({
				server: (values.server ?? "").trim(),
				domain: (values.domain ?? "").trim().replace(/^sips?:/i, ""),
				username: (values.username ?? "").trim(),
				authUser: (values.authUser ?? "").trim(),
				displayName: (values.displayName ?? "").trim(),
				password: values.password ?? "",
			});
			setTesting(false);
			if (!test.ok) { setBusy(false); return setError(test.message); }
		}
		const res = current && isWebchat ? await patch(current.id, values) : await connect(shown, shown === "sip" ? { ...values, provider: preset ?? "custom" } : values);
		setBusy(false);
		if (!res.ok) return setError(res.message);
		if (shown === "twilio" || shown === "sip") { // реквизиты новые — переподключаем софтфон
			useCallStore.getState().destroy();
			useCallStore.getState().init();
		}
		if (res.warning) toast(res.warning, { duration: 6000 });
		else toast.success(current ? t("intSaved") : t("intConnectedToast", { name: title }));
		if (!isWebchat) setValues({});
	}

	async function retryWebhook() {
		if (!current) return;
		setBusy(true);
		const res = await patch(current.id, { action: "webhook" });
		setBusy(false);
		if (!res.ok) toast.error(res.message);
		else if (res.warning) toast(res.warning, { duration: 6000 });
		else toast.success(t("intWebhookOk"));
	}

	async function disconnect() {
		if (!current) return;
		setConfirm(false);
		setBusy(true);
		const ok = await remove(current.id);
		setBusy(false);
		if (ok) {
			if (shown === "twilio" || shown === "sip") { // остался другой провайдер — звонилка переключится на него
				useCallStore.getState().destroy();
				useCallStore.getState().init();
			}
			toast(t("intDisconnectedToast", { name: title }));
			onClose();
		} else toast.error(t("intFailed"));
	}

	// адрес встраиваемого скрипта собирается из адреса вебхука: origin сайта + токен
	let snippet = "";
	if (isWebchat && current) {
		const u = new URL(current.webhookUrl);
		snippet = `<script src="${u.origin}/widget.js" data-token="${u.pathname.split("/").pop()}" async></script>`;
	}

	const buttonBase = "h-[44px] rounded-8 px-24 text-16 font-medium transition-opacity disabled:opacity-50";

	return (
		<>
			<Modal open={type !== null} onClose={onClose} label={title} className="w-full max-w-[520px]">
				<div className="max-h-[calc(100vh-32px)] overflow-y-auto rounded-16 bg-white shadow-heroImage">
					<div className="flex items-center justify-between bg-primaryColor px-20 py-12">
						<h2 className="text-20 font-medium text-white">{title}</h2>
						<button type="button" onClick={onClose} aria-label={t("intClose")} className="text-white transition-opacity hover:opacity-80">
							<MdClose size={22} />
						</button>
					</div>

					<form onSubmit={submit} className="flex flex-col gap-16 p-20 md:p-24">
						{providerSwitch && (
							<ul className="grid grid-cols-2 gap-10 sm:grid-cols-3" aria-label={t("intProviders")}>
								{CALL_PROVIDERS.map((p) => (
									<li key={p.id}>
										<button
											type="button"
											onClick={() => pickProvider(p.id)}
											aria-pressed={preset === p.id}
											className={`relative flex h-[92px] w-full flex-col items-center justify-center gap-6 rounded-10 border-2 px-6 text-center text-14 font-medium transition-colors ${preset === p.id ? "border-[#5EA8F5] bg-[#EEF5FF] text-primaryColor" : "border-[#EFEFEF] bg-white text-[#666666] hover:border-[#CFE3FA]"}`}>
											<ProviderLogo id={p.id} size={34} />
											<span className="leading-[1.15]">{p.id === "custom" ? t("provCustom") : p.name}</span>
											{tileConnected(p.id) && <span className="absolute right-6 top-6 h-[10px] w-[10px] rounded-[50%] bg-[#009A2B]" title={t("intStatusShort")} />}
										</button>
									</li>
								))}
							</ul>
						)}
						{chooserOnly && <p className="text-14 text-[#666666]">{t("intChooseProvider")}</p>}
						{!chooserOnly && <p className="text-14 text-[#666666]">{providerSwitch && shown === "sip" && preset && preset !== "custom" ? t(`provHelp_${preset}`) : t(`intHelp_${shown}`)}</p>}
						{replacing && <p className="rounded-8 bg-[#FFF6EA] p-12 text-14 text-[#8A5A1F]">{t("intSipReplaces", { name: replacing.name })}</p>}

						{current && (
							<p className={`text-16 font-medium ${current.status === "connected" ? "text-[#009A2B]" : "text-[#D9822B]"}`}>
								{current.status === "connected" ? t("intStatusOn", { name: current.name }) : t("intStatusWarn", { name: current.name })}
							</p>
						)}
						{current?.type === "telegram" && current.config.polling === "1" && <p className="text-14 text-[#666666]">{t("intPollingInfo")}</p>}
						{current?.status === "error" && current.error && <p className="rounded-8 bg-[#FFF6EA] p-12 text-14 text-[#8A5A1F]">{current.error.startsWith("Webhooks need a public https address") ? t("intErrNeedHttps") : current.error}</p>}

						{editable && !chooserOnly &&
							fields.map((f) =>
								f.type === "color" ? (
									<label key={f.key} className="block">
										<span className="mb-6 block text-16 text-[#999999]">{t(f.label)}</span>
										<input type="color" value={values[f.key] ?? "#5EA8F5"} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} className="h-[40px] w-[80px] cursor-pointer rounded-8 border border-[#EFEFEF] bg-[#FAFAFA] p-4" />
									</label>
								) : (
									<FormField
										key={f.key}
										label={t(f.label)}
										value={values[f.key] ?? ""}
										onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
										type={f.secret ? "password" : "text"}
										autoComplete="off"
										placeholder={shown === "sip" && f.key === "server" ? sipDef?.serverPlaceholder ?? f.placeholder : shown === "sip" && f.key === "domain" ? sipDef?.domainPlaceholder ?? f.placeholder : f.placeholder}
										maxLength={500}
										required={!isWebchat && !f.optional}
									/>
								)
							)}

						{current && shown === "messenger" && (
							<>
								<CopyField label={t("intCallbackUrl")} value={current.webhookUrl} />
								<CopyField label={t("intVerifyToken")} value={current.config.verifyToken ?? ""} />
							</>
						)}
						{current && shown === "twilio" && <p className="text-14 text-[#666666]">{t("intTwilioAuto")}</p>}
						{current && shown === "sip" && <p className="text-14 text-[#666666]">{t("intSipConnected")}</p>}
						{current && isWebchat && (
							<div>
								<CopyField label={t("intEmbedCode")} value={snippet} />
								<p className="mt-6 text-12 text-[#999999]">{t("intEmbedHelp")}</p>
							</div>
						)}

						{error && <p role="alert" className="text-14 text-danger">{error}</p>}

						<div className="mt-8 flex flex-wrap items-center justify-end gap-12">
							{current && (
								<button type="button" disabled={busy} onClick={() => setConfirm(true)} className={`${buttonBase} mr-auto border border-[#E6E6E6] text-danger hover:bg-gray`}>
									{t("intDisconnect")}
								</button>
							)}
							{current?.status === "error" && (shown === "telegram" || shown === "viber") && (
								<button type="button" disabled={busy} onClick={retryWebhook} className={`${buttonBase} border border-[#E6E6E6] text-[#666666] hover:bg-gray`}>
									{t("intRegisterWebhook")}
								</button>
							)}
							{editable && !chooserOnly && (
								<button type="submit" disabled={busy} className={`${buttonBase} bg-primaryColor text-white shadow-custom hover:opacity-80`}>
									{testing ? t("intSipTesting") : busy ? "…" : isWebchat && current ? t("intSave") : t("intConnect")}
								</button>
							)}
						</div>
					</form>
				</div>
			</Modal>
			<ConfirmDialog open={confirm} title={t("intDisconnect")} text={t("intDisconnectText", { name: title })} confirmLabel={t("intDisconnect")} onCancel={() => setConfirm(false)} onConfirm={disconnect} />
		</>
	);
}
