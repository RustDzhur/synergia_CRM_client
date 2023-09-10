import React from "react";

export default function AuthLinks() {
	return (
		<ul className="flex items-center">
			<li className="cursor-pointer text-white hover:text-activeMenu lg:text-18">Sign In</li>
			<li className="mr-10 ml-10 text-white">|</li>
			<li className="cursor-pointer text-white hover:text-activeMenu lg:text-18">Sign Up</li>
		</ul>
	);
}
