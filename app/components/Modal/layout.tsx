import React from "react";
import ModalMenu from "./components/ModalMenu";
import Modal from "./components/Modal";

export default function layout() {
	return (
		<div className="lg:hidden">
			<ModalMenu />
		</div>
	);
}
