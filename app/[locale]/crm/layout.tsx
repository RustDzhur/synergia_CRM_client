"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Toaster } from "react-hot-toast";
import { Header, ModalNavigation, Sidebar } from "@/components/crm";
import useAuthStore from "@/app/store/useAuthStore";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, authChecked, checkAuth } = useAuthStore();
    const router = useRouter();
    const locale = useLocale();

    useEffect(() => { checkAuth(); }, [checkAuth]);
    useEffect(() => {
        if (authChecked && !isAuthenticated) router.replace(`/${locale}`);
    }, [authChecked, isAuthenticated, router, locale]);

    if (!authChecked || !isAuthenticated) return null;

    return (
        <>
            <header className="bg-headerBackground sm:px-12 sm:py-20 md:px-18 md:py-30 lg:px-32 lg:py-30 lg:max-w-screen-lg m-auto">
                <Header />
            </header>
            <div className="flex lg:max-w-screen-lg m-auto">
                <Sidebar />
                <main className="flex-1 bg-secondaryColor min-h-screen">{children}</main>
            </div>
            <ModalNavigation />
            <Toaster />
        </>
    );
}