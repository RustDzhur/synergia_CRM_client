import type { Accent } from "@/store/useOfficeStore";
import { ACCENT_HEX, type RobotState } from "./theme";

// Робот — простая векторная фигурка в цветах платформы. Состояния показаны мягко: покачивание, моргание, «печатающие» руки,
// пульс индикатора на груди (стили rb-* в globals.css; при «уменьшить анимацию» всё замирает).
export default function RobotAvatar({ accent, size = 56, state = "idle", boss = false }: { accent: Accent; size?: number; state?: RobotState; boss?: boolean }) {
	const c = ACCENT_HEX[accent];
	const light = state === "waiting" ? "#F4A100" : state === "failed" ? "#EB5757" : c;
	return (
		<svg viewBox="0 0 64 64" width={size} height={size} className={`rb rb-${state}`} aria-hidden>
			{boss && <circle cx="32" cy="35" r="30" fill={c} opacity="0.08" />}
			<g className="rb-body">
				{boss ? (
					<path d="M21 14 L24 7 L28.5 11.5 L32 5.5 L35.5 11.5 L40 7 L43 14 Z" fill={c} />
				) : (
					<>
						<line x1="32" y1="7.5" x2="32" y2="14" stroke={c} strokeWidth="2" strokeLinecap="round" />
						<circle className="rb-ant" cx="32" cy="5.6" r="2.8" fill={c} />
					</>
				)}
				<rect x="9" y="23" width="4" height="11" rx="2" fill={c} opacity="0.85" />
				<rect x="51" y="23" width="4" height="11" rx="2" fill={c} opacity="0.85" />
				<rect x="13" y="14" width="38" height="27" rx="10" fill="#e8ede4" />
				<rect x="18" y="19" width="28" height="16" rx="7" fill="#0f1411" />
				<g className="rb-eyes">
					<rect x="23.5" y="23.5" width="5" height="7" rx="2.5" fill={c} />
					<rect x="35.5" y="23.5" width="5" height="7" rx="2.5" fill={c} />
				</g>
				<rect className="rb-arm rb-arm-l" x="11.5" y="44" width="5" height="12" rx="2.5" fill="#b9c2b5" />
				<rect className="rb-arm rb-arm-r" x="47.5" y="44" width="5" height="12" rx="2.5" fill="#b9c2b5" />
				<rect x="20" y="43" width="24" height="15" rx="7" fill="#cdd5c9" />
				<circle className="rb-light" cx="32" cy="50.5" r="3" fill={light} />
			</g>
		</svg>
	);
}
