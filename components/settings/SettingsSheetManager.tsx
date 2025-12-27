
"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/Sheet";
import AccountSheet from "./AccountSheet";
import PreferencesSheet from "./PreferencesSheet";

export function SettingsSheetManager() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const panel = searchParams.get("panel");

    const [isAccountOpen, setIsAccountOpen] = useState(false);
    const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);

    useEffect(() => {
        if (panel === "account") {
            setIsAccountOpen(true);
            setIsPreferencesOpen(false);
        } else if (panel === "preferences") {
            setIsPreferencesOpen(true);
            setIsAccountOpen(false);
        } else {
            setIsAccountOpen(false);
            setIsPreferencesOpen(false);
        }
    }, [panel]);

    const handleClose = () => {
        // Remove query param to close sheet
        const currentPath = window.location.pathname;
        router.push(currentPath);
    };

    return (
        <>
            <Sheet
                isOpen={isAccountOpen}
                onClose={handleClose}
                title="Conta"
            >
                <AccountSheet />
            </Sheet>

            <Sheet
                isOpen={isPreferencesOpen}
                onClose={handleClose}
                title="Preferências"
            >
                <PreferencesSheet />
            </Sheet>
        </>
    );
}
