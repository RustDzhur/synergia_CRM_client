"use client";
import React, { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbCopy, TbX } from "react-icons/tb";
import { useCallStore } from "@/app/store/useCallStore";
import { apiCall } from "@/app/store/crmApi";
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
		// часы работы: вне них виджет честно говорит «ответим утром» и предлагает оставить контакт
		{ key: "hoursFrom", label: "intfHoursFrom", optional: true, placeholder: "09:00" },
		{ key: "hoursTo", label: "intfHoursTo", optional: true, placeholder: "18:00" },
		{ key: "hoursDays", label: "intfHoursDays", optional: true, placeholder: "1-5" },
		// кнопка действия в окне: текст и ссылка — чтобы её не искали на странице
		{ key: "ctaLabel", label: "intfCtaLabel", optional: true, placeholder: "Start free" },
		{ key: "ctaUrl", label: "intfCtaUrl", optional: true, placeholder: "https://…" },
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
	const locale = useLocale(); // для возврата из окна Facebook на свою языковую версию страницы
	const { items, connect, patch, remove } = useIntegrationsStore();
	const [values, setValues] = useState<Record<string, string>>({});
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [confirm, setConfirm] = useState(false);
	const [testing, setTesting] = useState(false);
	// вход через Facebook: id и секрет приложения (не секрет и секрет соответственно), чтобы получить токены самим
	const [fbId, setFbId] = useState("");
	const [fbSecret, setFbSecret] = useState("");
	const [fbBusy, setFbBusy] = useState(false);
	// настроено ли на сайте приложение Meta: тогда ключи в окне не нужны вовсе
	const [siteApp, setSiteApp] = useState(false);
	// адрес сайта нужен для адреса возврата: Meta требует, чтобы он был разрешён в настройках приложения
	const [origin, setOrigin] = useState("");
	useEffect(() => { setOrigin(window.location.origin); }, []);
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
		if (type !== "messenger" && type !== "whatsapp") return;
		let alive = true;
		void apiCall<{ configured: boolean }>("/api/integrations/meta", "GET").then((r) => {
			if (alive && r.ok && r.data) setSiteApp(r.data.configured);
		});
		return () => { alive = false; };
	}, [type]);

	useEffect(() => {
		if (!type) return;
		setError("");
		const cfg = items.find((i) => i.type === type)?.config;
		setValues(type === "webchat" ? { title: cfg?.title ?? "", greeting: cfg?.greeting ?? "", color: cfg?.color ?? "#C6FF4D" } : {});
		setFbId("");
		setFbSecret("");
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
	// Messenger и WhatsApp подключаются входом через Facebook; ручные поля остаются запасным путём
	const isMeta = shown === "messenger" || shown === "whatsapp";
	const connectedNow = current?.status === "connected";
	const fbForm = isMeta && !connectedNow;
	// список страниц (или номеров), полученный на шаге возврата: config приходит с сервера как несекретные настройки
	const fbOptions = (isMeta && !connectedNow ? ((current?.config?.pages ?? current?.config?.numbers) as unknown as Array<{ id: string; name: string }>) : undefined) ?? [];

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
		// Пояс фирмы для часов работы виджета: берём из браузера того, кто настраивает, — сервер его не знает
		const withTz = (v: Record<string, string>) => (shown === "webchat" ? { ...v, tzOffset: String(-new Date().getTimezoneOffset()) } : v);
		const res = current && isWebchat ? await patch(current.id, withTz(values)) : await connect(shown, withTz(shown === "sip" ? { ...values, provider: preset ?? "custom" } : values));
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

	// Вход через Facebook: получаем адрес окна Meta и уходим в него. Токены страницы (или номера)
	// приедут на наш адрес возврата — человеку не нужно ничего копировать вручную.
	async function startFacebook() {
		if (fbBusy || !shown) return;
		setFbBusy(true);
		setError("");
		const route = shown === "messenger" ? "/api/messenger/oauth" : "/api/whatsapp/oauth";
		const res = await apiCall<{ url?: string }>(route, "POST", { appId: fbId.trim(), appSecret: fbSecret.trim(), locale });
		setFbBusy(false);
		if (!res.ok || !res.data?.url) return setError(res.message || t("intFailed"));
		window.location.href = res.data.url;
	}

	// Выбор страницы (или номера) после возврата: токен уже получен и лежит в секретах интеграции
	async function chooseFacebook(id: string) {
		if (!shown) return;
		setBusy(true);
		setError("");
		const res = await connect(shown, shown === "messenger" ? { pageId: id } : { numberId: id });
		setBusy(false);
		if (!res.ok) return setError(res.message);
		if (res.warning) toast(res.warning, { duration: 6000 });
		else toast.success(t("intConnectedToast", { name: title }));
		onClose();
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

						{/* Вход через Facebook: страницу (или номер) человек выбирает в окне Meta, а токены мы получаем
						    сами — копировать длинные строки не нужно. Ручной ввод остаётся ниже, для особых случаев. */}
						{fbForm && (
							<div className="flex flex-col gap-10 rounded-12 border border-inkLine bg-[rgba(255,255,255,0.02)] p-14">
								<span className="text-13 font-medium text-[#f1f4ee]">{t("intFbTitle")}</span>
								<p className="text-11 text-[#8c948b]">{siteApp ? t("intFbSiteApp") : t("intFbHint")}</p>
								{/* Приложение Meta настроено на сайте (те же переменные, что у рекламных кабинетов) —
								    ключи не спрашиваем, иначе их пришлось бы искать в кабинете Meta без нужды */}
								{!siteApp && <FormField label={t("intfAppId")} value={fbId} onChange={(e) => setFbId(e.target.value)} autoComplete="off" placeholder="1098409499579046" maxLength={40} />}
								{!siteApp && <FormField label={t("intfAppSecret")} value={fbSecret} onChange={(e) => setFbSecret(e.target.value)} type="password" autoComplete="off" maxLength={80} />}
								{/* Meta не пустит на наш адрес возврата, пока он не разрешён в настройках приложения —
								    показываем его готовым, чтобы не искать и не набирать вручную */}
								{origin && (
									<CopyField
										label={t("intFbRedirect")}
										value={`${origin}${shown === "messenger" ? "/api/messenger/oauth/callback" : "/api/whatsapp/oauth/callback"}`}
									/>
								)}
								<button type="button" disabled={fbBusy || (!siteApp && (!fbId.trim() || !fbSecret.trim()))} onClick={startFacebook} className="fs-btn fs-btn-primary h-40 self-start disabled:opacity-50">
									{fbBusy ? "…" : t("intFbConnect")}
								</button>
							</div>
						)}
						{/* Возврат из Facebook, когда страниц или номеров несколько: остаётся выбрать, что подключать */}
						{fbOptions.length > 0 && !connectedNow && (
							<div className="flex flex-col gap-6">
								<span className="text-12 text-[#8c948b]">{t("intFbChoose")}</span>
								{fbOptions.map((o) => (
									<button key={o.id} type="button" onClick={() => chooseFacebook(o.id)} className="fs-popover-row w-full rounded-8 px-10 py-8 text-left text-13">
										{o.name}
									</button>
								))}
							</div>
						)}

						{editable && !chooserOnly && fbForm && <p className="text-11 text-[#9AA396]">{t("intFbOrManual")}</p>}
						{editable && !chooserOnly &&
							fields.map((f) =>
								f.type === "color" ? (
									<label key={f.key} className="block">
										<span className="mb-6 block text-12 text-[#8c948b]">{t(f.label)}</span>
										<input type="color" value={values[f.key] ?? "#C6FF4D"} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} className="fs-field h-40 w-80 cursor-pointer p-4" />
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
