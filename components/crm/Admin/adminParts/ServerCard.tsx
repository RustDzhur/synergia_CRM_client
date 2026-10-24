"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiCall } from "@/store/crmApi";

interface Stats {
	cpu: { cores: number; model: string; percent: number; load: [number, number, number] };
	memory: { totalMb: number; usedMb: number; availableMb: number; percent: number; swapTotalMb: number; swapUsedMb: number };
	disk: { totalGb: number; usedGb: number; freeGb: number; percent: number };
	storage: { usedMb: number } | null;
	database: { sizeMb: number } | null;
	uptimeDays: number;
	app: { rssMb: number; node: string };
}

// Полоса заполнения: до 70% зелёная, до 90% жёлтая, дальше красная — по цвету сразу видно, когда пора докупать мощность
function Bar({ percent }: { percent: number }) {
	const color = percent >= 90 ? "#ff6b6b" : percent >= 70 ? "#ffc857" : "#2DDEB6";
	return (
		<div className="mt-6 h-8 w-full overflow-hidden rounded-4 bg-[#1c211c]">
			<div className="h-full rounded-4 transition-all" style={{ width: `${Math.min(100, percent)}%`, background: color }} />
		</div>
	);
}

const gbMb = (mb: number) => (mb >= 1024 ? `${Math.round((mb / 1024) * 10) / 10} GB` : `${mb} MB`);

export default function ServerCard() {
	const t = useTranslations("admin");
	const [s, setS] = useState<Stats | null>(null);
	const [error, setError] = useState("");

	useEffect(() => {
		let stop = false;
		const load = async () => {
			const res = await apiCall<Stats>("/api/admin/server");
			if (stop) return;
			if (res.data) { setS(res.data); setError(""); } else setError(res.message);
		};
		load();
		const id = setInterval(load, 5000);
		return () => { stop = true; clearInterval(id); };
	}, []);

	return (
		<div className="fs-card mb-24 p-16">
			<div className="flex flex-wrap items-center justify-between gap-8">
				<div><p className="text-14 font-medium text-[#edf2ff]">{t("srvTitle")}</p><p className="text-12 text-[#9aa7c9]">{t("srvHelp")}</p></div>
				{s && <p className="text-12 text-[#9aa7c9]">{t("srvUptime", { days: s.uptimeDays })}</p>}
			</div>
			{error && !s && <p className="mt-12 text-13 text-danger">{error}</p>}
			{s && (
				<div className="mt-12 grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">
					<div>
						<p className="text-12 text-[#9aa7c9]">{t("srvCpu")} · {t("srvCores", { n: s.cpu.cores })}</p>
						<p className="text-18 font-semibold text-[#edf2ff]">{s.cpu.percent}%</p>
						<Bar percent={s.cpu.percent} />
						<p className="mt-4 text-11 text-[#9aa7c9]">{t("srvLoad")}: {s.cpu.load.join(" / ")}</p>
					</div>
					<div>
						<p className="text-12 text-[#9aa7c9]">{t("srvRam")}</p>
						<p className="text-18 font-semibold text-[#edf2ff]">{gbMb(s.memory.usedMb)} <span className="text-12 font-normal text-[#9aa7c9]">/ {gbMb(s.memory.totalMb)}</span></p>
						<Bar percent={s.memory.percent} />
						<p className="mt-4 text-11 text-[#9aa7c9]">{t("srvFree")}: {gbMb(s.memory.availableMb)}{s.memory.swapTotalMb > 0 ? ` · swap ${gbMb(s.memory.swapUsedMb)} / ${gbMb(s.memory.swapTotalMb)}` : ""}</p>
					</div>
					<div>
						<p className="text-12 text-[#9aa7c9]">{t("srvDisk")}</p>
						<p className="text-18 font-semibold text-[#edf2ff]">{s.disk.usedGb} GB <span className="text-12 font-normal text-[#9aa7c9]">/ {s.disk.totalGb} GB</span></p>
						<Bar percent={s.disk.percent} />
						<p className="mt-4 text-11 text-[#9aa7c9]">{t("srvFree")}: {s.disk.freeGb} GB</p>
					</div>
					<div>
						<p className="text-12 text-[#9aa7c9]">{t("srvData")}</p>
						<p className="mt-2 text-13 text-[#edf2ff]">{t("srvDb")}: {s.database ? gbMb(s.database.sizeMb) : "—"}</p>
						<p className="text-13 text-[#edf2ff]">{t("srvFiles")}: {s.storage ? gbMb(s.storage.usedMb) : "—"}</p>
						<p className="text-13 text-[#edf2ff]">{t("srvApp")}: {gbMb(s.app.rssMb)}</p>
					</div>
				</div>
			)}
			{s && <p className="mt-12 text-11 text-[#9aa7c9]">{t("srvHint")}</p>}
		</div>
	);
}
