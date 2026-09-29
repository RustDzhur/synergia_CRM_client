import React from "react";
import Image from "next/image";

interface Props {
	src?: string; // data-URL из загрузки в профиле или внешний URL
	initials: string; // что показать, если фото нет
	size: number; // диаметр в px
	// display и размер текста; по умолчанию flex и text-16
	className?: string;
	// цвет круга-заглушки: в тёмном кабинете подвал сайдбара подкрашивает его акцентом,
	// поэтому фон задаётся стилем, а не классом (класс перебивался бы bg-[#D9D9D9] ниже)
	style?: React.CSSProperties;
}

// Круглая аватарка: фото или серый круг (#D9D9D9) с инициалами.
// `unoptimized` — фото уже сжато до 256×256 при загрузке (app/utils/avatar.ts), а адрес может быть любым,
// поэтому оптимизатор изображений Next.js (и список разрешённых доменов) здесь не нужен.
export default function Avatar({ src, initials, size, className = "flex text-16", style }: Props) {
	return (
		<span
			style={{ width: size, height: size, ...style }}
			className={`shrink-0 items-center justify-center overflow-hidden rounded-50 bg-[#D9D9D9] font-medium text-white ${className}`}>
			{src ? (
				<Image src={src} alt="" width={size} height={size} unoptimized className="h-full w-full object-cover" />
			) : (
				initials
			)}
		</span>
	);
}
