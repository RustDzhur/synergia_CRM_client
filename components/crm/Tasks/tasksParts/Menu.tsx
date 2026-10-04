"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
	options: Array<{ label: string; danger?: boolean; onClick: () => void }>;
	children: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
	align?: "left" | "right";
}

const WIDTH = 190;

// Выпадающее меню, которое рисуется поверх всей страницы (портал в body, position: fixed).
// Раньше панель жила внутри строки таблицы/плитки: соседние строки (у каждой своя анимация и свой слой) и прокручиваемая обёртка
// таблицы закрывали её, меню было видно, но нажать пункты не получалось — клик попадал в строки под ним.
export default function Menu({ options, children, align = "left" }: Props) {
	const [open, setOpen] = useState(false);
	const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
	const wrap = useRef<HTMLDivElement>(null);
	const panel = useRef<HTMLDivElement>(null);
	const close = useCallback(() => setOpen(false), []);

	const place = useCallback(() => {
		const r = wrap.current?.getBoundingClientRect();
		if (!r) return;
		const h = panel.current?.offsetHeight ?? 0;
		let left = align === "right" ? r.right - WIDTH : r.left;
		left = Math.max(8, Math.min(left, window.innerWidth - WIDTH - 8));
		let top = r.bottom + 8;
		if (h && top + h > window.innerHeight - 8 && r.top - 8 - h > 8) top = r.top - 8 - h; // не помещается снизу — открываем вверх
		setPos({ top, left });
	}, [align]);

	useLayoutEffect(() => { if (open) place(); }, [open, place]);

	useEffect(() => {
		if (!open) return;
		const onDown = (e: MouseEvent | TouchEvent) => {
			const target = e.target as Node;
			if (!wrap.current?.contains(target) && !panel.current?.contains(target)) close();
		};
		const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
		document.addEventListener("mousedown", onDown);
		document.addEventListener("touchstart", onDown);
		document.addEventListener("keydown", onKey);
		window.addEventListener("resize", close);
		window.addEventListener("scroll", close, true); // прокрутка страницы или таблицы — меню закрывается, а не «уезжает» от кнопки
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("touchstart", onDown);
			document.removeEventListener("keydown", onKey);
			window.removeEventListener("resize", close);
			window.removeEventListener("scroll", close, true);
		};
	}, [open, close]);

	return (
		<div ref={wrap} className="relative inline-block">
			{children({ open, toggle: () => setOpen((v) => !v) })}
			{open && typeof document !== "undefined" && createPortal(
				<div ref={panel} role="menu" className="fixed z-[200] animate-fade-in" style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, minWidth: WIDTH }}>
					<div className="fs-popover overflow-hidden py-4 text-left">
						{options.map((o, i) => (
							<div key={o.label}>
								{i > 0 && <div className="my-4 border-t border-inkLine" />}
								<button
									type="button"
									role="menuitem"
									onClick={() => { setOpen(false); o.onClick(); }}
									className={`fs-popover-row block w-full px-14 py-10 text-left text-13 transition-colors duration-150 ${o.danger ? "!text-danger" : ""}`}>
									{o.label}
								</button>
							</div>
						))}
					</div>
				</div>,
				document.body
			)}
		</div>
	);
}
