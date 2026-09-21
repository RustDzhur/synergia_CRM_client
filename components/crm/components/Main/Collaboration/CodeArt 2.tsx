import React from "react";

const LINES = [
	"return t.area-e.area}),a=d.filter(function(e){var",
	"width,height,p.bottom-1===e.indexOf('auto'))return",
	"1+(f?'-'+f:''))}function x(e,t,o){var e;var p",
	"top:'top',bottom:'bottom'};function T(e){return",
	"parseFloat(t.marginLeft)+parseFloat(t.padding)",
	"i=-1==[L(s)],n}function(e,t){return e.left+p",
];
const COLORS = ["#E8506B", "#2DDEB6", "#F4A100", "#5EA8F5", "#C678DD", "#98C379"];

// Замена фотографии из ленты (в макете — снимок кода): тёмная картинка с цветными строками кода.
export default function CodeArt({ className = "" }: { className?: string }) {
	return (
		<svg viewBox="0 0 400 200" role="img" aria-label="code" preserveAspectRatio="xMidYMid slice" className={className}>
			<rect width="400" height="200" fill="#10151C" />
			<g transform="rotate(20 200 100) translate(-90 -70)" fontFamily="ui-monospace, Menlo, monospace" fontSize="15" fontWeight="600">
				{Array.from({ length: 12 }, (_, i) => (
					<text key={i} x={(i % 3) * -40} y={i * 24} fill={COLORS[i % COLORS.length]}>
						{LINES[i % LINES.length]} {LINES[(i + 2) % LINES.length]}
					</text>
				))}
			</g>
		</svg>
	);
}
