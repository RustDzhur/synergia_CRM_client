const AVATAR_SIZE = 256;
// Логотип для финансовых документов: без обрезки, картинка вписывается в рамку 640×240 — в шапке PDF она
// занимает максимум 160×44 pt, а data-URL остаётся заметно ниже лимита API (400 000 символов).
const LOGO_MAX_WIDTH = 640;
const LOGO_MAX_HEIGHT = 240;
export const MAX_AVATAR_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_LOGO_CHARS = 400_000; // столько принимает PATCH /api/finance/settings для logo

// Общий шаг для аватара и логотипа: файл → загруженный <img>, дальше вызывающая функция рисует его на canvas.
async function loadImage(file: File): Promise<HTMLImageElement> {
	const url = URL.createObjectURL(file);
	try {
		return await new Promise<HTMLImageElement>((resolve, reject) => {
			const image = new Image();
			image.onload = () => resolve(image);
			image.onerror = reject;
			image.src = url;
		});
	} finally {
		URL.revokeObjectURL(url);
	}
}

// Canvas сразу с белой заливкой: у PNG с прозрачностью фон иначе станет чёрным, а страница документа белая.
function canvasOf(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("canvas");
	ctx.fillStyle = "#ffffff";
	ctx.fillRect(0, 0, width, height);
	return [canvas, ctx];
}

// Обрезает картинку по центру до квадрата 256×256 и сжимает в JPEG — в базу уходит ~20–40 КБ.
export async function fileToAvatar(file: File): Promise<string> {
	const img = await loadImage(file);
	const [canvas, ctx] = canvasOf(AVATAR_SIZE, AVATAR_SIZE);
	const side = Math.min(img.width, img.height);
	ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
	return canvas.toDataURL("image/jpeg", 0.85);
}

// Логотип фирмы для шапки финансовых документов: пропорции сохраняются, маленькие картинки не растягиваются.
export async function fileToLogo(file: File): Promise<string> {
	const img = await loadImage(file);
	const scale = Math.min(1, LOGO_MAX_WIDTH / img.width, LOGO_MAX_HEIGHT / img.height);
	const w = Math.max(1, Math.round(img.width * scale));
	const h = Math.max(1, Math.round(img.height * scale));
	const [canvas, ctx] = canvasOf(w, h);
	ctx.drawImage(img, 0, 0, w, h);
	return canvas.toDataURL("image/jpeg", 0.85);
}
