"use client";
import React, { useEffect } from "react";
import { MdNotifications } from "react-icons/md";
import { useNotificationStore } from "@/app/store/useNotificationStore";

export default function Notification() {
	const { numberNotification, toggleNotifications, fetchNotifications } =
		useNotificationStore();

	useEffect(() => {
		fetchNotifications();
	}, [fetchNotifications]);

	return (
		<button
			type="button"
			aria-label="Notifications"
			onClick={toggleNotifications}
			className="relative flex">
			<MdNotifications size={24} color="#B3B3B3" />
			{/* Синяя точка 8px из Figma — показываем, когда есть непрочитанные */}
			{numberNotification > 0 && (
				<span className="absolute top-0 right-0 w-8 h-8 rounded-50 bg-primaryColor" />
			)}
		</button>
	);
}
