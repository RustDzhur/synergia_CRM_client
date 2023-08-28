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
      mp: '900px',
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
      modalBG: 'rgba(217, 217, 217, 0.80)'
		},
		spacing: {
			px: "1px",
			0: "0",
			6: "6px",
			8: "8px",
			12: "12px",
			13: "13px",
      14: '14px',
			16: "16px",
			15: "15px",
			18: "18px",
			20: "20px",
			24: "24px",
			30: "30px",
			32: "32px",
			40: "40px",
			50: "50px",
			52: "52px",
			60: "60px",
			83: "83px",
      270: '270px',
      300: '300px',
			350: "350px",
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
		},
		borderWidth: {
			switchCompany: "1px",
		},
		borderColor: {
			switchCompany: "#E2F1F5",
		},
		boxShadow: {
			custom: "0px 1px 2px 0px rgba(0, 0, 0, 0.08)",
		},
		borderRadius: {
			"8": "8px",
		},
		extend: {},
	},
	plugins: [],
};
export default config;
