import ukraine from "@/app/assets/svgs/ukraine-flag-icon.svg";
import usa from "@/app/assets/svgs/united-states-flag-icon.svg";
import germany from "@/app/assets/svgs/germany-flag-icon.svg";

interface Language {
    id: string;
    name: string;
    code: string;
  }

 export const languages: Language[] = [
    {
      id: "en",
      name: "en-US",
      code: "en",
    },
    {
      id: "de",
      name: "de-DE",
      code: "de",
    },
    {
      id: "ua",
      name: "uk-UA",
      code: "ua",
    },
  ];

  export const languageCodeToProperties = (
    code: string
  ): { flagUrl: string; width: number; height: number } => {
    if (code === "en") {
      return { flagUrl: usa, width: 40, height: 30 };
    } else if (code === "de") {
      return { flagUrl: germany, width: 40, height: 30 };
    } else if (code === "ua") {
      return { flagUrl: ukraine, width: 40, height: 30 };
    }
    return { flagUrl: "", width: 0, height: 0 };
  };