"use client";
import { useTranslations } from "next-intl";

interface Props {
	drive: { connected: boolean; configured: boolean; email?: string };
	importing: boolean;
	// Сколько документов ссылаются на файлы Google: отключение аккаунта их не удаляет, и об этом
	// честнее сказать заранее — /api/drive намеренно оставляет документы в CRM
	googleDocs: number;
	onConnect: () => void;
	onImport: () => void;
	onDisconnect: () => void;
}

// Состояние Google Drive: предложение подключить либо строка «подключён как …» с действиями
export default function DriveBanner({ drive, importing, googleDocs, onConnect, onImport, onDisconnect }: Props) {
	const t = useTranslations("collab");
	if (!drive.connected) {
		return (
			<div className="fs-card mb-16 flex flex-col gap-12 p-16 md:flex-row md:items-center md:justify-between">
				<div>
					<p className="text-14 font-medium text-[#f1f4ee]">{t("driveConnectTitle")}</p>
					<p className="mt-2 text-12 text-[#8c948b]">{drive.configured ? t("driveConnectText") : t("driveNotConfigured")}</p>
					{/* Документы не удаляются при отключении: ссылки на файлы Google остаются в списке,
					    и открыть их сможет только аккаунт, под которым они созданы (или тот, с кем поделились) */}
					{googleDocs > 0 && <p className="mt-6 text-12 text-[#F4A100]">{t("driveKeepNote", { count: googleDocs })}</p>}
				</div>
				{drive.configured && <button type="button" onClick={onConnect} className="fs-btn fs-btn-primary h-38 shrink-0">{t("driveConnectButton")}</button>}
			</div>
		);
	}
	return (
		<div className="mb-16 flex flex-wrap items-center gap-x-12 gap-y-8 text-12 text-[#8c948b]">
			<span>{t("driveConnectedAs", { email: drive.email || "Google" })}</span>
			<button type="button" onClick={onImport} disabled={importing} className="fs-btn fs-btn-ghost h-30 disabled:opacity-60">
				{importing ? t("driveImportRunning") : t("driveImportButton")}
			</button>
			<button type="button" onClick={onConnect} className="fs-link">{t("driveReconnect")}</button>
			<button type="button" onClick={onDisconnect} className="fs-link">{t("driveDisconnect")}</button>
		</div>
	);
}
