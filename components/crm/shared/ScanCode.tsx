"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { TbBarcode } from "react-icons/tb";
import Modal from "./Modal";

// Сканер штрихкодов: камера телефона (BarcodeDetector — Chrome/Edge на Android и десктопе) или
// ручной ввод — для аппаратного сканера-«пистолета» и для браузеров без BarcodeDetector (iPhone).
// Владелец: «чтобы я мог или мобилкой или сканером сканировать артикулы, чтобы вручную их не вбивать».
//
// Компонент только добывает код и отдаёт его наверх (onDetect): поиск, добавление позиции и правила
// совпадения остаются у экрана — у кассы, склада и товаров они свои.

interface DetectedBarcode { rawValue: string }
interface BarcodeDetectorLike {
	detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

const FORMATS = ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "itf", "qr_code"];

export default function ScanCode({ onDetect, title }: { onDetect: (code: string) => void; title?: string }) {
	const t = useTranslations("finance");
	const [open, setOpen] = useState(false);
	const [manual, setManual] = useState("");
	const [error, setError] = useState("");
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const rafRef = useRef(0);

	// Камера поднимается при открытии окна и гасится при закрытии — трек не остаётся висеть
	useEffect(() => {
		if (!open) return;
		setError("");
		setManual("");
		let cancelled = false;
		const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
		if (!Ctor) {
			setError(t("scanNoCamera"));
			return;
		}
		let detector: BarcodeDetectorLike;
		try {
			detector = new Ctor({ formats: FORMATS });
		} catch {
			detector = new Ctor();
		}
		let canvas: HTMLCanvasElement | null = null;
		const tick = async () => {
			if (cancelled) return;
			const video = videoRef.current;
			if (video && video.readyState >= 2) {
				try {
					if (!canvas) canvas = document.createElement("canvas");
					canvas.width = video.videoWidth;
					canvas.height = video.videoHeight;
					const ctx = canvas.getContext("2d");
					if (ctx) {
						ctx.drawImage(video, 0, 0);
						const found = await detector.detect(canvas);
						const code = found[0]?.rawValue?.trim();
						if (code) {
							onDetect(code);
							setOpen(false);
							return;
						}
					}
				} catch { /* кадр не распознан — пробуем следующий */ }
			}
			rafRef.current = requestAnimationFrame(() => void tick());
		};
		void (async () => {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
				if (cancelled) {
					stream.getTracks().forEach((tr) => tr.stop());
					return;
				}
				streamRef.current = stream;
				if (videoRef.current) {
					videoRef.current.srcObject = stream;
					await videoRef.current.play().catch(() => undefined);
				}
				void tick();
			} catch {
				if (!cancelled) setError(t("scanCameraDenied"));
			}
		})();
		return () => {
			cancelled = true;
			cancelAnimationFrame(rafRef.current);
			streamRef.current?.getTracks().forEach((tr) => tr.stop());
			streamRef.current = null;
		};
	}, [open, onDetect, t]);

	function submitManual(e: React.FormEvent) {
		e.preventDefault();
		const code = manual.trim();
		if (!code) return;
		onDetect(code);
		setOpen(false);
	}

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				title={title ?? t("scanTitle")}
				aria-label={title ?? t("scanTitle")}
				className="fs-btn fs-btn-ghost h-40 w-40 shrink-0 justify-center p-0"
			>
				<TbBarcode size={16} />
			</button>
			<Modal open={open} onClose={() => setOpen(false)} label={t("scanTitle")} className="w-full max-w-[420px]">
				<div className="fs-popover p-20">
					<h2 className="mb-8 text-16 font-semibold text-[#f1f4ee]">{t("scanTitle")}</h2>
					<p className="mb-12 text-12 leading-[1.6] text-[#8c948b]">{t("scanHint")}</p>
					{/* Камера: наведите на штрихкод — код подставится сам */}
					<div className="mb-12 overflow-hidden rounded-10 border border-inkLine bg-black/60">
						<video ref={videoRef} muted playsInline className="h-[220px] w-full object-cover" />
					</div>
					{error && <p className="mb-12 text-12 leading-[1.5] text-[#F4A100]">{error}</p>}
					{/* Ручной ввод: аппаратный сканер печатает код как клавиатура, ему достаточно этого поля */}
					<form onSubmit={submitManual} className="flex items-end gap-8">
						<label className="min-w-0 flex-1">
							<span className="mb-6 block text-12 text-[#8c948b]">{t("scanManual")}</span>
							<input autoFocus value={manual} onChange={(e) => setManual(e.target.value)} maxLength={64} className="fs-field h-40 w-full px-12 text-13 outline-none" placeholder="EAN-13 / SKU" />
						</label>
						<button type="submit" disabled={!manual.trim()} className="fs-btn fs-btn-primary h-40 disabled:opacity-60">{t("scanApply")}</button>
					</form>
				</div>
			</Modal>
		</>
	);
}
