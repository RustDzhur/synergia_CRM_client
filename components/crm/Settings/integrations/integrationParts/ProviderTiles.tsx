"use client";
import { useTranslations } from "next-intl";
import ProviderLogo from "../ProviderLogo";

interface Props {
	catalog: Array<{ id: string; name: string }>;
	preset: string | null;
	onPick: (id: string) => void;
	isConnected: (id: string) => boolean;
}

// Плитки провайдеров: у звонков это способ подключения (Twilio или SIP), у СМС — конкретный сервис
export default function ProviderTiles({ catalog, preset, onPick, isConnected }: Props) {
	const t = useTranslations("settings");
	return (
		<ul className="grid grid-cols-2 gap-10 sm:grid-cols-3" aria-label={t("intProviders")}>
			{catalog.map((p) => (
				<li key={p.id}>
					<button
						type="button"
						onClick={() => onPick(p.id)}
						aria-pressed={preset === p.id}
						className={`relative flex h-80 w-full flex-col items-center justify-center gap-6 rounded-12 border px-6 text-center text-12 font-medium transition-colors ${preset === p.id ? "border-[#7c93ff] bg-[rgba(124,147,255,0.08)] text-[#7c93ff]" : "border-inkLine bg-transparent text-[#9aa7c9] hover:border-[rgba(255,255,255,0.20)]"}`}>
						<ProviderLogo id={p.id} size={30} />
						<span className="leading-[1.15]">{p.id === "custom" ? t("provCustom") : p.name}</span>
						{isConnected(p.id) && <span className="absolute right-6 top-6 h-8 w-8 rounded-50 bg-[#2DDEB6]" title={t("intStatusShort")} />}
					</button>
				</li>
			))}
		</ul>
	);
}
