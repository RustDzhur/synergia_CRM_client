import { RefObject, useEffect } from "react";

// Вызывает onOutside при клике/касании вне элемента и по Escape — пока active === true.
export function useClickOutside(
	ref: RefObject<HTMLElement>,
	active: boolean,
	onOutside: () => void
) {
	useEffect(() => {
		if (!active) return;
		const onPointerDown = (event: MouseEvent | TouchEvent) => {
			if (ref.current && !ref.current.contains(event.target as Node)) onOutside();
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onOutside();
		};
		document.addEventListener("mousedown", onPointerDown);
		document.addEventListener("touchstart", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("mousedown", onPointerDown);
			document.removeEventListener("touchstart", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [ref, active, onOutside]);
}
