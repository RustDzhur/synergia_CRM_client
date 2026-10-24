"use client";
import { Control, Controller, FieldValues } from "react-hook-form";
import { IoIosLock, IoIosUnlock } from "react-icons/io";
import { BsEye, BsEyeSlash } from "react-icons/bs";
import { IconContext } from "react-icons";
import type { SignupFieldDef } from "./model";

interface Props {
	field: SignupFieldDef;
	placeholder: string;
	control: Control<FieldValues>;
	passwordVisible: boolean;
	onTogglePassword: () => void;
	/** подсказка под полем (у пароля — «минимум 8 символов») */
	hint?: string;
	/** проверка значения: текст ошибки человеческим языком или true, если всё верно */
	validate: (value: unknown) => string | true;
}

const ICON = { size: "22px", color: "#9aa7c9" };

// Поле формы регистрации: значок слева, у пароля ещё замок и глазок для показа
export default function SignupField({ field: def, placeholder, control, passwordVisible, onTogglePassword, hint, validate }: Props) {
	const isPassword = def.type === "password";
	return (
		<Controller
			name={def.name}
			control={control}
			defaultValue=""
			rules={{ validate }}
			render={({ field, fieldState }) => (
				<div className="relative">
					<input
						{...field}
						type={isPassword && passwordVisible ? "text" : def.type}
						placeholder={placeholder}
						className={`pl-50 pr-20 py-14 w-[100%] rounded-8 border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.04)] text-[#edf2ff] placeholder:text-[#9aa7c9] outline-none transition-colors focus:border-[rgba(124,147,255,0.55)] mb-18 ${fieldState.error ? "!border-[#eb5757]" : ""}`}
					/>
					{fieldState.error?.message ? (
						<p role="alert" className="-mt-12 mb-14 pl-4 text-left text-12 text-[#eb5757]">{fieldState.error.message}</p>
					) : (
						hint && <p className="-mt-12 mb-14 pl-4 text-left text-12 text-[#9aa7c9]">{hint}</p>
					)}
					<div className="absolute top-17 left-20">
						<IconContext.Provider value={ICON}>
							{isPassword ? passwordVisible ? <IoIosUnlock /> : <IoIosLock /> : def.Icon && <def.Icon />}
						</IconContext.Provider>
					</div>
					{isPassword && (
						<div onClick={onTogglePassword} className="absolute top-17 right-20 cursor-pointer">
							<IconContext.Provider value={ICON}>{passwordVisible ? <BsEye /> : <BsEyeSlash />}</IconContext.Provider>
						</div>
					)}
				</div>
			)}
		/>
	);
}
