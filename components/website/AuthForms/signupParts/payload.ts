import type { FieldValues } from "react-hook-form";
import type { SignUpFormData } from "@/store/useAuthStore";
import type { SignupTab } from "./model";

// Что именно уходит на POST /api/auth/signup.
//
// Вкладки называют одни и те же поля по-разному: «Personal» спрашивает имя и фамилию человека,
// «Company» — реквизиты фирмы. Серверу нужен аккаунт (имя, почта, пароль), поэтому вкладка
// «Company» отдаёт именем фирмы и прикладывает её реквизиты отдельным блоком: имя человека
// в этой вкладке не спрашивают, а реквизиты попадают в настройки бухгалтерии новой фирмы,
// чтобы в счетах сразу стояли правильные данные.
export interface CompanySignUpFormData {
	companyName: string;
	taxNumber?: string;
	companyPhone?: string;
	companyEmail: string;
	companyAddress?: string;
	companyPassword: string;
}

export function signupPayload(tab: SignupTab, data: FieldValues): SignUpFormData {
	if (tab === "personal") {
		const { firstname, lastname, email, password } = data as unknown as SignUpFormData;
		return { firstname, lastname, email, password };
	}
	const d = data as unknown as CompanySignUpFormData;
	return {
		firstname: d.companyName ?? "",
		lastname: "",
		email: d.companyEmail ?? "",
		password: d.companyPassword ?? "",
		company: {
			name: d.companyName ?? "",
			taxNumber: d.taxNumber ?? "",
			phone: d.companyPhone ?? "",
			address: d.companyAddress ?? "",
		},
	};
}
