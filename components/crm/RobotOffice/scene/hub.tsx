import React from "react";
import { HUB, P, TH, TW, pt } from "./iso";
import { Band, arcPts, type Pt } from "./glass";
import Bot from "./Bot";

// Рабочее место Айрис: светящаяся круглая платформа с кольцами, за спиной — изогнутый голографический экран с диаграммами,
// впереди — низкая лента с потоком данных. Нажатие — к полю поручения; сюда же можно бросить карточку поручения.
const LIME = "#c6ff4d", TEAL = "#2DDEB6", R2 = Math.SQRT2;

export default function Hub({ boss, onFocus }: { boss: boolean; onFocus: () => void }) {
	const [cx, cy] = pt(HUB.x, HUB.y, 0);
	const ell = (r: number, z = 0) => ({ cx, cy: cy - z, rx: r * TW * 0.5 * R2, ry: r * TH * 0.5 * R2 });
	const arc = (r: number, a0: number, a1: number, n = 16): Pt[] => arcPts(HUB.x, HUB.y, r, a0, a1, n);
	const back = arc(2.15, 140, 310, 16);
	const barH = [14, 22, 18, 30, 24, 34, 28, 38, 30, 26, 32, 20, 16, 24, 18, 12, 10];
	const front = arc(2.0, 15, 125, 12);
	const platTop = 15;
	return (
		<g data-drop-robot="iris" onClick={onFocus} style={{ cursor: "pointer" }}>
			<ellipse {...ell(3.9)} fill="url(#g-holo)" opacity="0.7" />
			<ellipse {...ell(3.5)} fill="none" stroke={LIME} strokeOpacity="0.5" strokeWidth="1.4" strokeDasharray="3 8" className="sc-dash" />
			<ellipse {...ell(3.1)} fill="none" stroke={TEAL} strokeOpacity="0.55" strokeWidth="1.2" strokeDasharray="14 10" className="sc-dash-rev" />
			<ellipse {...ell(2.6)} fill="rgba(8,12,10,0.85)" stroke={LIME} strokeOpacity="0.9" strokeWidth="2" filter="url(#f-glow)" />
			{/* изогнутый экран позади */}
			<g style={{ pointerEvents: "none" }}>
				<Band pts={back} z0={20} z1={86} fill="url(#g-glass2)" edge={LIME} edgeOp={0.95} />
				{back.slice(0, -1).map(([x, y], i) => {
					const [x2, y2] = back[i + 1];
					const h = barH[i % barH.length] * 1.25;
					const k = 0.18, ax = x + (x2 - x) * k, ay = y + (y2 - y) * k, bx = x + (x2 - x) * (1 - k), by = y + (y2 - y) * (1 - k);
					return <polygon key={i} className="sc-pulse" style={{ animationDelay: `${i * 0.18}s` }} points={[P(ax, ay, 26), P(bx, by, 26), P(bx, by, 26 + h), P(ax, ay, 26 + h)].join(" ")} fill={i % 3 === 1 ? TEAL : LIME} opacity="0.8" />;
				})}
			</g>
			{/* платформа */}
			<ellipse {...ell(1.75, 0)} fill="#0b100d" />
			<path d={`M${cx - ell(1.75).rx} ${cy} L${cx - ell(1.75).rx} ${cy - platTop} A${ell(1.75).rx} ${ell(1.75).ry} 0 0 0 ${cx + ell(1.75).rx} ${cy - platTop} L${cx + ell(1.75).rx} ${cy} A${ell(1.75).rx} ${ell(1.75).ry} 0 0 1 ${cx - ell(1.75).rx} ${cy} Z`} fill="#222c26" />
			<path d={`M${cx - ell(1.75).rx} ${cy - 6} A${ell(1.75).rx} ${ell(1.75).ry} 0 0 0 ${cx + ell(1.75).rx} ${cy - 6}`} fill="none" stroke={LIME} strokeWidth="1.4" strokeOpacity="0.85" filter="url(#f-glow)" />
			<ellipse {...ell(1.75, platTop)} fill="#2d3a32" stroke={LIME} strokeWidth="2" filter="url(#f-glow)" />
			<ellipse {...ell(1.2, platTop)} fill="rgba(198,255,77,0.2)" className={boss ? "sc-pulse" : undefined} />
			<rect x={cx - ell(1.2).rx} y={cy - platTop - 130} width={ell(1.2).rx * 2} height="130" fill="url(#g-beam)" opacity="0.5" style={{ pointerEvents: "none" }} />
			{/* Айрис */}
			<g transform={`translate(${cx - 54} ${cy - platTop - 131}) scale(1.35)`}><Bot accent="lime" boss state={boss ? "working" : "idle"} /></g>
			{/* лента данных впереди */}
			<g style={{ pointerEvents: "none" }}>
				<Band pts={front} z0={12} z1={40} fill="url(#g-glass2)" edge={TEAL} edgeOp={0.95} />
				{[18, 25, 32].map((z, k) => <polyline key={z} className="sc-dash" points={front.map(([x, y]) => P(x, y, z)).join(" ")} fill="none" stroke={k === 1 ? LIME : TEAL} strokeOpacity="0.8" strokeWidth="1.4" strokeDasharray="5 4" />)}
			</g>
			<g transform={`translate(${cx} ${cy + 34})`} style={{ pointerEvents: "none" }}>
				<rect x="-34" y="-11" width="68" height="22" rx="11" fill="rgba(8,12,10,0.92)" stroke={LIME} strokeOpacity="0.9" filter="url(#f-glow)" />
				<text x="0" y="4.8" textAnchor="middle" fontSize="12.5" fontWeight="700" fill={LIME} letterSpacing="2">AYRIS</text>
			</g>
		</g>
	);
}
