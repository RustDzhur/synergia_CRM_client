import ukraine from "@/app/assets/svgs/ukraine-flag-icon.svg";
import germany from "@/app/assets/svgs/germany-flag-icon.svg";
import unitedKingdom from "@/app/assets/svgs/united-kingdom-flag-icon.svg";

interface Language {
    code: string;
  }

 export const languages: Language[] = [
    {
      code: "en"
    },
    {
      code: "de",
    },
    {
      code: "ua",
    },
  ];

  export const languageCodeToProperties = (
    code: string
  ): { flagUrl: string; width: number; height: number } => {
    if (code === "ua") {
      return { flagUrl: ukraine, width: 40, height: 30 };
    } else if (code === "de") {
      return { flagUrl: germany, width: 40, height: 30 };
    } else if (code === "en") {
      return { flagUrl: unitedKingdom, width: 40, height: 30 };
    }
    return { flagUrl: "ua", width: 40, height: 30 };
  };

  // Английский везде показывается флагом Великобритании (макеты сайта и CRM). crmFlagUrl оставлен как есть для CRM.
  export const crmFlagUrl = (code: string): string => languageCodeToProperties(code).flagUrl;