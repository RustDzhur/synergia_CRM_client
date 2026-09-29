import React from "react";

// Салатовая пилюля-статус (например «Защищено» рядом с переключателем фирмы) — тёмный текст на ярком фоне,
// в отличие от primaryColor (тот подобран так, чтобы держать белый текст) это самый яркий акцент в макете.
export default function Badge({ children, dot = false }: { children: React.ReactNode; dot?: boolean }) {
	return (
		<span className="inline-flex items-center gap-6 rounded-300 bg-accentGreen px-12 py-4 text-12 font-medium text-[#0A0A0A]">
			{dot && <span className="h-6 w-6 shrink-0 rounded-300 bg-[#0A0A0A]" />}
			{children}
		</span>
	);
}
