import React from "react";
import type { DocType } from "@/app/store/useCollabStore";

export const DOC_COLORS: Record<DocType, string> = { docx: "#5EA8F5", xlsx: "#7CB305", pptx: "#FAB300" };

// Значок документа как в макете: контур листа с загнутым уголком и подписью формата (DOCX / XLSX / PPTX).
export default function FileTypeIcon({ type, size = 90, withLabel = true }: { type: DocType; size?: number; withLabel?: boolean }) {
	const color = DOC_COLORS[type];
	return (
		<svg width={size} height={size * (withLabel ? 1.05 : 0.85)} viewBox={`0 0 90 ${withLabel ? 95 : 76}`} role="img" aria-label={type.toUpperCase()}>
			<path d="M11 62V14a7 7 0 0 1 7-7h32l22 22v33" fill="none" stroke={color} strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" />
			<path d="M50 7v22h22z" fill={color} />
			{withLabel && (
				<text x="45" y="92" textAnchor="middle" fill={color} fontFamily="Inter, sans-serif" fontSize="28" fontWeight="600">
					{type.toUpperCase()}
				</text>
			)}
		</svg>
	);
}
