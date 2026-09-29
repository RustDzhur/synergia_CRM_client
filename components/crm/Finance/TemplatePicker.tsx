"use client";
import "react";
import { TEMPLATES, TemplateDef } from "@/lib/finance/templates";

// Выбор оформления документа: та же десятка шаблонов, что и в рендере PDF, показанная миниатюрами.
// Миниатюра — схема, а не картинка: блоки повторяют расположение настоящего документа (полоса сверху,
// боковая колонка, две колонки, сетка «подпись — значение»), поэтому выбрать шаблон можно не наугад.
// Цвета берём у самого шаблона, чтобы миниатюра не разошлась с тем, что напечатается.

function Bar({ w, color, h = 3 }: { w: string; color: string; h?: number }) {
	return <div style={{ width: w, height: h, background: color, borderRadius: 1 }} />;
}

function Lines({ n = 3, color = "#DCDCDC", w = "100%" }: { n?: number; color?: string; w?: string }) {
	return (
		<div className="flex flex-col gap-[3px]" style={{ width: w }}>
			{Array.from({ length: n }).map((_, i) => <Bar key={i} w={i === n - 1 ? "62%" : "100%"} color={color} h={2} />)}
		</div>
	);
}

function Rows({ accent, rows = 3 }: { accent: string; rows?: number }) {
	return (
		<div className="flex flex-col gap-[2px]">
			{Array.from({ length: rows }).map((_, i) => (
				<div key={i} className="flex items-center justify-between gap-[4px]">
					<Bar w="52%" color="#E2E2E2" h={2} />
					<Bar w="16%" color="#E2E2E2" h={2} />
				</div>
			))}
			<div className="mt-[2px] flex items-center justify-between">
				<Bar w="34%" color={accent} h={3} />
				<Bar w="20%" color={accent} h={3} />
			</div>
		</div>
	);
}

function Qr({ accent, size = 14 }: { accent: string; size?: number }) {
	return (
		<div className="grid grid-cols-4 grid-rows-4 gap-[1px] rounded-[1px] bg-[#f1f4ee] p-[2px]" style={{ width: size, height: size, border: `0.5px solid ${accent}33` }}>
			{[1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1].map((on, i) => (
				<div key={i} style={{ background: on ? accent : "transparent", opacity: on ? 0.75 : 0 }} />
			))}
		</div>
	);
}

