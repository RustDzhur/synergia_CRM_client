const AVATAR_SIZE = 256;
export const MAX_AVATAR_FILE_BYTES = 5 * 1024 * 1024;

// Обрезает картинку по центру до квадрата 256×256 и сжимает в JPEG — в базу уходит ~20–40 КБ.
export async function fileToAvatar(file: File): Promise<string> {
	const url = URL.createObjectURL(file);
	try {
		const img = await new Promise<HTMLImageElement>((resolve, reject) => {
			const image = new Image();
			image.onload = () => resolve(image);
			image.onerror = reject;
			image.src = url;
		});
		const canvas = document.createElement("canvas");
		canvas.width = AVATAR_SIZE;
		canvas.height = AVATAR_SIZE;
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("canvas");
		ctx.fillStyle = "#ffffff"; // у PNG с прозрачностью фон иначе станет чёрным
		ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
		const side = Math.min(img.width, img.height);
		ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
		return canvas.toDataURL("image/jpeg", 0.85);
	} finally {
		URL.revokeObjectURL(url);
	}
}
