"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Users, Building2, Package, FileSpreadsheet, CreditCard, Scale, CornerDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CadastrosFlyoutPanelProps {
    isOpen: boolean;
    onClose: () => void;
    anchorRef?: React.RefObject<HTMLElement>;
}

const menuItems = [
    {
        name: "Pessoas & Empresas",
        href: "/app/cadastros/pessoas-e-empresas",
        icon: Users,
        newItem: {
            name: "Nova Pessoa & Empresa",
            href: "/app/cadastros/pessoas-e-empresas/novo"
        }
    },
    {
        name: "Produtos",
        href: "/app/cadastros/produtos",
        icon: Package,
        newItem: {
            name: "Novo Produto",
            href: "/app/cadastros/produtos/novo"
        }
    },
    {
        name: "Tabelas de Preço",
        href: "/app/cadastros/tabelas-de-preco",
        icon: FileSpreadsheet,
        newItem: {
            name: "Nova Tabela",
            href: "/app/cadastros/tabelas-de-preco/nova"
        }
    },


];

export function CadastrosFlyoutPanel({ isOpen, onClose, anchorRef }: CadastrosFlyoutPanelProps) {
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
            // Gap? No gap requested: "Submenu deve ficar COLADO ao menu principal (sem gap)"

            // Vertical: Center alignment
            // "O centro vertical do retângulo do submenu deve alinhar com o centro vertical do item “Cadastros”."
            const anchorCenterY = anchorRect.top + anchorRect.height / 2;
            let top = anchorCenterY - panelRect.height / 2;

            // Clamp Logic
            const padding = 8; // min distance from edge
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

        // "Implementar um pequeno delay de 80–150ms para evitar “flicker”"
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

    // Also attach mouse enter/leave listeners to the ANCHOR button if possible?
    // Since we can't easily modify the Sidebar button's event handlers from here without passing props down,
    // we assume the user's request "não fechar quando o mouse sai do item “Cadastros” indo para o submenu"
    // implies we need checking if mouse is on anchor.
    // However, if the sidebar button has its OWN mouse leave logic (it doesn't seem to trigger close, only click opens),
    // then we just need to make sure if we leave the PANEL we create a delay.
    // But if we leave the BUTTON to go to the PANEL, the panel isn't open yet? No, it IS open (click opens it).
    // So the sequence is: Click "Cadastros" -> Panel Open.
    // Move mouse from "Cadastros" to Panel -> No close should happen.
    // Move mouse OUT of Panel -> Close.

    // BUT user said: "Fechar quando o mouse SAIR do retângulo do submenu... Importante: não fechar quando o mouse sai do item “Cadastros” indo para o submenu."
    // This implies that if I hover Cadastros, open the menu? No, user said "Abrir ao clicar".
    // So if it's already open (clicked), and I move mouse...
    // The issue is if I click, then move mouse away from panel?
    // "Manter aberto enquanto o mouse estiver no item “Cadastros” OU dentro do submenu".
    // This looks like a Hover menu behavior mixed with Click trigger.
    // If I click to open, it's open. The mouse is likely ON existing button. 
    // If I move mouse to the panel, I leave button.
    // If I just implemented "Close on panel mouse leave", then moving from button to panel is irrelevant because I haven't ENTERED panel yet?
    // Re-read: "Fechar quando o mouse SAIR do retângulo do submenu".
    // If I am on Button, I am NOT on submenu. So submenu is closed? No, logic is "When mouse LEAVES submenu container". 
    // This means I must have entered it first? Or does it mean "If mouse is not over submenu AND not over button"?
    // A click-triggered menu usually doesn't close on mouse leave unless specifically requested like a hover menu.
    // Request: "Novo: Fechar quando o mouse SAIR do retângulo do submenu".
    // This implies: User clicks -> Open. User moves mouse into submenu. User does stuff. User leaves submenu -> Close.
    // What if user clicks and never enters submenu? It stays open until click outside? That matches "Fechar ao clicar fora".
    // The "Mouse Leave" rule is an ADDITIONAL close trigger.

    // So:
    // 1. Click Anchor -> Open. (Sidebar handles this)
    // 2. User Enter Panel -> Good.
    // 3. User Leave Panel -> Wait 150ms -> Close.
    // 4. If User returns to Panel within 150ms -> Cancel Close.
    // 5. If User goes to Anchor within 150ms -> Cancel Close? "Manter aberto enquanto o mouse estiver no item Cadastros".
    //    We need to know if mouse is over anchor.
    //    We can attach a GLOBAL mouse move or check element from point, but that's heavy.
    //    Or we can add event listeners to the anchor ref if available.

    React.useEffect(() => {
        const anchor = anchorRef?.current;
        if (!anchor || !isOpen) return;

        const onAnchorLeave = () => {
            // If we leave anchor, we prioritize the panel logic.
            // If panel didn't start a timeout, maybe we don't need one?
            // Actually if we leave anchor, we MIGHT be going to panel.
            // But the rule is "Close when mouse LEAVES SUBMENU".
            // It doesn't say "Close when mouse LEAVES ANCHOR".
            // So leaving anchor shouldn't close it necessarily, unless we treat global "out" state?
            // "Manter aberto enquanto o mouse estiver no item “Cadastros” OU dentro do submenu".
            // This phrasing suggests that if I am NOT in either, it should close?
            // But the TRIGGER for closing is "Mouse SAIR do submenu".
            // So if I never entered submenu, I can't leave it?
            // Let's implement specifically: onMouseLeave of Panel -> specific close logic.
            // And to handle "Don't close if moving to anchor", we check if we entered anchor?
            // We can listen to anchor mouse enter/leave too.
        };

        const onAnchorEnter = () => {
            if (closeTimeoutRef.current) {
                clearTimeout(closeTimeoutRef.current);
                closeTimeoutRef.current = null;
            }
        };

        anchor.addEventListener('mouseenter', onAnchorEnter);
        // anchor.addEventListener('mouseleave', onAnchorLeave); // Not needed per logic above?

        return () => {
            anchor.removeEventListener('mouseenter', onAnchorEnter);
            // anchor.removeEventListener('mouseleave', onAnchorLeave);
        };
    }, [isOpen, anchorRef]);

    // Handle Click Outside
    React.useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            // Ignore unrelated clicks
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
                // "Largura do submenu deve ser MENOR que a atual... permitir largura mínima... truncar"
                // Width reduced to 260px (from 340px) seems reasonable for a compact popover.
                "w-64 h-auto",
                isOpen
                    ? "opacity-100 scale-100 visible"
                    : "opacity-0 scale-95 invisible pointer-events-none"
            )}
            style={{
                // Use calculated position or hide offscreen until calc
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
                            "flex w-full items-center rounded-2xl transition-colors mb-0.5 group text-left px-2 py-2 hover:bg-gray-50",
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
                                    "flex w-full items-center rounded-2xl transition-colors mb-2 group/sub text-left px-2 py-1 hover:bg-gray-50",
                                )}
                            >
                                {/* Indentation: Main icon w-5 + mr-3 = 20px + 12px = 32px. 
                                    Plus a bit more for visual hierarchy. 
                                    Let's us ~28px indent padding-left? Or spacer?
                                    User asked for visual hierarchy connector.
                                */}
                                <div className="w-5 shrink-0" />

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
