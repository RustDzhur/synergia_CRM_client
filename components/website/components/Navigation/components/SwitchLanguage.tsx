'use client'
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { v4 as uuidv4 } from "uuid";
import { RiArrowDownSLine, RiArrowUpSLine } from "react-icons/ri";
import { IconContext } from "react-icons";
import { useLanguageStore } from "@/app/store/useLanguageStore";
import { languages } from "@/app/languages/languages";
import { languageCodeToProperties } from "@/app/languages/languages";
import { Language } from "@/app/types/languageType";

const languageTranslations: Record<string, Record<string, string>> = {
  "en-US": {
    us: "English",
    de: "Germany",
    ua: "Ukraine",
  },
  "de-DE": {
    us: "Englisch",
    de: "Deutsch",
    ua: "Ukrainisch",
  },
  "uk-UA": {
    us: "Англійська",
    de: "Німецька",
    ua: "Українська",
  },
};

export default function SwitchLanguage() {
  const [isOpenDropDown, setIsOpenDropDown] = useState(false);
  const { selectedLanguage, setSelectedLanguage } = useLanguageStore();

  const handleOpenDropDown = () => {
    setIsOpenDropDown(!isOpenDropDown);
  };

  const handleLanguageChange = (language: Language) => {
    setSelectedLanguage(language);
    setIsOpenDropDown(false);
    localStorage.setItem("language", language.id);
  };

  const selectedLanguageProperties = languageCodeToProperties(
    selectedLanguage.code
  );

  useEffect(() => {
    const savedLanguage = localStorage.getItem("language");
    if (savedLanguage) {
      const language = languages.find((flag) => flag.id === savedLanguage);
      if (language) {
        setSelectedLanguage(language);
      }
    }
  }, [setSelectedLanguage]);

  const translations = languageTranslations[selectedLanguage.code];

  return (
    <div>
      <div onClick={handleOpenDropDown} className="relative">
        <div className="">
          <div className="flex items-center">
            <Image
              src={selectedLanguageProperties.flagUrl}
              alt="selected-flag"
              width={selectedLanguageProperties.width}
              height={selectedLanguageProperties.height}
              className="w-40 cursor-pointer rounded-4"
            />
            <div>
              <IconContext.Provider value={{ size: "18px", color: "#999999" }}>
                {isOpenDropDown ? <RiArrowDownSLine /> : <RiArrowUpSLine />}
              </IconContext.Provider>
            </div>
          </div>
        </div>

        {isOpenDropDown ? (
          <ul className={`absolute ${isOpenDropDown ? "mt-24" : ""}`}>
            {languages.map((lang, index) => (
              <li
                onClick={() => handleLanguageChange(lang)}
                key={uuidv4()}
                className={`cursor-pointer flex items-center justify-between  mb-20`}
              >
                <Image
                  src={languageCodeToProperties(lang.code).flagUrl}
                  alt={lang.name}
                  width={languageCodeToProperties(lang.code).width}
                  height={languageCodeToProperties(lang.code).height}
                  className="w-40 cursor-pointer mr-20 rounded-4"
                />
                <p className="font-medium lg:text-18 text-menu hover:text-activeMenu">
                  {translations[lang.id]}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
