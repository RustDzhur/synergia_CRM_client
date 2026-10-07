import React from "react";
import { ROOMS } from "./iso";

// Общие «источники света» сцены: свечение неона, мягкие тени, стекло, блики на полу. Подключаются один раз в <defs>.
export const ZONE_LIGHT: Record<string, string> = { sales: "#c6ff4d", finance: "#2DDEB6", warehouse: "#F4A100", office: "#B8A2FF", marketing: "#FF8A7A", service: "#7CC4FF" };

export default function SceneDefs() {
	return (
		<defs>
			<filter id="f-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
			<filter id="f-bloom" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="6" /></filter>
			<filter id="f-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.5" /></filter>
			<clipPath id="sc-clip"><rect x="2" y="2" width="42" height="17" /></clipPath>
			<linearGradient id="sc-glow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c6ff4d" stopOpacity="0.34" /><stop offset="1" stopColor="#c6ff4d" stopOpacity="0" /></linearGradient>
			{/* подсветка граней предметов: сверху светлее, у пола темнее */}
			<linearGradient id="g-left" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.16" /><stop offset="1" stopColor="#000" stopOpacity="0.30" /></linearGradient>
			<linearGradient id="g-right" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.06" /><stop offset="1" stopColor="#000" stopOpacity="0.38" /></linearGradient>
			<linearGradient id="g-top" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.22" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
			{/* стеклянная стена: светлеет к верху, по краю — неоновая линия */}
			<linearGradient id="g-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7fffd4" stopOpacity="0.20" /><stop offset="0.6" stopColor="#2DDEB6" stopOpacity="0.07" /><stop offset="1" stopColor="#c6ff4d" stopOpacity="0.14" /></linearGradient>
			<linearGradient id="g-sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.12" /><stop offset="0.45" stopColor="#fff" stopOpacity="0.02" /><stop offset="1" stopColor="#000" stopOpacity="0.22" /></linearGradient>
			<linearGradient id="g-floor" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#36443c" /><stop offset="1" stopColor="#1b2420" /></linearGradient>
			<linearGradient id="g-glass2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#bffff0" stopOpacity="0.30" /><stop offset="0.55" stopColor="#7fffd4" stopOpacity="0.10" /><stop offset="1" stopColor="#c6ff4d" stopOpacity="0.20" /></linearGradient>
			<linearGradient id="g-streak" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.16" /><stop offset="0.35" stopColor="#fff" stopOpacity="0" /><stop offset="0.6" stopColor="#fff" stopOpacity="0.08" /><stop offset="0.7" stopColor="#fff" stopOpacity="0" /></linearGradient>
			<linearGradient id="g-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0c1411" /><stop offset="1" stopColor="#1d3a2c" /></linearGradient>
			<linearGradient id="g-cyl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity="0.22" /><stop offset="0.35" stopColor="#fff" stopOpacity="0.02" /><stop offset="1" stopColor="#000" stopOpacity="0.45" /></linearGradient>
			<radialGradient id="g-beam" cx="0.5" cy="1" r="0.9"><stop offset="0" stopColor="#c6ff4d" stopOpacity="0.34" /><stop offset="1" stopColor="#c6ff4d" stopOpacity="0" /></radialGradient>
			<radialGradient id="g-holo" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#c6ff4d" stopOpacity="0.40" /><stop offset="0.7" stopColor="#c6ff4d" stopOpacity="0.10" /><stop offset="1" stopColor="#c6ff4d" stopOpacity="0" /></radialGradient>
			{ROOMS.map((r) => (
				<React.Fragment key={r.zone}>
					<radialGradient id={`pool-${r.zone}`} cx="0.5" cy="0.5" r="0.62"><stop offset="0" stopColor={ZONE_LIGHT[r.zone]} stopOpacity="0.26" /><stop offset="1" stopColor={ZONE_LIGHT[r.zone]} stopOpacity="0" /></radialGradient>
				</React.Fragment>
			))}
			{/* робот: корпус, визор, суставы */}
			<linearGradient id="bt-body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fbfdf9" /><stop offset="0.55" stopColor="#dde5da" /><stop offset="1" stopColor="#9aa89a" /></linearGradient>
			<linearGradient id="bt-body2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#eef2ea" /><stop offset="1" stopColor="#7e8b7f" /></linearGradient>
			<radialGradient id="bt-visor" cx="0.4" cy="0.3" r="0.9"><stop offset="0" stopColor="#1d2b22" /><stop offset="1" stopColor="#040a06" /></radialGradient>
			<linearGradient id="bt-metal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#2f3a33" /><stop offset="1" stopColor="#141a16" /></linearGradient>
		</defs>
	);
}
