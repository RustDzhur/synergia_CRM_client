"use client";
import type { RefObject } from "react";
import { useTranslations } from "next-intl";
import { TbCloudUpload } from "react-icons/tb";
import FileTypeIcon from "../FileTypeIcon";
import { GOOGLE_KINDS, ICON_TYPE } from "./model";
import type { GoogleKind } from "./model";

interface Props {
	tab: "crm" | "drive";
	driveConnected: boolean;
	storageConfigured: boolean;
	fileRef: RefObject<HTMLInputElement>;
	onCreate: (kind: GoogleKind) => void;
	onUpload: () => void;
	onFiles: (list: FileList | null) => void;
}

// Плитки «создать документ Google» и «загрузить файл»; недоступные (нет Диска или хранилища) приглушены
export default function CreateTiles({ tab, driveConnected, storageConfigured, fileRef, onCreate, onUpload, onFiles }: Props) {
	const t = useTranslations("collab");
	return (
		<ul className="grid grid-cols-2 gap-12 md:grid-cols-3 md:gap-16 lg:gap-20 xl:grid-cols-4">
			{/* Документы Google создаются на Диске, загруженный файл лежит у нас — поэтому набор плиток
			    зависит от вкладки: смешивать два хранилища в одной сетке и было путаницей */}
			{tab === "drive" && GOOGLE_KINDS.map((kind) => (
				<li key={kind}>
					<button
						type="button"
						onClick={() => onCreate(kind)}
						className={`fs-card flex aspect-square w-full flex-col items-center justify-center gap-10 transition-transform duration-200 hover:-translate-y-2 lg:max-h-[240px] ${driveConnected ? "" : "opacity-60"}`}>
						<FileTypeIcon type={ICON_TYPE[kind]} size={56} />
						<span className="text-12 font-semibold text-[#8c948b] md:text-13">{t(`kind_${kind}`)}</span>
					</button>
				</li>
			))}
			{tab === "crm" && <li>
				<button
					type="button"
					onClick={onUpload}
					className={`fs-card flex aspect-square w-full flex-col items-center justify-center gap-10 transition-transform duration-200 hover:-translate-y-2 lg:max-h-[240px] ${storageConfigured ? "" : "opacity-60"}`}>
					<TbCloudUpload size={56} className="text-[#8c948b]" aria-hidden />
					<span className="text-12 font-semibold text-[#8c948b] md:text-13">{t("uploadFile")}</span>
				</button>
				<input ref={fileRef} type="file" multiple hidden onChange={(e) => onFiles(e.target.files)} aria-label={t("uploadFile")} />
			</li>}
		</ul>
	);
}
