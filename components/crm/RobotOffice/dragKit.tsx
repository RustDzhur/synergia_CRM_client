"use client";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// Перетаскивание без внешних библиотек и для мыши, и для пальца: мышь начинает тянуть после небольшого сдвига, палец — после
// короткого удержания (иначе страницу нельзя было бы прокручивать). Цель — ближайший элемент с data-drop-zone (комната) или
// data-drop-robot (робот). Робота можно переносить в комнату, поручение — на робота.
export type DragPayload = { kind: "robot" | "task"; id: string; label: string };
export type DropTarget = { type: "zone" | "robot"; id: string };

interface DragCtx {
	payload: DragPayload | null;
	over: DropTarget | null;
	start: (e: React.PointerEvent, p: DragPayload) => void;
	/** Только что закончилось перетаскивание: клик по тому же элементу надо проигнорировать. */
	justDragged: () => boolean;
}

const Ctx = createContext<DragCtx>({ payload: null, over: null, start: () => undefined, justDragged: () => false });
export const useDragKit = () => useContext(Ctx);

const MOVE_PX = 6;
const HOLD_MS = 260;

const targetAt = (x: number, y: number, p: DragPayload): DropTarget | null => {
	for (const el of document.elementsFromPoint(x, y)) {
		const robot = (el as HTMLElement).dataset?.dropRobot;
		if (robot && p.kind === "task") return { type: "robot", id: robot };
		const zone = (el as HTMLElement).dataset?.dropZone;
		if (zone && p.kind === "robot") return { type: "zone", id: zone };
	}
	return null;
};

export function DragProvider({ onDrop, children }: { onDrop: (p: DragPayload, t: DropTarget) => void; children: React.ReactNode }) {
	const [state, setState] = useState<{ payload: DragPayload; x: number; y: number; over: DropTarget | null } | null>(null);
	const dropRef = useRef(onDrop);
	dropRef.current = onDrop;
	const dragged = useRef(false);

	const start = useCallback((e: React.PointerEvent, payload: DragPayload) => {
		if (e.pointerType === "mouse" && e.button !== 0) return;
		const touch = e.pointerType !== "mouse";
		const x0 = e.clientX, y0 = e.clientY;
		let begun = false, done = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const block = (ev: TouchEvent) => { if (begun) ev.preventDefault(); };

		const begin = (x: number, y: number) => {
			begun = true;
			document.body.classList.add("select-none");
			window.getSelection()?.removeAllRanges();
			setState({ payload, x, y, over: targetAt(x, y, payload) });
		};
		const move = (ev: PointerEvent) => {
			if (done) return;
			if (!begun) {
				const far = Math.hypot(ev.clientX - x0, ev.clientY - y0);
				if (touch && far > 10) return finish(false); // палец поехал раньше удержания — это прокрутка страницы
				if (!touch && far > MOVE_PX) begin(ev.clientX, ev.clientY);
				return;
			}
			setState({ payload, x: ev.clientX, y: ev.clientY, over: targetAt(ev.clientX, ev.clientY, payload) });
		};
		const up = (ev: PointerEvent) => finish(ev.type === "pointerup", ev.clientX, ev.clientY);
		function finish(drop: boolean, x = x0, y = y0) {
			if (done) return;
			done = true;
			if (timer) clearTimeout(timer);
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
			window.removeEventListener("pointercancel", up);
			document.removeEventListener("touchmove", block);
			document.body.classList.remove("select-none");
			if (begun) {
				dragged.current = true;
				setTimeout(() => { dragged.current = false; }, 60);
				const over = drop ? targetAt(x, y, payload) : null;
				if (over) dropRef.current(payload, over);
			}
			setState(null);
		}
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
		window.addEventListener("pointercancel", up);
		document.addEventListener("touchmove", block, { passive: false });
		if (touch) timer = setTimeout(() => { if (!done) begin(x0, y0); }, HOLD_MS);
	}, []);

	useEffect(() => () => document.body.classList.remove("select-none"), []);
	const justDragged = useCallback(() => dragged.current, []);

	return (
		<Ctx.Provider value={{ payload: state?.payload ?? null, over: state?.over ?? null, start, justDragged }}>
			{children}
			{state && (
				<div className="pointer-events-none fixed z-[90] max-w-[220px] truncate rounded-10 border border-[rgba(198,255,77,0.55)] bg-[#1D2320] px-12 py-6 text-12 font-medium text-[#f1f4ee] shadow-[0_10px_28px_rgba(0,0,0,0.5)]" style={{ left: state.x + 14, top: state.y + 14 }}>
					{state.payload.label}
				</div>
			)}
		</Ctx.Provider>
	);
}
