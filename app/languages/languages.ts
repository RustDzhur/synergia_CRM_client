import ukraine from "@/app/assets/svgs/ukraine-flag-icon.svg";
import usa from "@/app/assets/svgs/united-states-flag-icon.svg";
import germany from "@/app/assets/svgs/germany-flag-icon.svg";

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
      return { flagUrl: usa, width: 40, height: 30 };
    }
    return { flagUrl: "ua", width: 40, height: 30 };
  };