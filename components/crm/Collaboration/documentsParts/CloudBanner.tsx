"use client";
import { useTranslations } from "next-intl";
import type { CloudKind } from "@/types/documents";

interface Props {
	provider: Exclude<CloudKind, "">;
	cloud: { connected: boolean; configured: boolean; email?: string };
	busy: boolean;
	// Сколько документов ссылаются на файлы этого хранилища: отключение аккаунта их не удаляет,
	// и об этом честнее сказать заранее — документы намеренно остаются в CRM
	docs: number;
	onConnect: () => void;
	onImport: () => void;
	onDisconnect: () => void;
}

// Состояние подключённого хранилища (Google Drive или OneDrive): предложение подключить либо
// строка «подключён как …» с действиями. Разметка одна, тексты — по провайдеру.
export default function CloudBanner({ provider, cloud, busy, docs, onConnect, onImport, onDisconnect }: Props) {
	const t = useTranslations("collab");
	const key = provider === "onedrive" ? "onedrive" : "drive";
	const name = provider === "onedrive" ? "OneDrive" : "Google Drive";
	if (!cloud.connected) {
		return (
			<div className="fs-card mb-16 flex flex-col gap-12 p-16 md:flex-row md:items-center md:justify-between">
				<div>
					<p className="text-14 font-medium text-[#f1f4ee]">{t(`${key}ConnectTitle`)}</p>
					<p className="mt-2 text-12 text-[#8c948b]">{cloud.configured ? t(`${key}ConnectText`) : t("cloudNotConfigured", { name })}</p>
					{/* Файлы не удаляются при отключении: ссылки на них остаются в списке, и открыть их
					    сможет только тот аккаунт, под которым они созданы (или тот, с кем поделились) */}
					{docs > 0 && <p className="mt-6 text-12 text-[#F4A100]">{t(`${key}KeepNote`, { count: docs })}</p>}
				</div>
				{cloud.configured && <button type="button" onClick={onConnect} className="fs-btn fs-btn-primary h-38 shrink-0">{t("cloudConnectButton", { name })}</button>}
			</div>
		);
	}
	return (
		<div className="mb-16 flex flex-wrap items-center gap-x-12 gap-y-8 text-12 text-[#8c948b]">
			<span>{t("cloudConnectedAs", { name, email: cloud.email || name })}</span>
			<button type="button" onClick={onImport} disabled={busy} className="fs-btn fs-btn-ghost h-30 disabled:opacity-60">
				{busy ? t(`${key}ImportRunning`) : t(`${key}ImportButton`)}
			</button>
			<button type="button" onClick={onConnect} className="fs-link">{t(`${key}Reconnect`)}</button>
			<button type="button" onClick={onDisconnect} className="fs-link">{t(`${key}Disconnect`)}</button>
		</div>
	);
}
