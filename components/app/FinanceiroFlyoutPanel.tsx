"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowUpCircle, ArrowDownCircle, CheckCircle, BarChart3, LineChart, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";

interface FinanceiroFlyoutPanelProps {
    isOpen: boolean;
    onClose: () => void;
    anchorRef?: React.RefObject<HTMLElement>;
}

const menuItems = [
    {
        name: "Aprovações (Em Rota)",
        href: "/app/financeiro/aprovacoes",
        icon: CheckCircle
    },
    {
        name: "Contas",
        href: "/app/financeiro/contas",
        icon: ArrowDownCircle // Using a generic icon or one of the arrows for now, or maybe 'Wallet' if imported. 
        // Let's stick to ArrowDownCircle since Receivables is the main data for now, 
        // or better, use 'Receipt' or 'FileText' if available. 
        // I'll check imports. 
    },
    {
        name: "Fluxo de Caixa",
        href: "/app/financeiro/fluxo",
        icon: LineChart
    },
    {
        name: "DRE",
        href: "/app/financeiro/dre",
        icon: BarChart3
    },
    {
        name: "Fatos Geradores",
        href: "/app/financeiro/fatos-geradores",
        icon: Repeat
    }
];

export function FinanceiroFlyoutPanel({ isOpen, onClose, anchorRef }: FinanceiroFlyoutPanelProps) {
    const router = useRouter();
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
                "fixed bg-white border border-gray-100 shadow-float rounded-2xl overflow-hidden flex flex-col transition-all duration-200 ease-out z-50",
                "w-64 h-auto",
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
            <div className="py-2 px-1 space-y-0.5">
                {menuItems.map((item) => (
                    <div key={item.href} className="flex flex-col">
                        <button
                            onClick={() => handleNavigation(item.href)}
                            className={cn(
                                "flex w-full items-center rounded-2xl transition-colors mb-0.5 group text-left px-2 py-2 hover:bg-gray-50",
                            )}
                        >
                            <item.icon className="w-5 h-5 text-gray-500 group-hover:text-gray-900 transition-colors mr-3 shrink-0" />
                            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 truncate">
                                {item.name}
                            </span>
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
