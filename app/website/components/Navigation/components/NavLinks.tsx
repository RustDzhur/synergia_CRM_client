import React from "react";
import NavLink from "./NavLink";

export default function Links() {
	return (
		<ul className="flex items-center">
			<li className="lg:mr-40 font-medium lg:text-18">
				<NavLink href="/">Home</NavLink>
			</li>
			<li className="lg:mr-40 font-medium lg:text-18">
				<NavLink href="/about">About Us</NavLink>
			</li>
			<li className="lg:mr-40 font-medium lg:text-18">
				<NavLink href="/services">Our Services</NavLink>
			</li>
			<li className="lg:mr-40 font-medium lg:text-18">
				<NavLink href="/blog">Blog</NavLink>
			</li>
			<li className="lg:mr-40 font-medium lg:text-18">
				<NavLink href="/contacts">Contact</NavLink>
			</li>

			<li className="cursor-pointer">Language</li>
		</ul>
	);
}
