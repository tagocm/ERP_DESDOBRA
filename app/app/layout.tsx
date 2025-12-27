
"use client";

import { CompanyProvider } from "@/contexts/CompanyContext";
import { HeaderProvider } from "@/contexts/HeaderContext";
import { Sidebar } from "@/components/app/Sidebar";
import { Topbar } from "@/components/app/Topbar";
import { SettingsSheetManager } from "@/components/settings/SettingsSheetManager";
import { useState } from "react";

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

    return (
        <CompanyProvider>
            <HeaderProvider>
                <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
                    <Topbar collapsed={isSidebarCollapsed} onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
                    <div className="flex flex-1 overflow-hidden">
                        <Sidebar collapsed={isSidebarCollapsed} />
                        <main className="flex-1 overflow-auto bg-gray-50/50">
                            {children}
                        </main>
                    </div>
                    <SettingsSheetManager />
                </div>
            </HeaderProvider>
        </CompanyProvider>
    );
}
