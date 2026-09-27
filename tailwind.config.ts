import type { Config } from "tailwindcss";

const config: Config = {
	content: [
		"./pages/**/*.{js,ts,jsx,tsx,mdx}",
		"./components/**/*.{js,ts,jsx,tsx,mdx}",
		"./app/**/*.{js,ts,jsx,tsx,mdx}",
	],
	theme: {
		screens: {
			sm: "375px",
			md: "768px",
			mp: "900px",
			lg: "1440px",
		},
		colors: {
			headerBackground: "#F5F7FC",
			// тёмный лендинг: раньше тут был грифельно-серый #313D45 — теперь почти чёрный, как в CRM
			aboutUsBackground: "#0A0A0A",
			whatIsCrmActive: "#0A0A0A",
			whatIsCrm: "#E6E6E6",
			// CTA-кнопки лендинга: раньше розовый #FF008A — теперь салатовый акцент (см. accentGreen)
			joinUsPink: "#C6FF4D",
			joinUsGrey: "#0A0A0A",
			discover: "#0A0A0A",
			advantages: "#0A0A0A",
			transparent: "transparent",
			// бренд-зелёный: используется как bg-primaryColor вместе с text-white почти везде в CRM —
			// поэтому это не самый яркий салатовый (тот см. accentGreen), а более тёмный, чтобы белый текст оставался читаемым
			primaryColor: "#5FBF3C",
			// яркий салатовый акцент — только там, где текст на нём подбирается заново (тёмный): пилюли, бейджи, CTA
			accentGreen: "#C6FF4D",
			secondaryColor: "#F5F7FC",
			black: "#4D4D4D",
			gray: "#EBEEF8",
			iconColor: "#B3B3B3",
			white: "#ffffff",
			modalBG: "rgba(217, 217, 217, 0.80)",
			menu: "#cccccc",
			activeMenu: "#313D45",
			authBtn: "#C6FF4D",
			tabChoosePlan: "#768FE5",
			textChoosePlan: "#313D45",
			cardPlanColor: "#F2F2F2",
			basicPlan: "#313D45",
			contactUs: "#C6FF4D",
			testimonials: "#0A0A0A",
			footer: "#0A0A0A",
			// добавил под реальный дизайн CRM:
			searchBorder: "#E6E6E6", // рамка поля поиска в CRM (отличается от switchCompany)
			danger: "#EB5757",       // для кнопок удаления/ошибок — своего "красного" в проекте не было
		},
		spacing: {
			px: "1px",
			0: "0",
			2: "2px",
			6: "6px",
			8: "8px",
			10: "10px",
			12: "12px",
			13: "13px",
			14: "14px",
			16: "16px",
			15: "15px",
			17: "17px",
			18: "18px",
			20: "20px",
			24: "24px",
			25: "25px",
			30: "30px",
			32: "32px",
			35: "35px",
			36: "36px", // добавил — нужен для кнопки "+ Add" в CRM (px-36 по макету)
			40: "40px",
			44: "44px",
			50: "50px",
			52: "52px",
			55: "55px",
			60: "60px",
			74: "74px",
			80: "80px",
			83: "83px",
			100: "100px",
			115: "115px",
			130: "130px",
			139: "139px",
			150: "150px",
			175: "175px",
			230: "230px",
			270: "270px",
			300: "300px",
			331: "331px",
			303: "303px",
			320: "320px",
			340: "340px",
			350: "350px",
			375: "375px",
			400: "400px",
			448: "448px",
			475: "475px",
			478: "478px",
			490: "490px",
			512: "512px",
			525: "525px",
			505: "505px",
			610: "610px",
			800: "800px",
			895: "895px",
		},
		opacity: {
			"0": "0",
			"20": "0.2",
			"40": "0.4",
			"60": "0.6",
			"80": "0.8",
			"100": "1",
		},
		fontFamily: {
			inter: ["Inter", "sans"],
		},
		fontSize: {
			4: "4px",
			6: "6px",
			7: "7px",
			8: "8px",
			10: "10px",
			12: "12px",
			14: "14px",
			15: "15px",
			16: "16px",
			18: "18px",
			20: "20px",
			24: "24px",
			25: "25px",
			32: "32px",
			34: "34px",
			36: "36px",
			40: "40px",
			50: "50px",
		},
		borderColor: {
			switchCompany: "#E2F1F5",
			activeLink: "#313D45",
			authFormsFocus: "#5EA8F5",
			authFormsUnFocus: "#cccccc",
			authBtn: "#C6FF4D",
			authTabBtn: "#C6FF4D",
			cardPlan: "#768FE5",
			testimonials: "#C6FF4D",
		},
		backgroundImage: {
			"gradient-background":
				"linear-gradient(49deg, #c6ff4d 15.09%, #5fbf3c 59.33%, rgba(198, 255, 77, 0) 87.2%)",
			footerBackground:
				"linear-gradient(to right, #313D45 100px, #313D45 505px)",
		},
		borderRadius: {
			"4": "4px",
			"6": "6px", // добавил — нужен для мелких инпутов в CRM
			"8": "8px",
			"10": "10px",
			"16": "16px",
			"24": "24px",
			"35" : "35px",
			"50": "50px",
			"300": "300px",
			"800": "800px",
		},
		extend: {
			// эти три раньше были в theme напрямую и полностью убивали
			// стандартные классы Tailwind (border-2, shadow-sm, font-semibold и т.д.) —
			// перенёс в extend, чтобы твои именованные значения ДОБАВЛЯЛИСЬ, а не заменяли
			borderWidth: {
				switchCompany: "1px",
				authForms: "2px",
				authFormsUnFocus: "2px",
				cardPlan: "2px",
				testimonials: "2px",
			},
			boxShadow: {
				custom: "0px 1px 2px 0px rgba(0, 0, 0, 0.08)",
				circleShadow: "0px 4px 8px 0px rgba(49, 61, 69, 0.24)",
				authForms: "0px 2px 2px 0px rgba(0, 0, 0, 0.12)",
				authBtn: "0px 2px 2px 0px rgba(0, 0, 0, 0.12)",
				authTabBtn: "0px 2px 2px 0px rgba(0, 0, 0, 0.12)",
				heroImage: "0px 2px 8px 0px rgba(0, 0, 0, 0.32)",
				advantages: "0px 4px 8px 0px rgba(0, 0, 0, 0.25)",
				choosePlan: "0px 2px 2px 0px rgba(0, 0, 0, 0.16)",
			},
			fontWeight: {
				normal: "400",
				medium: "500",
				semibold: "600", // добавил — используется в заголовках колонок CRM
				bold: "700",
			},
		},
	},
	plugins: [
		function ({ addUtilities }: any) {
			const newUtilities = {
				".active-link": {
					textDecoration: "underline",
					"text-underline-offset": "10px",
				},
			};
			addUtilities(newUtilities);
		},
	],
};
export default config;