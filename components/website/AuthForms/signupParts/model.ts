import type { IconType } from "react-icons";
import { AiFillBank, AiOutlineMail } from "react-icons/ai";
import { TbReceiptTax } from "react-icons/tb";
import { MdOutlinePersonalInjury } from "react-icons/md";
import { BiSolidBuildingHouse } from "react-icons/bi";
import { BsFillTelephoneFill, BsFillPersonLinesFill, BsFillBuildingsFill } from "react-icons/bs";

export type SignupTab = "company" | "personal";

export interface SignupFieldDef {
	name: string;
	type: "text" | "email" | "password";
	label: string; // ключ перевода в authForms
	Icon?: IconType; // у пароля значок свой: замок
}

export const SIGNUP_TABS: { key: SignupTab; label: string; Icon: IconType }[] = [
	{ key: "company", label: "companyTab", Icon: BsFillBuildingsFill },
	{ key: "personal", label: "personalTab", Icon: MdOutlinePersonalInjury },
];

export const COMPANY_FIELDS: SignupFieldDef[] = [
	{ name: "companyName", type: "text", label: "companyname", Icon: AiFillBank },
	{ name: "taxNumber", type: "text", label: "taxnumber", Icon: TbReceiptTax },
	{ name: "companyPhone", type: "text", label: "companyphone", Icon: BsFillTelephoneFill },
	{ name: "companyEmail", type: "email", label: "companyemail", Icon: AiOutlineMail },
	{ name: "companyAddress", type: "text", label: "companyaddress", Icon: BiSolidBuildingHouse },
	{ name: "companyPassword", type: "password", label: "companypassword" },
];

export const PERSONAL_FIELDS: SignupFieldDef[] = [
	{ name: "firstname", type: "text", label: "firstname", Icon: BsFillPersonLinesFill },
	{ name: "lastname", type: "text", label: "lastname", Icon: BsFillPersonLinesFill },
	{ name: "phone", type: "text", label: "personalphone", Icon: BsFillTelephoneFill },
	{ name: "email", type: "email", label: "personalemail", Icon: AiOutlineMail },
	{ name: "personalAddress", type: "text", label: "personaladdress", Icon: BiSolidBuildingHouse },
	{ name: "password", type: "password", label: "personalpassword" },
];

export interface SignUpFormData {
	firstname: string;
	lastname: string;
	email: string;
	password: string;
}
