"use client";
import React from "react";
import Slider from "react-slick";
import { IconContext } from "react-icons";
import { BiSolidQuoteLeft } from "react-icons/bi";

const settings = {
	dots: true,
	infinite: true,
	speed: 500,
	slidesToShow: 1,
	slidesToScroll: 1,
	autoplay: true,
	autoplaySpeed: 3000,
	fade: true,
	swipeToSlide: true,
};

export default function Testimonials() {
	const feedbacks = [
		{
			text: "Beautiful piece of furniture. A true asset to my audio and video system. We spend a lot of time finding just the right TV stand for the intended space, and it looks like we finally found it. i was a little afraid the high gloss might look tacky, but the clean lines just look understated, unobtrusive and quite beautiful.",
			author: "Pasqualli Fiorillo",
		},
		{
			text: "Beautiful piece of furniture. A true asset to my audio and video system. We spend a lot of time finding just the right TV stand for the intended space, and it looks like we finally found it. i was a little afraid the high gloss might look tacky, but the clean lines just look understated, unobtrusive and quite beautiful.",
			author: "Kim P.",
		},
		{
			text: "Beautiful piece of furniture. A true asset to my audio and video system. We spend a lot of time finding just the right TV stand for the intended space, and it looks like we finally found it. i was a little afraid the high gloss might look tacky, but the clean lines just look understated, unobtrusive and quite beautiful.",
			author: "Andrey L.",
		},
	];
	return (
		<div>
			<h2 className="text-24 font-bold text-testimonials text-center tracking-[0.48px] mb-30">
				Testimonials
			</h2>
			<Slider {...settings}>
				{feedbacks.map((item, index) => (
					<div
						key={index}
						className="px-20 py-30 border-testimonials rounded-24">
						<IconContext.Provider value={{ size: "40px", color: "#FF008A" }}>
							<div className="flex justify-start mb-20">
								<BiSolidQuoteLeft />
							</div>
						</IconContext.Provider>
						<div>
							<p className="text-testimonials text-16 leading-[1.7] tracking-[0.32px] mb-16">
								{item.text}
							</p>
							<p className="text-testimonials font-medium text-20 leading-[1.5] tracking-[0.4px]">
								{item.author}
							</p>
						</div>
					</div>
				))}
			</Slider>
		</div>
	);
}
