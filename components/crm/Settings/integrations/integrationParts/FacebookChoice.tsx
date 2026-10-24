"use client";
import { useTranslations } from "next-intl";

// Возврат из Facebook, когда страниц или номеров несколько: остаётся выбрать, что подключать
export default function FacebookChoice({ options, onChoose }: { options: Array<{ id: string; name: string }>; onChoose: (id: string) => void }) {
	const t = useTranslations("settings");
	return (
		<div className="flex flex-col gap-6">
			<span className="text-12 text-[#8c948b]">{t("intFbChoose")}</span>
			{options.map((o) => (
				<button key={o.id} type="button" onClick={() => onChoose(o.id)} className="fs-popover-row w-full rounded-8 px-10 py-8 text-left text-13">
					{o.name}
				</button>
			))}
		</div>
	);
}
