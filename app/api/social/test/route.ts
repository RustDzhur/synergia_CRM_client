import { NextResponse } from "next/server";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { socialOwner } from "@/lib/social/api";
import { readPublicVideo } from "@/lib/social/publish";
import {
    tiktokAccessToken,
    tiktokAppConfig,
    tiktokStatus,
    uploadTikTokVideo,
} from "@/lib/social/tiktok";
import { uploadYoutubeVideo, youtubeAccessToken, youtubeStatus } from "@/lib/social/youtube";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const forbidden = () => NextResponse.json({ message: "Only the owner of the platform can test social publishing" }, { status: 403 });
const DEFAULT_TEST_VIDEO = "public/social/test.mp4";

// POST /api/social/test — { platform: "youtube"|"tiktok", videoPath?, title? }
//
// Тестовая загрузка всегда безопасная:
//   • YouTube — только private (или unlisted, если явно попросили), public в тесте недоступен;
//   • TikTok — только inbox (черновик), прямую публикацию тест не запускает.
// Если провайдер ещё не подключён, маршрут отвечает mock-результатом: ничего никуда не уходит.
// Это позволяет проверить интерфейс до появления токенов, но в ответе явно стоит mock: true.
export async function POST(req: Request) {
    const auth = await socialOwner(req);
    if (!auth) return unauthorized(req);
    if (!auth.owner) return forbidden();
    const body = await req.json().catch(() => null);
    const platform = typeof body?.platform === "string" ? body.platform : "";
    if (platform !== "youtube" && platform !== "tiktok") return badRequest("platform must be youtube or tiktok");
    const videoPath = typeof body?.videoPath === "string" && body.videoPath.trim() ? body.videoPath.trim() : DEFAULT_TEST_VIDEO;
    const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim() : "Firmspace test video";
    const privacyStatus = body?.privacyStatus === "unlisted" ? "unlisted" : "private";

    try {
        if (platform === "youtube") {
            const status = await youtubeStatus();
            if (!status.configured || !status.connected) {
                return NextResponse.json({
                    ok: true,
                    mock: true,
                    platform,
                    message: status.missing.length
                        ? `Google OAuth is not configured (${status.missing.join(", ")}); mock only, nothing was uploaded.`
                        : "YouTube is not connected; mock only, nothing was uploaded.",
                    quota: status.quota,
                });
            }
            const video = await readPublicVideo(videoPath);
            const token = await youtubeAccessToken();
            const uploaded = await uploadYoutubeVideo({
                accessToken: token,
                bytes: video.bytes,
                mime: video.mime,
                title,
                description: "Test upload from Firmspace CRM. Private / unlisted only.",
                tags: ["Firmspace", "CRM"],
                privacyStatus,
                confirmPublic: false,
            });
            return NextResponse.json({
                ok: true,
                mock: false,
                platform,
                videoId: uploaded.videoId,
                url: uploaded.url,
                privacyStatus: uploaded.privacyStatus,
                quota: status.quota,
                note: `This test consumed ${status.quota.unitsPerUpload} YouTube quota units; the video stays on the channel until you delete it there.`,
            });
        }

        const status = await tiktokStatus();
        if (!status.configured || !status.connected) {
            return NextResponse.json({
                ok: true,
                mock: true,
                platform,
                message: status.missing.length
                    ? `TikTok app credentials are not configured (${status.missing.join(", ")}); mock only, nothing was uploaded.`
                    : "TikTok is not connected; mock only, nothing was uploaded.",
                redirectUri: status.redirectUri,
            });
        }
        const cfg = await tiktokAppConfig();
        const video = await readPublicVideo(videoPath);
        const token = await tiktokAccessToken();
        const uploaded = await uploadTikTokVideo({
            accessToken: token,
            bytes: video.bytes,
            title,
            mode: "inbox", // тест никогда не публикует напрямую
            privacyStatus: "private",
            confirmPublic: false,
            displayName: cfg.displayName,
        });
        return NextResponse.json({
            ok: true,
            mock: false,
            platform,
            publishId: uploaded.publishId,
            mode: uploaded.mode,
            status: uploaded.status,
            url: uploaded.url,
            note: "The video was uploaded to the TikTok inbox (draft). Finish and publish it in the TikTok app.",
        });
    } catch (e) {
        return failure(e);
    }
}
