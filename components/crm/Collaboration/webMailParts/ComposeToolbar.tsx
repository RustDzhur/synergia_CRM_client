"use client";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { TbAlignCenter, TbAlignLeft, TbAlignRight, TbBold, TbClearFormatting, TbItalic, TbList, TbListNumbers, TbLoader2, TbMicrophone, TbPlayerStop, TbStrikethrough, TbUnderline } from "react-icons/tb";
import { FONT_SIZES, TEXT_COLORS } from "./composeHtml";
import type { DictationError, DictationState } from "./useDictation";
import { MAX_DICTATION_SECONDS } from "./useDictation";

interface Props {
    disabled: boolean;
    dictation: { state: DictationState; seconds: number; error: DictationError | null; start: () => void; stop: () => void };
    onCommand: (command: string, value?: string) => void;
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

// Панель форматирования окна письма. Кнопки не забирают фокус (onMouseDown preventDefault):
// выделенный текст остаётся выделенным, и команда применяется к нему, а не к пустому месту.
// Панель не трогает вставку из буфера и диктовку — они работают с тем же редактором.
export default function ComposeToolbar({ disabled, dictation, onCommand }: Props) {
    const t = useTranslations("collab");
    const btn = "flex h-32 w-32 items-center justify-center rounded-8 text-[#cfd4cb] transition-colors hover:bg-[rgba(255,255,255,0.07)] hover:text-[#edf2ff] disabled:opacity-40";
    const tool = (label: string, icon: ReactNode, command: string, value?: string) => (
        <button
            type="button"
            title={label}
            aria-label={label}
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onCommand(command, value)}
            className={btn}>
            {icon}
        </button>
    );
    const sep = <span className="mx-2 h-20 w-px bg-[rgba(255,255,255,0.1)]" aria-hidden />;

    const recording = dictation.state === "recording";
    const transcribing = dictation.state === "transcribing";
    const dictationLabel = recording ? t("mailStopDictation") : transcribing ? t("mailTranscribing") : t("mailDictate");
    const errorText =
        dictation.error === "micDenied"
            ? t("mailMicDenied")
            : dictation.error === "micUnavailable"
              ? t("mailMicUnavailable")
              : dictation.error === "sttUnavailable"
                ? t("mailSttUnavailable")
                : dictation.error === "tooLong"
                  ? t("mailDictationTooLong", { minutes: Math.round(MAX_DICTATION_SECONDS / 60) })
                  : dictation.error === "noSpeech"
                    ? t("mailDictationNoSpeech")
                    : dictation.error === "failed"
                      ? t("mailDictationFailed")
                      : "";

    return (
        <div className="border-b border-inkLine">
            <div className="flex flex-wrap items-center gap-1 p-6">
                {tool(t("mailBold"), <TbBold size={17} />, "bold")}
                {tool(t("mailItalic"), <TbItalic size={17} />, "italic")}
                {tool(t("mailUnderline"), <TbUnderline size={17} />, "underline")}
                {tool(t("mailStrike"), <TbStrikethrough size={17} />, "strikeThrough")}
                {sep}
                <select
                    defaultValue="3"
                    disabled={disabled}
                    aria-label={t("mailFontSize")}
                    title={t("mailFontSize")}
                    onChange={(e) => onCommand("fontSize", e.target.value)}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="fs-field h-32 w-[120px] px-8 text-12 outline-none disabled:opacity-40">
                    {FONT_SIZES.map((s) => (
                        <option key={s.key} value={s.size}>
                            {t(`mailFont_${s.key}`)}
                        </option>
                    ))}
                </select>
                {sep}
                {tool(t("mailBulletList"), <TbList size={17} />, "insertUnorderedList")}
                {tool(t("mailNumberList"), <TbListNumbers size={17} />, "insertOrderedList")}
                {sep}
                {tool(t("mailAlignLeft"), <TbAlignLeft size={17} />, "justifyLeft")}
                {tool(t("mailAlignCenter"), <TbAlignCenter size={17} />, "justifyCenter")}
                {tool(t("mailAlignRight"), <TbAlignRight size={17} />, "justifyRight")}
                {sep}
                <div className="flex items-center gap-1" role="group" aria-label={t("mailTextColor")}>
                    {TEXT_COLORS.map((color) => (
                        <button
                            key={color}
                            type="button"
                            title={`${t("mailTextColor")}: ${color}`}
                            aria-label={`${t("mailTextColor")}: ${color}`}
                            disabled={disabled}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => onCommand("foreColor", color)}
                            className="h-22 w-22 rounded-full border border-[rgba(255,255,255,0.18)] transition-transform hover:scale-110 disabled:opacity-40"
                            style={{ backgroundColor: color }}
                        />
                    ))}
                </div>
                {tool(t("mailClearFormat"), <TbClearFormatting size={17} />, "removeFormat")}
                <button
                    type="button"
                    disabled={disabled || transcribing}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => (recording ? dictation.stop() : dictation.start())}
                    title={dictationLabel}
                    aria-label={dictationLabel}
                    aria-pressed={recording}
                    className={`ml-auto flex h-32 items-center gap-6 rounded-full border px-10 text-12 font-medium transition-colors disabled:opacity-50 ${
                        recording
                            ? "border-[rgba(235,87,87,0.5)] bg-[rgba(235,87,87,0.14)] text-[#ff8d8d]"
                            : "border-inkLine bg-[rgba(255,255,255,0.03)] text-[#cfd4cb] hover:text-[#edf2ff]"
                    }`}>
                    {transcribing ? (
                        <TbLoader2 size={16} className="animate-spin" />
                    ) : recording ? (
                        <TbPlayerStop size={16} />
                    ) : (
                        <TbMicrophone size={16} className={disabled ? "" : "text-[#7c93ff]"} />
                    )}
                    <span>{transcribing ? t("mailTranscribing") : recording ? `${t("mailRecording")} ${clock(dictation.seconds)}` : t("mailDictate")}</span>
                    {recording && <span className="h-8 w-8 animate-pulse rounded-full bg-[#eb5757]" aria-hidden />}
                </button>
            </div>
            {errorText && (
                <p role="alert" className="mx-6 mb-6 rounded-8 border border-[rgba(235,87,87,0.25)] bg-[rgba(235,87,87,0.08)] px-10 py-6 text-11 text-[#ff9b9b]">
                    {errorText}
                </p>
            )}
        </div>
    );
}
