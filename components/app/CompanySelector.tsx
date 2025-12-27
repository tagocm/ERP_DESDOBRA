
"use client";

import { useCompany } from "@/contexts/CompanyContext";
import { ChevronsUpDown, Check, Building2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface CompanySelectorProps {
    collapsed?: boolean;
}

export function CompanySelector({ collapsed }: CompanySelectorProps) {
    const { selectedCompany, companies, setSelectedCompany } = useCompany();
    const [isOpen, setIsOpen] = useState(false);

    if (!selectedCompany) return null;

    // We use a single structure and animate inner parts to prevent layout jumping
    return (
        <div className="relative w-full group">
            <Button
                variant="ghost"
                className={cn(
                    "flex items-center transition-all duration-300 rounded-lg overflow-hidden h-12 hover:bg-gray-100",
                    // Use consistent width and padding strategy
                    // Sidebar is w-16 (64px) collapsed. Footer p-2 => 16px padding total. Available 48px.
                    // If we make the button w-full, it will be 48px wide.
                    // We want the icon centered in that 48px.
                    // Icon container w-10 (40px) leaves 4px space on each side.
                    // If we use px-0 and justify-start, the icon is at left.
                    // We need the icon container to be `w-full` when collapsed? No, fixed width.
                    // Let's use a standard grid-like approach: Icon Box | Text
                    // Icon Box is fixed width (e.g. 3rem / 48px) matching the collapsed available width.
                    // Then text flows after.
                    "w-full px-0 justify-start"
                )}
                onClick={() => setIsOpen(!isOpen)}
            >
                {/* Icon Container - matches collapsed state's effective clickable area approx */}
                <div className={cn(
                    "shrink-0 flex items-center justify-center transition-all duration-300 h-10 w-10 ml-1 mr-1", // 40px + 4px + 4px = 48px approx? No.
                    // Parent (Footer) p-2. Width 48px available.
                    // Icon container w-10 (40px) is good. Centered by ml-1 (4px) mr-1 (4px)?
                    // Or justify-center in button when collapsed?
                    // Let's keep button justify-start, and use consistent margin for icon.
                    // If we use `ml-1` normally, it shifts.
                    // Better: The button is `w-full`.
                    // When collapsed (w=48px), we want icon (w=32px or 40px) centered.
                    // 48 - 40 = 8px remaining. 4px each side.
                    // So `mx-auto` when collapsed? Or `ml-1` always?
                    // Let's force `ml-1` (4px).
                    // Expanded: Icon is left. Text follows.
                    // Width of icon box:
                    collapsed ? "ml-1" : "ml-2"
                )}>
                    {/* Inner Icon Background */}
                    <div className={cn(
                        "flex items-center justify-center rounded-lg transition-all duration-300",
                        // When collapsed: clean icon. When expanded: background box.
                        collapsed ? "w-8 h-8 bg-transparent" : "w-8 h-8 bg-brand-100"
                    )}>
                        <Building2 className={cn(
                            "transition-all duration-300",
                            collapsed ? "w-5 h-5 text-gray-600" : "w-4 h-4 text-brand-600"
                        )} />
                    </div>
                </div>

                {/* Text Container */}
                <div className={cn(
                    "flex flex-col items-start overflow-hidden transition-all duration-300 whitespace-nowrap",
                    collapsed ? "w-0 opacity-0" : "w-auto opacity-100 flex-1 ml-1"
                )}>
                    <span className="text-sm font-semibold text-gray-900 truncate w-full pr-2 text-left">
                        {selectedCompany.name}
                    </span>
                    <span className="text-xs text-gray-500 truncate w-full text-left">Trocar empresa</span>
                </div>

                {/* Chevron */}
                <ChevronsUpDown className={cn(
                    "h-4 w-4 shrink-0 text-gray-400 transition-all duration-300",
                    collapsed ? "w-0 opacity-0 mr-0" : "w-4 opacity-100 mr-2"
                )} />
            </Button>

            {/* Dropdown - Fixed positioning (Popover-like) to avoid layout issues */}
            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40 bg-transparent"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className={cn(
                        "absolute z-50 bg-white rounded-xl border border-gray-200 shadow-xl py-1 animate-in fade-in zoom-in-95 duration-200 w-64",
                        // Position based on collapsed state
                        collapsed
                            ? "left-full bottom-0 ml-2"
                            : "bottom-full left-0 right-0 mb-2 w-full"
                    )}>
                        <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Minhas Empresas
                        </div>
                        <div className="max-h-[200px] overflow-y-auto">
                            {companies.map((company) => (
                                <button
                                    key={company.id}
                                    className={cn(
                                        "w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-gray-50 text-left transition-colors",
                                        selectedCompany.id === company.id && "bg-brand-50/50"
                                    )}
                                    onClick={() => {
                                        setSelectedCompany(company);
                                        setIsOpen(false);
                                    }}
                                >
                                    <div className="flex items-center gap-3 truncate">
                                        <div className={cn(
                                            "w-2 h-2 rounded-full",
                                            selectedCompany.id === company.id ? "bg-brand-500" : "bg-gray-300"
                                        )} />
                                        <span className={cn(
                                            "truncate",
                                            selectedCompany.id === company.id ? "font-medium text-brand-900" : "text-gray-600"
                                        )}>
                                            {company.name}
                                        </span>
                                    </div>
                                    {selectedCompany.id === company.id && (
                                        <Check className="w-4 h-4 text-brand-600" />
                                    )}
                                </button>
                            ))}
                        </div>
                        <div className="border-t border-gray-100 mt-1 pt-1 p-1">
                            <button
                                className="w-full text-left px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
                                onClick={() => setIsOpen(false)}
                            >
                                + Gerenciar Empresas
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
