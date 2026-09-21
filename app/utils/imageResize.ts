// Фото с телефона весят 3–8 МБ, а загрузка ограничена 4 МБ. Большие картинки уменьшаем в браузере (до 2048 px по длинной стороне,
// JPEG) — на экране разницы не видно. Если что-то пошло не так, возвращаем исходный файл.
const LIMIT = 1.5 * 1024 * 1024;
const MAX_SIDE = 2048;

export async function shrinkImage(file: File): Promise<File> {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size <= LIMIT) return file;
    try {
        const bmp = await createImageBitmap(file);
        const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(bmp.width * scale);
        canvas.height = Math.round(bmp.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return file;
        ctx.fillStyle = "#FFFFFF"; // у PNG с прозрачностью фон станет белым, а не чёрным
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
        if (!blob || blob.size >= file.size) return file;
        return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
    } catch {
        return file;
    }
}
