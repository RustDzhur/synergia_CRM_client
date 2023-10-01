"use client";
import React from "react";
import { IconContext } from "react-icons";
import { BiSolidQuoteLeft } from "react-icons/bi";
import { Swiper, SwiperSlide } from "swiper/react";
import { Mousewheel, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";

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
			<Swiper
				direction={"horizontal"}
				slidesPerView={1}
				centeredSlides={true}
				spaceBetween={20}
				grabCursor={true}
				breakpoints={{
					768: {
						slidesPerView: 3,
						spaceBetween: 20,
						centeredSlides: false,
					},
					1440: {
						slidesPerView: 3,
						spaceBetween: 20,
						centeredSlides: false,
					},
				}}
				mousewheel={{
					forceToAxis: true, // Enable forceToAxis to scroll only horizontally
					releaseOnEdges: true, // Allow releasing on edges to continue page scroll
				}}
				pagination={{
					dynamicBullets: true,
					clickable: true,
				}}
				modules={[Mousewheel, Pagination]}>
				{feedbacks.map((item, index) => (
					<SwiperSlide key={index}>
						<div
							key={index}
							className="px-20 py-30 border-testimonials rounded-24 h-400 overflow-y-scroll scrollbar-hidden">
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
					</SwiperSlide>
				))}
			</Swiper>
		</div>
	);
}
