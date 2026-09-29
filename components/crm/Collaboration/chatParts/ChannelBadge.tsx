"use client";
import { useTranslations } from "next-intl";
import type { MessagingChannel } from "@/types/integrations";
import { CHANNEL_COLOR, CHANNEL_ICON } from "../channelMeta";

export default function ChannelBadge({ channel, size = 16 }: { channel: MessagingChannel; size?: number }) {
	const t = useTranslations("collab");
	const Icon = CHANNEL_ICON[channel];
	return <span title={t(`ch_${channel}`)} aria-label={t(`ch_${channel}`)} style={{ color: CHANNEL_COLOR[channel] }} className="shrink-0"><Icon size={size} /></span>;
}
