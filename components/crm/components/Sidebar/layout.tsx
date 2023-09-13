import React from "react";
import Sidebar from "./components/layout";
import ModalMenu from "../Modal/components/ModalMenu";
import ModalMobNav from "../Modal/components/ModalMobNav";

export default function layout() {
	return (
		<div className="hidden md:block">
			<Sidebar />
		</div>
	);
}
