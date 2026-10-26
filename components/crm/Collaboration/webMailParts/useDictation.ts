"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { authHeaders } from "@/store/crmApi";
import { dictationLanguage } from "./composeHtml";

// Диктовка письма: MediaRecorder пишет микрофон, запись уходит на /api/mail/transcribe,
// распознанный текст вставляется в тело письма (остаётся обычным редактируемым текстом).
// Ограничения: 2 минуты записи (останавливаем сами) и 8 МБ (сервер тоже проверяет).
export const MAX_DICTATION_SECONDS = 120;
export const MAX_DICTATION_BYTES = 8 * 1024 * 1024;

export type DictationState = "idle" | "recording" | "transcribing";
export type DictationError = "micDenied" | "micUnavailable" | "sttUnavailable" | "tooLong" | "noSpeech" | "failed";

const voiceExt = (type: string) => (type.includes("mp4") ? "mp4" : type.includes("ogg") ? "ogg" : type.includes("wav") ? "wav" : "webm");

export function useDictation({ locale, onText }: { locale: string; onText: (text: string) => void }) {
    const [state, setState] = useState<DictationState>("idle");
    const [seconds, setSeconds] = useState(0);
    const [error, setError] = useState<DictationError | null>(null);
    const stateRef = useRef<DictationState>("idle");
    const recorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startedAtRef = useRef(0);
    const cancelledRef = useRef(false);
    // Номер записи: показ распознанного текста, пришедшего после закрытия окна, отменяется
    const generationRef = useRef(0);
    const onTextRef = useRef(onText);
    onTextRef.current = onText;

    const set = (s: DictationState) => {
        stateRef.current = s;
        setState(s);
    };
    const clearTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };
    const stopTracks = () => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
    };

    const upload = useCallback(async (blob: Blob, duration: number, generation: number) => {
        set("transcribing");
        const body = new FormData();
        body.append("file", blob, `dictation.${voiceExt(blob.type || "audio/webm")}`);
        body.append("language", dictationLanguage(locale));
        body.append("duration", String(Math.round(duration)));
        const send = () => fetch("/api/mail/transcribe", { method: "POST", headers: authHeaders(false), body });
        try {
            let res = await send();
            if (generation !== generationRef.current) return;
            // Временный отказ (занят, 5xx, обрыв) — один повтор; остальные ошибки повторять бессмысленно
            if (!res.ok && [429, 500, 502, 503, 504].includes(res.status)) {
                await new Promise((r) => setTimeout(r, 800));
                if (generation !== generationRef.current) return;
                res = await send();
            }
            const json = (await res.json().catch(() => null)) as { text?: string; message?: string; code?: string } | null;
            if (generation !== generationRef.current) return;
            if (res.status === 503) return void setError("sttUnavailable");
            if (res.status === 400 && /too (big|long)|under two minutes/i.test(json?.message ?? "")) return void setError("tooLong");
            if (!res.ok || !json) {
                return void setError("failed");
            }
            const text = String(json.text ?? "").trim();
            if (!text) return void setError("noSpeech");
            onTextRef.current(text);
        } catch {
            if (generation === generationRef.current) setError("failed");
        } finally {
            if (stateRef.current !== "idle") set("idle");
        }
    }, [locale]);

    const stop = useCallback(() => {
        const rec = recorderRef.current;
        if (!rec || rec.state !== "recording") return;
        try {
            rec.stop();
        } catch {
            /* уже остановился сам */
        }
    }, []);

    // Закрытие окна письма: запись прекращается и никуда не отправляется
    const cancel = useCallback(() => {
        cancelledRef.current = true;
        generationRef.current += 1;
        clearTimer();
        const rec = recorderRef.current;
        if (rec?.state === "recording") {
            try {
                rec.stop();
            } catch {
                /* уже остановился сам */
            }
        } else {
            stopTracks();
            if (stateRef.current !== "idle") set("idle");
        }
    }, []);

    const start = useCallback(async () => {
        if (stateRef.current === "recording") return void stop();
        if (stateRef.current !== "idle") return;
        setError(null);
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
            setError("micUnavailable");
            return;
        }
        const generation = ++generationRef.current;
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e) {
            const name = (e as { name?: string })?.name ?? "";
            if (generation === generationRef.current) setError(name === "NotAllowedError" || name === "SecurityError" ? "micDenied" : name === "NotFoundError" ? "micUnavailable" : "failed");
            return;
        }
        if (generation !== generationRef.current) {
            stream.getTracks().forEach((t) => t.stop());
            return;
        }
        const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => {
            try {
                return MediaRecorder.isTypeSupported(t);
            } catch {
                return false;
            }
        });
        let recorder: MediaRecorder;
        try {
            recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
        } catch {
            stream.getTracks().forEach((t) => t.stop());
            setError("micUnavailable");
            return;
        }
        const chunks: Blob[] = [];
        cancelledRef.current = false;
        recorder.ondataavailable = (e) => {
            if (e.data.size) chunks.push(e.data);
        };
        recorder.onstop = () => {
            clearTimer();
            stopTracks();
            recorderRef.current = null;
            const duration = Math.max(0, (Date.now() - startedAtRef.current) / 1000);
            const type = recorder.mimeType || mime || "audio/webm";
            const blob = new Blob(chunks, { type });
            setSeconds(0);
            if (cancelledRef.current) {
                cancelledRef.current = false;
                set("idle");
                return;
            }
            if (!blob.size) {
                set("idle");
                setError("noSpeech");
                return;
            }
            if (blob.size > MAX_DICTATION_BYTES) {
                set("idle");
                setError("tooLong");
                return;
            }
            void upload(blob, duration, generation);
        };
        recorderRef.current = recorder;
        streamRef.current = stream;
        startedAtRef.current = Date.now();
        setSeconds(0);
        set("recording");
        recorder.start(250);
        clearTimer();
        timerRef.current = setInterval(() => {
            const elapsed = (Date.now() - startedAtRef.current) / 1000;
            setSeconds(Math.floor(elapsed));
            if (elapsed >= MAX_DICTATION_SECONDS) {
                // Предел длительности: останавливаем запись сами, ничего не теряя — распознаем записанное
                clearTimer();
                try {
                    recorder.state === "recording" && recorder.stop();
                } catch {
                    /* уже остановлена */
                }
            }
        }, 250);
    }, [stop, upload]);

    // Уход с окна/страницы во время записи не должен оставлять микрофон включённым
    useEffect(
        () => () => {
            generationRef.current += 1;
            clearTimer();
            try {
                if (recorderRef.current?.state === "recording") {
                    cancelledRef.current = true;
                    recorderRef.current.stop();
                }
            } catch {
                /* уже остановлена */
            }
            stopTracks();
        },
        []
    );

    return { state, seconds, error, start, stop, cancel, clearError: () => setError(null) };
}
