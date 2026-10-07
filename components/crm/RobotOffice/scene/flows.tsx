import React from "react";
import { HUB, pt } from "./iso";

// Потоки поручений: неоновые линии от платформы Айрис к зонам и к рабочим местам тех, кто сейчас занят. По линиям бегут светящиеся кубы данных.
export interface Flow { id: string; to: [number, number]; color: string; live: boolean; strong?: boolean }

const cube = (c: string) => (
	<g transform="translate(0 -5)">
		<polygon points="0,-5.5 7.5,-1.6 0,2.3 -7.5,-1.6" fill="#fff" fillOpacity="0.95" />
		<polygon points="-7.5,-1.6 0,2.3 0,10 -7.5,6" fill={c} fillOpacity="0.95" />
		<polygon points="7.5,-1.6 0,2.3 0,10 7.5,6" fill={c} fillOpacity="0.6" />
	</g>
);

export default function Flows({ flows }: { flows: Flow[] }) {
	const [hx, hy] = pt(HUB.x, HUB.y, 0);
	return (
		<g style={{ pointerEvents: "none" }}>
			{flows.map((f, i) => {
				const [tx, ty] = pt(f.to[0], f.to[1], 0);
				const mx = (hx + tx) / 2, my = (hy + ty) / 2;
				const nx = -(ty - hy), ny = tx - hx, len = Math.hypot(nx, ny) || 1;
				const bend = (f.strong ? 0.14 : 0.2) * (i % 2 ? 1 : -1);
				const qx = mx + (nx / len) * len * bend, qy = my + (ny / len) * len * bend;
				const d = `M${hx.toFixed(1)} ${hy.toFixed(1)} Q${qx.toFixed(1)} ${qy.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}`;
				const id = `flow-${f.id}`;
				return (
					<g key={f.id}>
						<path id={id} d={d} fill="none" stroke={f.color} strokeOpacity={f.live ? 0.28 : 0.1} strokeWidth={f.live ? 9 : 6} strokeLinecap="round" filter="url(#f-soft)" />
						<path d={d} fill="none" stroke={f.color} strokeOpacity={f.live ? 0.95 : 0.38} strokeWidth={f.strong ? 2 : 1.5} strokeLinecap="round" strokeDasharray={f.live ? "7 5" : "2 7"} className="sc-dash" filter={f.live ? "url(#f-glow)" : undefined} />
						<circle cx={tx} cy={ty} r={f.live ? 5 : 3.5} fill={f.color} opacity={f.live ? 0.95 : 0.5} filter="url(#f-glow)" />
						{(f.live ? [0, 1, 2] : [0]).map((k) => (
							<g key={k} opacity={f.live ? 1 : 0.55} filter="url(#f-glow)">
								{cube(f.color)}
								<animateMotion dur={f.live ? "2.4s" : "7s"} begin={`${k * 0.8 + (i % 4) * 0.35}s`} repeatCount="indefinite"><mpath href={`#${id}`} /></animateMotion>
							</g>
						))}
					</g>
				);
			})}
		</g>
	);
}
