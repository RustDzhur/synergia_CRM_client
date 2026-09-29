"use client";
import { useRef } from "react";
import { useTranslations } from "next-intl";
import { IconContext } from "react-icons";
import { TbBolt, TbChartHistogram, TbMessages, TbReceipt2, TbShieldCheck, TbUsersGroup } from "react-icons/tb";
import { Swiper, SwiperSlide } from "swiper/react";
import { Mousewheel, Navigation, Pagination } from "swiper/modules";
import { MdKeyboardArrowLeft, MdKeyboardArrowRight } from "react-icons/md";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";

// Раньше здесь стояли четыре одинаковых отзыва о мебели — заглушка из шаблона, не имеющая отношения к продукту.
// Придумывать отзывы клиентов нельзя, поэтому блок стал честным перечислением того, что система действительно умеет:
// каждая карточка называет раздел и объясняет, что он делает.
const CARDS = [
	{ icon: TbUsersGroup, key: "crm" },
	{ icon: TbMessages, key: "collab" },
	{ icon: TbBolt, key: "automation" },
	{ icon: TbReceipt2, key: "finance" },
	{ icon: TbChartHistogram, key: "analytics" },
	{ icon: TbShieldCheck, key: "security" },
] as const;

export default function Testimonials() {
	const t = useTranslations("capabilities");
	const prevRef = useRef<HTMLButtonElement>(null);
	const nextRef = useRef<HTMLButtonElement>(null);
	const arrow = "hidden lg:flex absolute top-[180px] z-10 h-[60px] w-[60px] -translate-y-1/2 items-center justify-center rounded-[50%] border-[3px] bg-white transition-colors duration-200 disabled:cursor-default";

	return (
		<div>
			<h2 className="text-24 lg:text-36 font-medium text-[#f1f4ee] text-center tracking-[0.48px] lg:tracking-[1px] sm:mb-8 lg:mb-[14px]">
				{t("title")}
			</h2>
			<p className="mx-auto mb-[26px] max-w-[720px] text-center text-16 leading-[1.7] tracking-[0.3px] text-[#8c948b] lg:mb-[45px] lg:text-18">
				{t("subtitle")}
			</p>
			<div className="relative testimonials-slider">
				<button ref={prevRef} type="button" aria-label={t("prev")} className={`${arrow} left-[-80px] border-[#CCCCCC] text-[#999999] hover:border-authBtn hover:text-authBtn`}>
					<MdKeyboardArrowLeft size={32} />
				</button>
				<button ref={nextRef} type="button" aria-label={t("next")} className={`${arrow} right-[-80px] border-authBtn text-authBtn hover:bg-authBtn hover:text-[#0A0A0A]`}>
					<MdKeyboardArrowRight size={32} />
				</button>
				<Swiper
					direction={"horizontal"}
					slidesPerView={1}
					centeredSlides={true}
					spaceBetween={20}
					grabCursor={true}
					breakpoints={{
						768: { slidesPerView: 3, spaceBetween: 20, centeredSlides: false },
						1440: { slidesPerView: 3, spaceBetween: 20, centeredSlides: false },
					}}
					mousewheel={{ forceToAxis: true, releaseOnEdges: true }}
					pagination={{ clickable: true }}
					navigation={{ prevEl: prevRef.current, nextEl: nextRef.current }}
					onBeforeInit={(swiper) => {
						// кнопки создаются раньше Swiper, но их ref в момент первого рендера ещё пуст — подключаем при инициализации
						if (typeof swiper.params.navigation === "object") {
							swiper.params.navigation.prevEl = prevRef.current;
							swiper.params.navigation.nextEl = nextRef.current;
						}
					}}
					modules={[Mousewheel, Navigation, Pagination]}>
					{CARDS.map(({ icon: Icon, key }) => (
						<SwiperSlide key={key}>
							<div className="h-full rounded-[30px] border-[3px] border-authBtn px-[18px] pb-30 pt-[30px] shadow-[0_4px_10px_rgba(198,255,77,0.18)] sm:h-[380px] md:h-[360px]">
								<IconContext.Provider value={{ size: "40px", color: "#C6FF4D" }}>
									<div className="mb-[18px] flex justify-start">
										<Icon />
									</div>
								</IconContext.Provider>
								<p className="mb-[12px] text-20 font-medium leading-[1.4] tracking-[0.4px] text-[#f1f4ee]">{t(`${key}_title`)}</p>
								<p className="text-15 leading-[26px] tracking-[0.3px] text-[#8c948b]">{t(`${key}_text`)}</p>
							</div>
						</SwiperSlide>
					))}
				</Swiper>
			</div>
		</div>
	);
}
