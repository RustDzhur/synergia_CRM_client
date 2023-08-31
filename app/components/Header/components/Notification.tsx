"use client";
import React, { useEffect } from "react";
import { BsFillBellFill } from "react-icons/bs";
import { IconContext } from "react-icons";
import { useNotificationStore } from "@/app/store/useNotificationStore";

export default function Notification() {
	const {
		hasNotifications,
		numberNotification,
		toggleNotifications,
		fetchNotifications,
	} = useNotificationStore();

	useEffect(() => {
		fetchNotifications();
	}, [fetchNotifications]);

	const color = hasNotifications ? "#B3B3B3" : "#ffffff";

	return (
		<div onClick={toggleNotifications} className="relative">
			<IconContext.Provider
				value={{ color, size: "24px", className: "cursor-pointer" }}>
				<BsFillBellFill
					style={{
						fill: hasNotifications ? "#ffffff" : "#B3B3B3",
						stroke: "#B3B3B3",
						strokeWidth: "2px",
					}}
				/>
			</IconContext.Provider>
			{numberNotification > 0 && (
				<div className="flex items-center justify-center w-16 h-16 rounded-8 bg-primaryColor absolute top-[-10px] right-[-8px]">
					<p className="text-12 text-black font-medium">
						{numberNotification >= 99 ? 99 : numberNotification}
					</p>
				</div>
			)}
		</div>
	);
}
