"use client";
import { useTranslations } from "next-intl";
import { cardClass, Req } from "./model";

interface Props { requests: Req[]; onActivate: (r: Req) => void; onDismiss: (r: Req) => void }

// Заявки на счёт: новые ждут, пока администратор включит тариф или закроет заявку
export default function RequestsList({ requests, onActivate, onDismiss }: Props) {
	const t = useTranslations("admin");
	return (
		<div className="mb-24">
			<h2 className="mb-8 text-14 font-semibold text-[#f1f4ee]">{t("requests")}</h2>
			<ul className="flex flex-col gap-8">
				{requests.map((r) => (
					<li key={r.id} className={`${cardClass} flex flex-wrap items-center gap-x-16 gap-y-8`}>
						<div className="min-w-0 flex-1 text-12 text-[#8c948b]">
							<p className="font-medium text-[#f1f4ee]">{r.orgName} · {r.plan} / {r.interval === "year" ? t("year") : t("month")}</p>
							<p>{r.company}{r.vatId ? ` · ${r.vatId}` : ""} · {r.email}</p>
							{r.note && <p className="text-[#8c948b]">{r.note}</p>}
						</div>
						<button type="button" onClick={() => onActivate(r)} className="fs-btn fs-btn-primary h-34">{t("activate")}</button>
						<button type="button" onClick={() => onDismiss(r)} className="text-12 text-[#9AA396] hover:text-danger">{t("dismiss")}</button>
					</li>
				))}
			</ul>
			<p className="mt-6 text-11 text-[#9AA396]">{t("requestsHelp")}</p>
		</div>
	);
}
