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
			primaryColor: "#5EA8F5",
			secondaryColor: "#F5F7FC",
			black: "#4D4D4D",
			gray: "#EBEEF8",
			iconColor: "#B3B3B3",
			white: "#ffffff",
			modalBG: "rgba(217, 217, 217, 0.80)",
			menu: "#cccccc",
			activeMenu: "#313D45",
			authBtn: "#FF008A",
		},
		spacing: {
			px: "1px",
			0: "0",
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
			30: "30px",
			32: "32px",
			40: "40px",
			50: "50px",
			52: "52px",
			60: "60px",
			74: "74px",
			83: "83px",
			100: "100px",
			139: "139px",
			270: "270px",
			300: "300px",
			320: "320px",
			350: "350px",
			800: "800px",
		},
		opacity: {
			"0": "0",
			"20": "0.2",
			"40": "0.4",
			"60": "0.6",
			"80": "0.8",
			"100": "1",
		},
		fontWeight: {
			normal: "400",
			medium: "500",
			bold: "700",
		},
		fontSize: {
			4: "4px",
			6: "6px",
			7: "7px",
			8: "8px",
			10: "10px",
			12: "12px",
			16: "16px",
			18: "18px",
			20: "20px",
			24: "24px",
			34: "34px",
		},
		borderWidth: {
			switchCompany: "1px",
			authForms: "2px",
			authFormsUnFocus: "2px",
		},
		borderColor: {
			switchCompany: "#E2F1F5",
			activeLink: "#313D45",
			authFormsFocus: "#5EA8F5",
			authFormsUnFocus: "#cccccc",
			authBtn: "#FF008A"
		},
		boxShadow: {
			custom: "0px 1px 2px 0px rgba(0, 0, 0, 0.08)",
			circleShadow: "0px 4px 8px 0px rgba(49, 61, 69, 0.24)",
			authForms: "0px 2px 2px 0px rgba(0, 0, 0, 0.12)",
			authBtn: "0px 2px 2px 0px rgba(0, 0, 0, 0.12)",
		},
		backgroundImage: {
			"gradient-background":
				"linear-gradient(49deg, #ff008a 15.09%, #768fe5 59.33%, rgba(255, 0, 138, 0) 87.2%)",
		},
		borderRadius: {
			"4": "4px",
			"8": "8px",
			"300": "300px",
			"800": "800px",
		},
		extend: {},
	},
	plugins: [
		function ({ addUtilities }: any) {
			const newUtilities = {
				".active-link": {
					textDecoration: "underline",
					"text-underline-offset": "10px", // Set the margin-bottom
				},
			};
			addUtilities(newUtilities);
		},
	],
};
export default config;
