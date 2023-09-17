import React from "react";
import Sidebar from "./components/layout";

export default function layout() {
	return (
		<div className="hidden md:block">
			<Sidebar />
		</div>
	);
}
