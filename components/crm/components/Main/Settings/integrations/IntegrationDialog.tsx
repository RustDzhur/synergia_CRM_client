"use client";
import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbCopy, TbX } from "react-icons/tb";
import { useCallStore } from "@/app/store/useCallStore";
import { CALL_PROVIDERS, type CallProviderId } from "@/app/config/callProviders";
import { SMS_PROVIDERS } from "@/app/config/smsProviders";
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
	// Остальные СМС-провайдеры: у каждого свои реквизиты и свой отправщик (lib/channels/vonage.ts и соседние)
	vonage: [
		{ key: "apiKey", label: "intfVonageKey" },
		{ key: "apiSecret", label: "intfVonageSecret", secret: true },
		{ key: "phone", label: "intfSender", placeholder: "Firmspace" },
	],
	plivo: [
		{ key: "authId", label: "intfPlivoId", placeholder: "MA…" },
		{ key: "authToken", label: "intfPlivoToken", secret: true },
		{ key: "phone", label: "intfPhone", placeholder: "+4915123456789" },
	],
	telnyx: [
		{ key: "apiKey", label: "intfTelnyxKey", secret: true, placeholder: "KEY…" },
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
	whatsapp: [
		{ key: "phoneNumberId", label: "intfWaPhoneId", placeholder: "123456789012345" },
		{ key: "accessToken", label: "intfWaToken", secret: true },
		{ key: "appSecret", label: "intfAppSecret", secret: true },
		{ key: "wabaId", label: "intfWaWabaId", optional: true, placeholder: "123456789012345" },
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
			<span className="mb-6 block text-12 text-[#8c948b]">{label}</span>
			<div className="flex items-stretch gap-8">
				<input readOnly value={value} onFocus={(e) => e.currentTarget.select()} aria-label={label} className="fs-field h-40 min-w-0 flex-1 px-12 text-13 outline-none" />
				<button type="button" onClick={copy} aria-label={t("intCopy")} className="flex w-40 shrink-0 items-center justify-center rounded-10 border border-inkLine text-[#8c948b] transition-colors hover:border-[rgba(198,255,77,0.35)] hover:text-[#c6ff4d]">
					<TbCopy size={17} />
				</button>
			</div>
		</div>
	);
}

// «Call Provider» — провайдер звонков выбирается плитками с логотипами (app/config/callProviders.ts); одно SIP-подключение на пользователя
const sipBrand = (cfg?: Record<string, string>) => (cfg?.provider || "custom") as CallProviderId;

// Провайдер выбирается плитками: у звонков это способ подключения (Twilio или SIP), у СМС — конкретный сервис.
// Обе карточки устроены одинаково, отличается только каталог плиток.
interface Props { type: Real | null; title: string; onClose: () => void; providerKind?: "call" | "sms" }

