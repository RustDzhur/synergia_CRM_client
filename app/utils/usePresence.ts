import { useEffect, useState } from "react";

// Позволяет анимировать не только появление, но и исчезновение элементов, которые
// рисуются условно ({open && <Modal/>}). `rendered` — держать ли элемент в DOM,
// `visible` — какое состояние анимации ему сейчас показывать.
//   открытие: rendered=true -> на следующем кадре visible=true (запускается transition)
//   закрытие: visible=false -> через ms (время transition) rendered=false
export function usePresence(open: boolean, ms = 300) {
	const [rendered, setRendered] = useState(open);
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		if (open) {
			setRendered(true);
			let inner = 0;
			const outer = requestAnimationFrame(() => {
				inner = requestAnimationFrame(() => setVisible(true));
			});
			return () => {
				cancelAnimationFrame(outer);
				cancelAnimationFrame(inner);
			};
		}
		setVisible(false);
		const timer = setTimeout(() => setRendered(false), ms);
		return () => clearTimeout(timer);
	}, [open, ms]);

	return { rendered, visible };
}
