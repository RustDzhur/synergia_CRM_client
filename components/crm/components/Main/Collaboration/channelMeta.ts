import type { IconType } from "react-icons";
import { FaFacebookMessenger, FaTelegram, FaViber } from "react-icons/fa";
import { MdDialpad, MdSensors, MdSms } from "react-icons/md";
import type { MessagingChannel } from "@/app/types/integrations";

// Значки и фирменные цвета каналов (Chat and Calls: список бесед, шапка беседы, пустое состояние)
export const CHANNEL_ICON: Record<MessagingChannel, IconType> = {
	telegram: FaTelegram,
	viber: FaViber,
	messenger: FaFacebookMessenger,
	twilio: MdSms,
	sip: MdDialpad,
	webchat: MdSensors,
};

export const CHANNEL_COLOR: Record<MessagingChannel, string> = {
	telegram: "#229ED9",
	viber: "#7360F2",
	messenger: "#0084FF",
	twilio: "#F22F46",
	sip: "#009A2B",
	webchat: "#5EA8F5",
};
