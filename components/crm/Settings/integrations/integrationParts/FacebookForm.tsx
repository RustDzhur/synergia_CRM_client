"use client";
import { useTranslations } from "next-intl";
import FormField from "../../../shared/FormField";
import CopyField from "./CopyField";

interface Props {
	channel: "messenger" | "whatsapp";
	siteApp: boolean;
	origin: string;
	appId: string;
	appSecret: string;
	onAppId: (value: string) => void;
	onAppSecret: (value: string) => void;
	busy: boolean;
	onStart: () => void;
}

// Вход через Facebook: страницу (или номер) человек выбирает в окне Meta, а токены мы получаем
// сами — копировать длинные строки не нужно. Ручной ввод остаётся ниже, для особых случаев.
export default function FacebookForm({ channel, siteApp, origin, appId, appSecret, onAppId, onAppSecret, busy, onStart }: Props) {
	const t = useTranslations("settings");
	return (
		<div className="flex flex-col gap-10 rounded-12 border border-inkLine bg-[rgba(255,255,255,0.02)] p-14">
			<span className="text-13 font-medium text-[#f1f4ee]">{t("intFbTitle")}</span>
			<p className="text-11 text-[#8c948b]">{siteApp ? t("intFbSiteApp") : t("intFbHint")}</p>
			{/* Приложение Meta настроено на сайте (те же переменные, что у рекламных кабинетов) —
			    ключи не спрашиваем, иначе их пришлось бы искать в кабинете Meta без нужды */}
			{!siteApp && <FormField label={t("intfAppId")} value={appId} onChange={(e) => onAppId(e.target.value)} autoComplete="off" placeholder="1098409499579046" maxLength={40} />}
			{!siteApp && <FormField label={t("intfAppSecret")} value={appSecret} onChange={(e) => onAppSecret(e.target.value)} type="password" autoComplete="off" maxLength={80} />}
			{/* Meta не пустит на наш адрес возврата, пока он не разрешён в настройках приложения —
			    показываем его готовым, чтобы не искать и не набирать вручную */}
			{origin && (
				<CopyField
					label={t("intFbRedirect")}
					value={`${origin}${channel === "messenger" ? "/api/messenger/oauth/callback" : "/api/whatsapp/oauth/callback"}`}
				/>
			)}
			<button type="button" disabled={busy || (!siteApp && (!appId.trim() || !appSecret.trim()))} onClick={onStart} className="fs-btn fs-btn-primary h-40 self-start disabled:opacity-50">
				{busy ? "…" : t("intFbConnect")}
			</button>
		</div>
	);
}
