import React from "react";
import type { Accent } from "@/store/useOfficeStore";
import { ACCENT_HEX, type RobotState } from "../theme";

// Робот для плана офиса: объёмный корпус с бликами, глянцевый визор, светящееся ядро. Размер 80×100, «ноги» у y≈97.
// Позы и сторона (спереди/сзади) переключаются атрибутами предка data-pose / data-face / data-flip / data-work (стили bt-* в globals.css),
// поэтому один и тот же рисунок умеет ходить, сидеть за столом спиной к зрителю, пить кофе и спать.
export default function Bot({ accent, state = "idle", boss = false }: { accent: Accent; state?: RobotState; boss?: boolean }) {
	const c = ACCENT_HEX[accent];
	const eye = state === "waiting" ? "#F4A100" : state === "failed" ? "#EB5757" : c;
	return (
		<svg viewBox="0 0 80 100" width="80" height="100" className={`bt rb-${state}`} aria-hidden style={{ overflow: "visible" }}>
			<ellipse className="bt-shadow" cx="40" cy="97" rx="22" ry="5" fill="rgba(0,0,0,0.5)" filter="url(#f-soft)" />
			<g className="bt-flip">
				<g className="bt-body">
					<g className="bt-legs">
						<g className="bt-leg bt-leg-l" style={{ transformOrigin: "34px 80px" }}><rect x="29" y="78" width="10" height="16" rx="5" fill="url(#bt-metal)" /><rect x="26" y="90" width="15" height="7" rx="3.5" fill="#202822" /></g>
						<g className="bt-leg bt-leg-r" style={{ transformOrigin: "46px 80px" }}><rect x="41" y="78" width="10" height="16" rx="5" fill="url(#bt-metal)" /><rect x="39" y="90" width="15" height="7" rx="3.5" fill="#202822" /></g>
					</g>
					<g className="bt-arm bt-arm-l" style={{ transformOrigin: "19px 58px" }}><rect x="12" y="55" width="9" height="26" rx="4.5" fill="url(#bt-body2)" /><circle cx="16.5" cy="82" r="5" fill="#26302a" /><circle cx="16.5" cy="57" r="5" fill="#26302a" /></g>
					<rect x="22" y="52" width="36" height="31" rx="11" fill="url(#bt-body)" />
					<path d="M26 60 Q40 54 54 60" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.6" strokeLinecap="round" />
					<g className="bt-front">
						<rect x="29" y="68" width="22" height="11" rx="5.5" fill="url(#bt-visor)" />
						<circle cx="40" cy="73.5" r="3.6" fill={eye} filter="url(#f-glow)" className="rb-light" />
					</g>
					<g className="bt-back"><rect x="30" y="62" width="20" height="16" rx="6" fill="url(#bt-metal)" /><rect x="33" y="66" width="14" height="2" rx="1" fill={c} opacity="0.85" /><rect x="33" y="71" width="14" height="2" rx="1" fill={c} opacity="0.45" /></g>
					<rect x="24" y="80" width="32" height="3" rx="1.5" fill="rgba(0,0,0,0.18)" />
					<g className="bt-arm bt-arm-r" style={{ transformOrigin: "61px 58px" }}>
						<rect x="59" y="55" width="9" height="26" rx="4.5" fill="url(#bt-body2)" /><circle cx="63.5" cy="82" r="5" fill="#26302a" /><circle cx="63.5" cy="57" r="5" fill="#26302a" />
						<g className="bt-cup"><rect x="59" y="80" width="9" height="10" rx="2" fill="#f4f7f2" /><rect x="59" y="83" width="9" height="2.4" fill={c} /><path d="M62 77 q-2 -4 1 -7 M66 77 q-2 -4 1 -7" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.2" strokeLinecap="round" className="bt-steam" /></g>
					</g>
					<g className="bt-head" style={{ transformOrigin: "40px 52px" }}>
						<rect x="35" y="47" width="10" height="7" rx="2" fill="#26302a" />
						<ellipse cx="10" cy="33" rx="3.4" ry="7" fill={c} opacity="0.9" /><ellipse cx="70" cy="33" rx="3.4" ry="7" fill={c} opacity="0.9" />
						<rect x="12" y="14" width="56" height="38" rx="17" fill="url(#bt-body)" />
						<path d="M20 22 Q40 12 60 22" fill="none" stroke="#fff" strokeOpacity="0.85" strokeWidth="2" strokeLinecap="round" />
						<g className="bt-front">
							<rect x="18" y="20" width="44" height="27" rx="12" fill="url(#bt-visor)" />
							<path d="M24 25 Q34 21 44 24" fill="none" stroke="#fff" strokeOpacity="0.22" strokeWidth="2.2" strokeLinecap="round" />
							<g className="rb-eyes" style={{ transformOrigin: "40px 34px" }}>
								<rect x="26" y="28" width="8" height="11" rx="4" fill={eye} filter="url(#f-glow)" />
								<rect x="46" y="28" width="8" height="11" rx="4" fill={eye} filter="url(#f-glow)" />
							</g>
						</g>
						<g className="bt-back"><path d="M22 26 Q40 20 58 26" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" opacity="0.9" /><rect x="30" y="31" width="20" height="3" rx="1.5" fill="rgba(0,0,0,0.12)" /><rect x="30" y="37" width="20" height="3" rx="1.5" fill="rgba(0,0,0,0.10)" /></g>
						{boss ? (
							<g filter="url(#f-glow)"><path d="M22 14 L26 4 L32 10 L40 1 L48 10 L54 4 L58 14 Z" fill={c} /></g>
						) : (
							<g><line x1="40" y1="14" x2="40" y2="5" stroke="#8a978b" strokeWidth="2.2" strokeLinecap="round" /><circle className="rb-ant" cx="40" cy="4" r="3.4" fill={c} filter="url(#f-glow)" /></g>
						)}
					</g>
				</g>
			</g>
		</svg>
	);
}
