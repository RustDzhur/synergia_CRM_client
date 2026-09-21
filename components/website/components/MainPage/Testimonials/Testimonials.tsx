"use client";
import React, { useRef } from "react";
import { IconContext } from "react-icons";
import { BiSolidQuoteLeft } from "react-icons/bi";
import { Swiper, SwiperSlide } from "swiper/react";
import { Mousewheel, Navigation, Pagination } from "swiper/modules";
import { MdKeyboardArrowLeft, MdKeyboardArrowRight } from "react-icons/md";
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
			author: "Andrey L.",
		},
		{
			text: "Beautiful piece of furniture. A true asset to my audio and video system. We spend a lot of time finding just the right TV stand for the intended space, and it looks like we finally found it. i was a little afraid the high gloss might look tacky, but the clean lines just look understated, unobtrusive and quite beautiful.",
			author: "Kim P.",
		},
		{
			text: "Beautiful piece of furniture. A true asset to my audio and video system. We spend a lot of time finding just the right TV stand for the intended space, and it looks like we finally found it. i was a little afraid the high gloss might look tacky, but the clean lines just look understated, unobtrusive and quite beautiful.",
			author: "Sandra L.",
		},
	];
	const prevRef = useRef<HTMLButtonElement>(null);
	const nextRef = useRef<HTMLButtonElement>(null);
	const arrow = "hidden lg:flex absolute top-[200px] z-10 h-[60px] w-[60px] -translate-y-1/2 items-center justify-center rounded-[50%] border-[3px] bg-white transition-colors duration-200 disabled:cursor-default";
	return (
		<div>
			<h2 className="text-24 lg:text-36 font-medium text-testimonials text-center tracking-[0.48px] lg:tracking-[1px] sm:mb-[26px] lg:mb-[45px]">
				Testimonials
			</h2>
			<div className="relative testimonials-slider">
			<button ref={prevRef} type="button" aria-label="Previous" className={`${arrow} left-[-80px] border-[#CCCCCC] text-[#999999] hover:border-authBtn hover:text-authBtn`}>
				<MdKeyboardArrowLeft size={32} />
			</button>
			<button ref={nextRef} type="button" aria-label="Next" className={`${arrow} right-[-80px] border-authBtn text-authBtn hover:bg-authBtn hover:text-white`}>
				<MdKeyboardArrowRight size={32} />
			</button>
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
					forceToAxis: true,
					releaseOnEdges: true,
				}}
				pagination={{
					clickable: true,
				}}
				navigation={{ prevEl: prevRef.current, nextEl: nextRef.current }}
				onBeforeInit={(swiper) => {
					// кнопки создаются раньше Swiper, но их ref в момент первого рендера ещё пуст — подключаем при инициализации
					if (typeof swiper.params.navigation === "object") {
						swiper.params.navigation.prevEl = prevRef.current;
						swiper.params.navigation.nextEl = nextRef.current;
					}
				}}
				modules={[Mousewheel, Navigation, Pagination]}>
				{feedbacks.map((item, index) => (
					<SwiperSlide key={index}>
						<div
							key={index}
							className="px-[18px] pt-[36px] pb-30 border-[3px] border-authBtn rounded-[30px] sm:h-[412px] md:h-400 overflow-y-scroll scrollbar-hidden shadow-[0_4px_10px_rgba(255,0,138,0.18)]">
							<IconContext.Provider value={{ size: "52px", color: "#FF008A" }}>
								<div className="flex justify-start mb-[20px] ml-[3px]">
									<BiSolidQuoteLeft />
								</div>
							</IconContext.Provider>
							<div>
								<p className="text-[#4D4D4D] text-16 leading-[27px] tracking-[0.4px] mb-[26px]">
									{item.text}
								</p>
								<p className="text-[#4D4D4D] font-medium text-20 leading-[1.5] tracking-[0.4px]">
									{item.author}
								</p>
							</div>
						</div>
					</SwiperSlide>
				))}
			</Swiper>
			</div>
		</div>
	);
}
