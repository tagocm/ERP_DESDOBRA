"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { FileText, Settings, CornerDownRight, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

interface FiscalFlyoutPanelProps {
    isOpen: boolean;
    onClose: () => void;
    anchorRef?: React.RefObject<HTMLElement>;
}

const menuItems = [
    {
        name: "Notas Fiscais (NF-e)",
        href: "/app/fiscal/nfe",
        icon: FileText,
    },
    {
        name: "Grupos Tributários",
        href: "/app/fiscal/configuracoes",
        icon: ScrollText,
    },
    {
        name: "Operações Fiscais",
        href: "/app/fiscal/operacoes",
        icon: Settings,
        newItem: {
            name: "Nova Regra",
            href: "/app/fiscal/operacoes/novo"
        }
    }
];

export function FiscalFlyoutPanel({ isOpen, onClose, anchorRef }: FiscalFlyoutPanelProps) {
    const router = useRouter();
    const pathname = usePathname();
    const panelRef = React.useRef<HTMLDivElement>(null);
    const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);
    const closeTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    // Calculate position when opening
    React.useLayoutEffect(() => {
        if (!isOpen || !anchorRef?.current || !panelRef.current) return;

        const calculatePosition = () => {
            const anchorRect = anchorRef.current!.getBoundingClientRect();
            const panelRect = panelRef.current!.getBoundingClientRect();
            const viewportHeight = window.innerHeight;

            // Horizontal: Stick to the right edge of the anchor (sidebar)
            const left = anchorRect.right;

            // Vertical: Center alignment
            const anchorCenterY = anchorRect.top + anchorRect.height / 2;
            let top = anchorCenterY - panelRect.height / 2;

            // Clamp Logic
            const padding = 8;
            const maxTop = viewportHeight - panelRect.height - padding;
            const minTop = padding;

            if (top < minTop) top = minTop;
            if (top > maxTop) top = maxTop;

            setPosition({ top, left });
        };

        calculatePosition();

        // Recalculate on resize
        window.addEventListener("resize", calculatePosition);
        return () => window.removeEventListener("resize", calculatePosition);
    }, [isOpen, anchorRef]);

    // Handle ESC
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                onClose();
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    const handleNavigation = (href: string) => {
        onClose();
        router.push(href);
    };

    // Mouse Leave Logic (Grace/Bridge)
    const handleMouseLeave = () => {
        if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);

        closeTimeoutRef.current = setTimeout(() => {
            onClose();
        }, 120);
    };

    const handleMouseEnter = () => {
        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }
    };

    // Anchor hover management
    React.useEffect(() => {
        const anchor = anchorRef?.current;
        if (!anchor || !isOpen) return;

        const onAnchorEnter = () => {
            if (closeTimeoutRef.current) {
                clearTimeout(closeTimeoutRef.current);
                closeTimeoutRef.current = null;
            }
        };

        anchor.addEventListener('mouseenter', onAnchorEnter);

        return () => {
            anchor.removeEventListener('mouseenter', onAnchorEnter);
        };
    }, [isOpen, anchorRef]);

    // Handle Click Outside
    React.useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (panelRef.current && panelRef.current.contains(target)) return;
            if (anchorRef?.current && anchorRef.current.contains(target)) return;

            onClose();
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen, onClose, anchorRef]);

    return (
        <div
            ref={panelRef}
            className={cn(
                "fixed bg-white border border-gray-100 shadow-lg rounded-lg overflow-hidden flex flex-col transition-all duration-200 ease-out z-[50]",
                "w-[240px] h-auto",
                isOpen
                    ? "opacity-100 scale-100 visible"
                    : "opacity-0 scale-95 invisible pointer-events-none"
            )}
            style={{
                top: position ? `${position.top}px` : '-9999px',
                left: position ? `${position.left}px` : '-9999px',
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseLeave={handleMouseLeave}
            onMouseEnter={handleMouseEnter}
        >
            {/* Content List */}
            <div className="py-2 px-1 space-y-0.5">
                {menuItems.map((item) => (
                    <div key={item.href} className="flex flex-col">
                        {/* Main Item */}
                        <button
                            onClick={() => handleNavigation(item.href)}
                            className={cn(
                                "flex w-full items-center rounded-md transition-colors mb-0.5 group text-left px-2 py-2 hover:bg-gray-50",
                            )}
                        >
                            <item.icon className="w-5 h-5 text-gray-500 group-hover:text-gray-900 transition-colors mr-3 shrink-0" />
                            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 truncate">
                                {item.name}
                            </span>
                        </button>

                        {/* Sub Item */}
                        {item.newItem && (
                            <button
                                onClick={() => handleNavigation(item.newItem!.href)}
                                className={cn(
                                    "flex w-full items-center rounded-md transition-colors mb-2 group/sub text-left px-2 py-1 hover:bg-gray-50",
                                )}
                            >
                                <div className="w-[1.25rem] shrink-0" />
                                <CornerDownRight className="w-3.5 h-3.5 mr-2 text-gray-300 group-hover/sub:text-gray-500 transition-colors shrink-0" />
                                <span className="text-[13px] text-gray-500 group-hover/sub:text-gray-800 font-normal truncate">
                                    {item.newItem.name}
                                </span>
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
