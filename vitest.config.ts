import { defineConfig } from "vitest/config";
import path from "node:path";
import fs from "node:fs";

// Шрифты .ttf в приложении подключает webpack-загрузчик (scripts/ttf-data-uri-loader.js) и отдаёт data-URI;
// в тестах ту же работу делает этот плагин — иначе рендер PDF в тестах падает на «Unknown font format».
const ttfDataUri = {
    name: "ttf-data-uri",
    enforce: "pre" as const,
    load(id: string) {
        if (!id.endsWith(".ttf")) return null;
        return `export default ${JSON.stringify(`data:font/ttf;base64,${fs.readFileSync(id).toString("base64")}`)};`;
    },
};

export default defineConfig({
    plugins: [ttfDataUri],
    resolve: { alias: { "@": path.resolve(__dirname) } },
    test: { include: ["tests/**/*.test.ts"], testTimeout: 30_000, hookTimeout: 60_000, fileParallelism: false },
});