// Схема документа для каждого варианта расположения блоков
function Preview({ t }: { t: TemplateDef }) {
	const { accent, tint, variant } = t;
	const paper = "relative flex h-[86px] w-full flex-col overflow-hidden bg-[#f1f4ee]";
	const pad = "px-[8px] py-[6px]";

	if (variant === "sidebar") {
		return (
			<div className={`${paper} flex-row`}>
				<div className="flex w-[34%] flex-col justify-between p-[6px]" style={{ background: tint, borderRight: `2px solid ${accent}` }}>
					<Lines n={3} color={accent} />
					<Qr accent={accent} size={16} />
				</div>
				<div className={`${pad} flex flex-1 flex-col gap-[5px]`}>
					<Bar w="70%" color={accent} h={5} />
					<Lines n={2} />
					<Rows accent={accent} rows={2} />
				</div>
			</div>
		);
	}
	if (variant === "banner") {
		return (
			<div className={paper}>
				<div className="flex flex-col gap-[3px] px-[8px] py-[6px]" style={{ background: accent }}>
					<Bar w="42%" color="#FFFFFF" h={3} />
					<Bar w="62%" color="#FFFFFF" h={5} />
				</div>
				<div className={`${pad} flex flex-1 flex-col gap-[5px]`}>
					<div className="flex gap-[8px]"><Lines n={2} w="48%" /><Lines n={2} w="48%" /></div>
					<Rows accent={accent} rows={2} />
				</div>
			</div>
		);
	}
	if (variant === "band") {
		return (
			<div className={paper}>
				<div className="flex items-end justify-between px-[8px] py-[6px]" style={{ background: tint, borderLeft: `3px solid ${accent}` }}>
					<div className="flex flex-col gap-[3px]"><Bar w="40px" color={accent} h={3} /><Bar w="56px" color="#BFBFBF" h={5} /></div>
					<Lines n={2} w="34px" />
				</div>
				<div className={`${pad} flex flex-1 flex-col gap-[5px]`}>
					<Rows accent={accent} rows={3} />
				</div>
			</div>
		);
	}
	if (variant === "twocol") {
		return (
			<div className={paper}>
				<div className={`${pad} flex flex-col gap-[5px]`}>
					<Bar w="56%" color={accent} h={4} />
					<div className="flex gap-[6px]">
						<div className="flex-1 rounded-[2px] p-[4px]" style={{ background: tint }}><Lines n={2} /></div>
						<div className="flex-1 rounded-[2px] p-[4px]" style={{ background: tint }}><Lines n={2} /></div>
					</div>
					<Rows accent={accent} rows={2} />
				</div>
			</div>
		);
	}
	if (variant === "boxed") {
		return (
			<div className={paper}>
				<div className={`${pad} flex flex-1 flex-col gap-[5px]`}>
					<div className="flex justify-between">
						<Bar w="40%" color={accent} h={4} />
						<div className="rounded-[2px] p-[4px]" style={{ background: tint, border: "0.5px solid #DCDCDC" }}><Lines n={2} w="40px" /></div>
					</div>
					<div className="rounded-[2px] p-[4px]" style={{ background: tint, border: "0.5px solid #DCDCDC" }}><Lines n={2} w="70px" /></div>
					<Rows accent={accent} rows={2} />
				</div>
			</div>
		);
	}
	if (variant === "compact") {
		return (
			<div className="relative flex h-[86px] w-full flex-col gap-[4px] overflow-hidden bg-[#f1f4ee] px-[8px] py-[6px]">
				<div className="flex items-start justify-between">
					<Bar w="52%" color={accent} h={4} />
					<Lines n={2} w="34px" />
				</div>
				<Lines n={2} w="80%" />
				<Rows accent={accent} rows={3} />
			</div>
		);
	}
	if (variant === "center") {
		return (
			<div className={`${paper} items-center gap-[4px] ${pad}`}>
				<Bar w="44%" color="#DCDCDC" h={2} />
				<div style={{ width: 42, height: 1, background: accent }} />
				<Bar w="34%" color={accent} h={4} />
				<Bar w="50%" color="#BFBFBF" h={5} />
				<div className="flex w-full gap-[8px]">
					<Lines n={2} w="48%" />
					<Lines n={2} w="48%" />
				</div>
				<div className="w-full"><Rows accent={accent} rows={2} /></div>
			</div>
		);
	}
	if (variant === "grid") {
		const row = (labelW: string) => (
			<div className="flex w-full items-center gap-[6px]">
				<Bar w={labelW} color={accent} h={2} />
				<Bar w="100%" color="#DCDCDC" h={2} />
			</div>
		);
		return (
			<div className="relative flex h-[86px] w-full flex-col gap-[5px] overflow-hidden bg-[#f1f4ee] px-[8px] py-[6px]">
				<div className="flex items-start justify-between">
					<Bar w="30%" color="#999999" h={3} />
					<Bar w="34%" color={accent} h={6} />
				</div>
				<div style={{ height: 1, background: accent }} />
				{row("24px")}{row("38px")}{row("30px")}
				<Rows accent={accent} rows={1} />
			</div>
		);
	}
	if (variant === "plain") {
		return (
			<div className="relative flex h-[86px] w-full flex-col gap-[6px] overflow-hidden bg-[#f1f4ee] px-[12px] py-[9px]">
				<Lines n={1} w="52%" />
				<Bar w="26%" color={accent} h={3} />
				<Bar w="42%" color="#C9C9C9" h={5} />
				<Lines n={2} w="46%" />
				<div className="mt-auto"><Rows accent={accent} rows={2} /></div>
			</div>
		);
	}
	// classic — вариант по умолчанию
	return (
		<div className={paper}>
			<div className={`${pad} flex flex-1 flex-col gap-[5px]`}>
				<Lines n={2} w="46%" />
				<Bar w="52%" color={accent} h={5} />
				<Lines n={2} w="34%" />
				<Rows accent={accent} rows={2} />
			</div>
		</div>
	);
}

// Сетка из десяти миниатюр. value — id выбранного шаблона, "" означает «как в настройках бухгалтерии»:
// тогда пунктиром помечается шаблон из настроек (inherit), чтобы было видно, что напечатается.
export default function TemplatePicker({ value, onChange, allowDefault = false, columns = 5, inherit = "" }: { value: string; onChange: (id: string) => void; allowDefault?: boolean; columns?: number; inherit?: string }) {
	const options = allowDefault ? [{ id: "", accent: "#B3B3B3", tint: "#E4E7E0", margin: 50, variant: "classic" as const }, ...TEMPLATES] : TEMPLATES;
	return (
		<div className="grid gap-10" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
			{options.map((t) => {
				const active = value === t.id;
				const inherited = !value && !!t.id && t.id === inherit;
				return (
					<button
						key={t.id || "default"}
						type="button"
						onClick={() => onChange(t.id)}
						aria-pressed={active}
						title={inherited ? `${t.id} (${inherit})` : t.id}
						aria-label={t.id || "default"}
						className="overflow-hidden rounded-10 bg-[rgba(255,255,255,0.03)] p-[3px] text-left transition-[border-color,box-shadow]"
						style={{ border: `1.5px ${inherited ? "dashed" : "solid"} ${active || inherited ? t.accent : "rgba(255,255,255,0.12)"}`, boxShadow: active ? `0 0 0 3px ${t.accent}22` : "none" }}
					>
						<div className="overflow-hidden rounded-[5px]">
							<Preview t={t} />
						</div>
					</button>
				);
			})}
		</div>
	);
}
