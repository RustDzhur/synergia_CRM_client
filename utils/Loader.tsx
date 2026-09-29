import React from "react";
import { ThreeDots } from "react-loader-spinner";

interface LoaderProps {
	color: string;
	width: string;
	height: string;
	radius: string;
}

export default function Loader({ color, width, height, radius }: LoaderProps) {
	return (
		<ThreeDots
			height={height}
			width={width}
			radius={radius}
			color={color}
			ariaLabel="three-dots-loading"
			visible={true}
		/>
	);
}
