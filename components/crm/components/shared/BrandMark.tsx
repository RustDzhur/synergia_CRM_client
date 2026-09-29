import "react";

// Знак бренда: салатовая плитка со скруглением и тёмный четырёхлучевой блик внутри.
// Рисуется кодом, а не картинкой: масштабируется без потерь и не тянет ассет ради двух цветов.
export default function BrandMark({ size = 28 }: { size?: number }) {
	const radius = Math.round(size * 0.32);
	return (
		<span
			style={{ width: size, height: size, borderRadius: radius }}
			className="flex shrink-0 items-center justify-center bg-[#c6ff4d]">
			<svg width={size * 0.57} height={size * 0.57} viewBox="0 0 16 16" fill="none" aria-hidden>
				<path
					d="M8 .6c.35 3.2 1.6 4.45 4.8 4.8-3.2.35-4.45 1.6-4.8 4.8-.35-3.2-1.6-4.45-4.8-4.8C6.4 5.05 7.65 3.8 8 .6Z"
					fill="#0a0c0b"
				/>
				<path
					d="M11.9 9.6c.18 1.62.81 2.25 2.43 2.43-1.62.18-2.25.81-2.43 2.43-.18-1.62-.81-2.25-2.43-2.43 1.62-.18 2.25-.81 2.43-2.43Z"
					fill="#0a0c0b"
				/>
			</svg>
		</span>
	);
}
