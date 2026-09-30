"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { TbLoader2 } from "react-icons/tb";
import { apiCall } from "@/store/crmApi";

// Поле с подсказками (ТЗ §16): печатаешь — сервер предлагает варианты из справочника (VIES, Нова
// Пошта…), выбираешь — поля заполняются. Ручной ввод работает всегда: подсказок нет — просто пишешь
// сам, и никакой провайдер этому не мешает. Демонстрационные подсказки помечены словами, а не цветом.

interface Hit { id: string; label: string; detail?: string; fill?: Record<string, string> }

export default function AutocompleteField({
	label,
	value,
	onChange,
	onPick,
	kind,
	country,
	placeholder,
	required,
	className = "",
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
	onPick?: (fill: Record<string, string>) => void;
	kind: "company" | "address";
	country?: string;
	placeholder?: string;
	required?: boolean;
	className?: string;
}) {
	const t = useTranslations("crm");
	const [hits, setHits] = useState<Hit[]>([]);
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const [note, setNote] = useState<{ code: string; detail?: string; mock?: boolean } | null>(null);
	const boxRef = useRef<HTMLDivElement>(null);
	// Пока идёт ввод, ответы приходят с задержкой: подсказки не должны мигать на каждой букве
	const [touched, setTouched] = useState(false);

	useEffect(() => {
		if (!touched) return;
		if (value.trim().length < 3) {
			setHits([]);
			setNote(null);
			return;
		}
		let alive = true;
		setBusy(true);
		const timer = window.setTimeout(async () => {
			const res = await apiCall<{ results: Hit[]; noteCode?: string; noteDetail?: string; mock?: boolean }>(
				`/api/lookup?kind=${kind}&q=${encodeURIComponent(value.trim())}${country ? `&country=${country}` : ""}`
			);
			if (!alive) return;
			setBusy(false);
			if (res.ok && res.data) {
				setHits(res.data.results ?? []);
				setOpen((res.data.results ?? []).length > 0);
				setNote(res.data.noteCode ? { code: res.data.noteCode, detail: res.data.noteDetail, mock: res.data.mock } : null);
			} else {
				setHits([]);
				setNote(null);
			}
		}, 400);
		return () => { alive = false; window.clearTimeout(timer); };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [value, touched, kind, country]);

	// Клик мимо списка закрывает подсказки, но введённое не трогает
	useEffect(() => {
		function onDoc(e: MouseEvent) {
			if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
		}
		document.addEventListener("mousedown", onDoc);
		return () => document.removeEventListener("mousedown", onDoc);
	}, []);

	function pick(hit: Hit) {
		onChange(hit.label);
		if (hit.fill && onPick) onPick({ ...hit.fill, [kind === "company" ? "name" : "address"]: hit.label });
		setOpen(false);
	}

	return (
		<div className={className} ref={boxRef}>
			<label className="relative block">
				<span className="mb-6 block text-12 text-[#8c948b]">{label}{required ? " *" : ""}</span>
				<div className="relative">
					<input
						value={value}
						onChange={(e) => { setTouched(true); onChange(e.target.value); }}
						onFocus={() => hits.length > 0 && setOpen(true)}
						placeholder={placeholder}
						className="fs-field h-40 w-full px-12 pr-32 text-13 outline-none"
					/>
					{busy && <TbLoader2 size={14} className="absolute right-10 top-13 animate-spin text-[#8c948b]" />}
				</div>
				{open && hits.length > 0 && (
					<ul className="absolute z-40 mt-4 max-h-[220px] w-full overflow-y-auto rounded-10 border border-[rgba(255,255,255,0.14)] bg-[#131715] shadow-lg">
						{hits.map((h) => (
							<li key={h.id}>
								<button type="button" onClick={() => pick(h)} className="w-full px-12 py-9 text-left transition-colors hover:bg-[rgba(198,255,77,0.08)]">
									<span className="block text-13 text-[#f1f4ee]">{h.label}</span>
									{h.detail && <span className="mt-2 block text-11 text-[#8c948b]">{h.detail}</span>}
								</button>
							</li>
						))}
					</ul>
				)}
			</label>
			{/* Причина отсутствия подсказок и предупреждение о демо-данных — словами, не цветом */}
			{note && (
				<p className="mt-[4px] text-11 text-[#9AA396]">
					{t(`lookup_${note.code}`)}{note.detail ? ` · ${note.detail}` : ""}
				</p>
			)}
		</div>
	);
}
