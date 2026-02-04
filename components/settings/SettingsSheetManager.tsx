
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/Sheet";
import AccountSheet from "./AccountSheet";
import PreferencesSheet from "./PreferencesSheet";

export function SettingsSheetManager() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const panel = searchParams.get("panel");

    // Derived state - no need for useState or useEffect
    const isAccountOpen = panel === "account";
    const isPreferencesOpen = panel === "preferences";

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