// Окно подключения канала (Settings → Integration): форма реквизитов, а у подключённого канала — статус, адреса и «Отключить».
export default function IntegrationDialog({ type, title, onClose, providerKind }: Props) {
	const t = useTranslations("settings");
	const { items, connect, patch, remove } = useIntegrationsStore();
	const [values, setValues] = useState<Record<string, string>>({});
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [confirm, setConfirm] = useState(false);
	const [testing, setTesting] = useState(false);
	const [preset, setPreset] = useState<string | null>(null); // выбранная плитка провайдера (звонки и СМС)
	// пока окно закрывается, type уже null — держим последний, чтобы содержимое не пропадало посреди анимации
	const [shown, setShown] = useState<Real | null>(type);
	useEffect(() => { if (type) setShown(type); }, [type]);

	const providerSwitch = !!providerKind;
	// плитки: у звонков — каталог звонков, у СМС — каталог СМС
	const catalog: Array<{ id: string; name: string; type: string; server?: string; domain?: string; serverPlaceholder?: string; domainPlaceholder?: string }> =
		providerKind === "sms" ? SMS_PROVIDERS : CALL_PROVIDERS;

	const sipItem = items.find((i) => i.type === "sip");
	// SIP один на пользователя: подключённым считаем его только на плитке своего провайдера, на другой плитке подключение заменяется
	const current = !shown ? undefined : providerSwitch && shown === "sip" ? (sipItem && sipBrand(sipItem.config) === preset ? sipItem : undefined) : items.find((i) => i.type === shown);
	const replacing = providerKind === "call" && shown === "sip" && sipItem && !current ? sipItem : undefined;
	const presetValues = (id: string): Record<string, string> => {
		const d = catalog.find((p) => p.id === id);
		return d?.type === "sip" ? { server: d.server ?? "", domain: d.domain ?? "" } : {};
	};

	useEffect(() => {
		if (!type) return;
		setError("");
		const cfg = items.find((i) => i.type === type)?.config;
		setValues(type === "webchat" ? { title: cfg?.title ?? "", greeting: cfg?.greeting ?? "", color: cfg?.color ?? "#5EA8F5" } : {});
		// открываем плитку уже подключённого провайдера, а если ничего нет — показываем выбор
		if (providerKind === "sms") setPreset(SMS_PROVIDERS.find((p) => items.some((i) => i.type === p.type && i.status === "connected"))?.id ?? null);
		else if (providerKind === "call") setPreset(type === "sip" ? sipBrand(cfg) : items.some((i) => i.type === "twilio") ? "twilio" : null);
		else setPreset(null);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [type]);

	if (!shown) return null;
	function pickProvider(id: string) {
		if (busy || id === preset) return;
		const def = catalog.find((p) => p.id === id)!;
		setShown(def.type as Real);
		setPreset(id);
		setValues(presetValues(id));
		setError("");
	}
	const chooserOnly = providerSwitch && preset === null;
	const sipDef = providerKind === "call" ? CALL_PROVIDERS.find((p) => p.id === preset) : undefined;
	const tileConnected = (id: string) => {
		// у СМС каждый провайдер — своё подключение, поэтому плитка зелёная, если подключён её тип
		if (providerKind === "sms") return items.some((i) => i.type === catalog.find((p) => p.id === id)?.type && i.status === "connected");
		return id === "twilio" ? items.some((i) => i.type === "twilio" && i.status === "connected") : !!sipItem && sipItem.status === "connected" && sipBrand(sipItem.config) === id;
	};
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

	const buttonBase = "fs-btn h-40 disabled:opacity-50";

	return (
		<>
			<Modal open={type !== null} onClose={onClose} label={title} className="w-full max-w-[520px]">
				<div className="fs-popover fs-scroll max-h-[calc(100vh-32px)] overflow-y-auto">
					<div className="flex items-center justify-between border-b border-inkLine bg-[rgba(198,255,77,0.06)] px-20 py-12">
						<h2 className="text-15 font-semibold text-[#f1f4ee]">{title}</h2>
						<button type="button" onClick={onClose} aria-label={t("intClose")} className="text-[#8c948b] transition-colors hover:text-[#f1f4ee]">
							<TbX size={18} />
						</button>
					</div>

					<form onSubmit={submit} className="flex flex-col gap-14 p-20">
						{providerSwitch && (
							<ul className="grid grid-cols-2 gap-10 sm:grid-cols-3" aria-label={t("intProviders")}>
								{catalog.map((p) => (
									<li key={p.id}>
										<button
											type="button"
											onClick={() => pickProvider(p.id)}
											aria-pressed={preset === p.id}
											className={`relative flex h-80 w-full flex-col items-center justify-center gap-6 rounded-12 border px-6 text-center text-12 font-medium transition-colors ${preset === p.id ? "border-[#c6ff4d] bg-[rgba(198,255,77,0.08)] text-[#c6ff4d]" : "border-inkLine bg-transparent text-[#8c948b] hover:border-[rgba(255,255,255,0.20)]"}`}>
											<ProviderLogo id={p.id} size={30} />
											<span className="leading-[1.15]">{p.id === "custom" ? t("provCustom") : p.name}</span>
											{tileConnected(p.id) && <span className="absolute right-6 top-6 h-8 w-8 rounded-50 bg-[#2DDEB6]" title={t("intStatusShort")} />}
										</button>
									</li>
								))}
							</ul>
						)}
						{chooserOnly && <p className="text-12 text-[#8c948b]">{providerKind === "sms" ? t("intChooseProviderSms") : t("intChooseProvider")}</p>}
						{!chooserOnly && <p className="text-12 text-[#8c948b]">{providerKind === "call" && shown === "sip" && preset && preset !== "custom" ? t(`provHelp_${preset}`) : t(`intHelp_${shown}`)}</p>}
						{/* Входящие СМС принимает только Twilio: у остальных своя подпись вебхука, а без её проверки
						    в беседу мог бы написать кто угодно. Об этом честно сказано у каждой такой плитки */}
						{providerKind === "sms" && shown !== "twilio" && !chooserOnly && <p className="text-11 text-[#9AA396]">{t("intSmsInboundNote")}</p>}
						{replacing && <p className="rounded-10 bg-[rgba(244,161,0,0.10)] p-12 text-12 text-[#F4A100]">{t("intSipReplaces", { name: replacing.name })}</p>}

						{current && (
							<p className={`text-13 font-medium ${current.status === "connected" ? "text-[#2DDEB6]" : "text-[#F4A100]"}`}>
								{current.status === "connected" ? t("intStatusOn", { name: current.name }) : t("intStatusWarn", { name: current.name })}
							</p>
						)}
						{current?.type === "telegram" && current.config.polling === "1" && <p className="text-12 text-[#8c948b]">{t("intPollingInfo")}</p>}
						{current?.status === "error" && current.error && <p className="rounded-10 bg-[rgba(244,161,0,0.10)] p-12 text-12 text-[#F4A100]">{current.error.startsWith("Webhooks need a public https address") ? t("intErrNeedHttps") : current.error}</p>}

						{editable && !chooserOnly &&
							fields.map((f) =>
								f.type === "color" ? (
									<label key={f.key} className="block">
										<span className="mb-6 block text-12 text-[#8c948b]">{t(f.label)}</span>
										<input type="color" value={values[f.key] ?? "#5EA8F5"} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} className="fs-field h-40 w-80 cursor-pointer p-4" />
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
						{/* WhatsApp адрес у Meta задаётся вручную: подставляем оба значения, которые нужно вписать в кабинете */}
						{current && shown === "whatsapp" && (
							<>
								<CopyField label={t("intCallbackUrl")} value={current.webhookUrl} />
								<CopyField label={t("intVerifyToken")} value={current.config.verifyToken ?? ""} />
								<p className="text-11 text-[#8c948b]">{t("intWaWebhookHelp")}</p>
							</>
						)}
						{current && shown === "twilio" && <p className="text-12 text-[#8c948b]">{t("intTwilioAuto")}</p>}
						{current && shown === "sip" && <p className="text-12 text-[#8c948b]">{t("intSipConnected")}</p>}
						{current && isWebchat && (
							<div>
								<CopyField label={t("intEmbedCode")} value={snippet} />
								<p className="mt-6 text-11 text-[#8c948b]">{t("intEmbedHelp")}</p>
							</div>
						)}

						{error && <p role="alert" className="text-13 text-danger">{error}</p>}

						<div className="mt-8 flex flex-wrap items-center justify-end gap-12">
							{current && (
								<button type="button" disabled={busy} onClick={() => setConfirm(true)} className={`${buttonBase} fs-btn-ghost mr-auto text-danger hover:border-[rgba(235,87,87,0.4)] hover:bg-[rgba(235,87,87,0.08)]`}>
									{t("intDisconnect")}
								</button>
							)}
							{current?.status === "error" && (shown === "telegram" || shown === "viber") && (
								<button type="button" disabled={busy} onClick={retryWebhook} className={`${buttonBase} fs-btn-ghost`}>
									{t("intRegisterWebhook")}
								</button>
							)}
							{editable && !chooserOnly && (
								<button type="submit" disabled={busy} className={`${buttonBase} fs-btn-primary`}>
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
