// Патч 3 для Harness: голосовой ввод на русском.
// Штатный распознаватель Harness (SenseVoice) знает только китайский, английский, японский и корейский. Здесь его регистрация подменяется
// на Whisper: сначала облачный whisper-large-v3-turbo через OpenAI (быстро и точно, тот же ключ OPENAI_API_KEY, что у Harness),
// запасной — свой Whisper на сервере (speaches, 127.0.0.1:8000). Микрофон работает сразу, скачивать модели SenseVoice не нужно.
// Запуск: node patch-stt.mjs [каталог @deepseek-ai]; повторный запуск ничего не меняет.
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2] || "/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai";
const file = path.join(root, "dsh-experimental-speech-to-text-sensevoice/lib/index.js");
const service = path.join(root, "dsh-experimental-speech-to-text/lib/index.js");
let s = fs.readFileSync(file, "utf8");
const MARK = "/* firmspace-whisper-patch */";

if (!s.includes(MARK)) {
    // 1. языки в списке выбора
    const langs = /const languages = \[[^\]]*\];/;
    if (!langs.test(s)) throw new Error("languages list not found");
    s = s.replace(langs, 'const languages = ["auto", "ru", "uk", "de", "en", "zh", "ja", "ko", "yue"];');

    // 2. регистрация: без этапа подготовки моделей, транскрипция — через Whisper
    const reg = /preparation: worker,\s*transcribe: async \(input, signal\) => await worker\.transcribe\(input, signal\)/;
    if (!reg.test(s)) throw new Error("register block not found");
    s = s.replace(reg, "transcribe: whisperTranscribe");
    // id провайдера — whisper-local: именно его выбирает пользовательский слой профиля (~/.dsh/profiles/web/cordis.patch.yml: defaultProvider, language ru)
    if (!/id: config\.providerId,/.test(s)) throw new Error("provider id not found");
    s = s.replace(/id: config\.providerId,/, 'id: "whisper-local",');
    s = s.replace(/name: `SenseVoiceSmall \(\$\{config\.precision\.toUpperCase\(\)\}\)`/, 'name: "Whisper (русский, сервер)"');

    // 3. сама функция — после первой строки import
    const fn = `${MARK}
const WHISPER_TARGETS = () => {
	const targets = [];
	if (process.env.OPENAI_API_KEY) targets.push({ url: (process.env.STT_CLOUD_URL || "https://api.openai.com/v1").replace(/\\/+$/, ""), key: process.env.OPENAI_API_KEY, model: process.env.STT_CLOUD_MODEL || "whisper-1" });
	targets.push({ url: (process.env.STT_LOCAL_URL || "http://127.0.0.1:8000/v1").replace(/\\/+$/, ""), model: process.env.STT_LOCAL_MODEL || "Systran/faster-whisper-small" });
	return targets;
};
async function whisperTranscribe(input, signal) {
	const started = Date.now();
	const audioSeconds = Math.max(0, (input.audio.byteLength - 44) / 32000); // WAV 16 кГц, моно, 16 бит
	let lastError = new Error("No speech recognizer is reachable");
	for (const target of WHISPER_TARGETS()) {
		try {
			const form = new FormData();
			form.append("file", new Blob([input.audio], { type: "audio/wav" }), "speech.wav");
			form.append("model", target.model);
			form.append("response_format", "json");
			if (input.language && input.language !== "auto") form.append("language", input.language);
			const res = await fetch(target.url + "/audio/transcriptions", { method: "POST", headers: target.key ? { Authorization: "Bearer " + target.key } : {}, body: form, signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]) });
			if (!res.ok) throw new Error("Recognizer answered " + res.status);
			const json = await res.json();
			return { text: String(json.text || "").trim(), audioSeconds, inferenceSeconds: (Date.now() - started) / 1000 };
		} catch (e) {
			if (signal.aborted) throw e;
			lastError = e; // облако не ответило — пробуем свой Whisper
		}
	}
	throw lastError;
}
`;
    const firstImportEnd = s.indexOf("\n", s.indexOf("import "));
    s = s.slice(0, firstImportEnd + 1) + fn + s.slice(firstImportEnd + 1);
    fs.writeFileSync(file, s);
    console.log("patched", file);
} else console.log("already patched", file);

// 4. язык по умолчанию — русский (можно сменить в интерфейсе)
let svc = fs.readFileSync(service, "utf8");
if (svc.includes('language: z.string().min(1).default("auto").volatile()')) {
    fs.writeFileSync(service, svc.replace('language: z.string().min(1).default("auto").volatile()', 'language: z.string().min(1).default("ru").volatile()'));
    console.log("default language ru");
}
