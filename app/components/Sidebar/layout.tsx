import React from "react";
import Sidebar from "./components/layout";
import ModalMenu from "./components/ModalMenu";

export default function layout() {
	return (
		<div>
			<div className="hidden md:block">
				<Sidebar />
			</div>
			<ModalMenu />
		</div>
	);
}
