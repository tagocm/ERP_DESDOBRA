"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState, useRef } from "react";
import {
    Target, ShoppingCart, PackageCheck, Package, Factory,
    ShoppingBag, DollarSign, FileText, Users, Truck,
    Database, Settings, ChevronLeft, ChevronRight,
    Search, LogOut
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { CadastrosFlyoutPanel } from "./CadastrosFlyoutPanel";
import { ConfiguracoesFlyoutPanel } from "./ConfiguracoesFlyoutPanel";
import { VendasFlyoutPanel } from "./VendasFlyoutPanel";
import { createClient } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";

interface NavItem {
    name: string;
    href: string;
    icon: React.ElementType;
    isButton?: boolean; // New prop to identify button-like items
}

interface NavGroup {
    label: string;
    items: NavItem[];
}

// Updated Order per request
// CRM / Pipeline, Vendas, Compras, Produção, Estoque, Expedição, Financeiro, Fiscal, Cadastros, RH, Frota, Configurações
const navGroups: NavGroup[] = [
    {
        label: "Comercial",
        items: [
            { name: "CRM / Pipeline", href: "/app/crm/pipeline", icon: Target },
            { name: "Vendas", href: "#", icon: ShoppingCart, isButton: true },
        ]
    },
    {
        label: "Suprimentos & Produção",
        items: [
            { name: "Compras", href: "/app/compras/pedidos", icon: ShoppingBag },
            { name: "Produção (PCP)", href: "/app/producao/ordens", icon: Factory },
            { name: "Estoque", href: "/app/estoque/movimentacoes", icon: Package },
            { name: "Expedição", href: "/app/expedicao-separacao", icon: PackageCheck },
        ]
    },
    {
        label: "Administrativo",
        items: [
            { name: "Financeiro", href: "/app/financeiro/receber", icon: DollarSign },
            { name: "Fiscal", href: "/app/fiscal/nfe", icon: FileText },
            { name: "RH", href: "/app/rh/colaboradores", icon: Users },
            { name: "Frota", href: "/app/frota/veiculos", icon: Truck },
        ]
    },
    // Cadastros e Configurações could be their own groups or just items
    // Request says "Cadastros (submenu)" and "Configurações (submenu)"
    // For now I'll keep them as main items leading to the menus or as expanded sections.
    // Given the previous structure used "groups", I will put them in a "Sistema" group but as simple links for now unless I implement proper nested accordion.
    // The request implies they are main menu items that have submenus.
    // Let's assume standard navigation matches.
    {
        label: "Sistema",
        items: [
            { name: "Cadastros", href: "#", icon: Database, isButton: true },
            { name: "Configurações", href: "#", icon: Settings, isButton: true },
        ]
    }
];

interface SidebarProps {
    collapsed: boolean;
}

export function Sidebar({ collapsed }: SidebarProps) {
    const pathname = usePathname();
    const [expandedSection, setExpandedSection] = useState<string | null>("Comercial");
    const [openMorePopover, setOpenMorePopover] = useState<string | null>(null);
    const [isHovered, setIsHovered] = useState(false);

    const router = useRouter();
    const supabase = createClient();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.refresh();
        router.push('/login');
    };

    // Flyout State
    const [isCadastrosOpen, setIsCadastrosOpen] = useState(false);
    const cadastrosRef = React.useRef<HTMLButtonElement>(null);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const settingsRef = React.useRef<HTMLButtonElement>(null);

    const [isVendasOpen, setIsVendasOpen] = useState(false);
    const vendasRef = React.useRef<HTMLButtonElement>(null);

    // Density state based on height
    const [density, setDensity] = useState<'normal' | 'compact' | 'icons'>('normal');

    // To trigger key press simulation for Command Palette
    const openPalette = () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    };

    const isActive = (href: string) => {
        const moduleRoot = href.split('/').slice(0, 3).join('/');
        return pathname.startsWith(moduleRoot);
    };

    // Auto-expand section based on active route
    useState(() => {
        for (const group of navGroups) {
            if (group.items.some(i => isActive(i.href))) {
                setExpandedSection(group.label);
                break;
            }
        }
    });

    const toggleSection = (label: string) => {
        if (expandedSection === label) {
            setExpandedSection(null);
        } else {
            setExpandedSection(label);
        }
        setOpenMorePopover(null);
    };

    // Density Logic
    useState(() => {
        // Safe check for window
        if (typeof window !== 'undefined') {
            const handleResize = () => {
                const h = window.innerHeight;
                if (h < 720) {
                    setDensity('icons');
                } else if (h < 820) {
                    setDensity('compact');
                } else {
                    setDensity('normal');
                }
            };

            // Initial check
            handleResize();

            window.addEventListener('resize', handleResize);
            return () => window.removeEventListener('resize', handleResize);
        }
    });

    // Forced collapsed visualization
    const isVisuallyCollapsed = (collapsed || density === 'icons') && !isHovered;

    return (
        <TooltipProvider>
            <div
                className={cn(
                    "relative h-full transition-all duration-300 z-50 bg-white",
                    (collapsed || density === 'icons') ? "w-16" : "w-64"
                )}
                onMouseEnter={() => (collapsed || density === 'icons') && setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <aside
                    className={cn(
                        "border-r border-gray-200 bg-white flex flex-col transition-all duration-300 h-full",
                        ((collapsed || density === 'icons') && isHovered)
                            ? "absolute top-0 left-0 w-64 z-50 rounded-r-2xl border-r-2 border-brand-100"
                            : "w-full"
                    )}
                >
                    {/* Search / Command Palette Trigger - Compact based on density */}
                    <div className={cn("border-b border-gray-100 transition-all duration-300", density === 'compact' ? "p-1.5" : "p-2")}>
                        <button
                            onClick={openPalette}
                            className={cn(
                                "flex items-center gap-0 w-full border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-2xl transition-all duration-300 overflow-hidden",
                                // Height stays relatively consistent or transitions smoothly
                                density === 'compact' ? "h-8" : "h-9",
                                // When collapsed: centered icon, no padding for text. 
                                // Actually better: Always use px-0 and center the icon container.
                                isVisuallyCollapsed ? "px-0" : "px-2"
                            )}
                            title="Busca (Cmd+K)"
                        >
                            {/* Icon Container - Fixed Width to match collapsed state width approx */}
                            <div className={cn(
                                "flex items-center justify-center shrink-0 transition-all duration-300",
                                isVisuallyCollapsed ? "w-full" : "w-5 mr-2"
                            )}>
                                <Search className={cn("shrink-0", density === 'compact' ? "w-3.5 h-3.5" : "w-4 h-4")} />
                            </div>

                            {/* Text Container - Animates width/opacity */}
                            <div className={cn(
                                "flex items-center flex-1 overflow-hidden transition-all duration-300 whitespace-nowrap",
                                isVisuallyCollapsed
                                    ? "w-0 opacity-0"
                                    : "w-auto opacity-100"
                            )}>
                                <span className="flex-1 text-left text-xs">Buscar...</span>
                                <kbd className="pointer-events-none inline-flex items-center gap-1 rounded border bg-white px-1 font-mono text-[9px] font-medium text-gray-500 opacity-100 h-4 ml-1">
                                    ⌘K
                                </kbd>
                            </div>
                        </button>
                    </div>

                    {/* Nav Items - Scrollable area BUT STRICT NO SCROLL per requirement "Sidebar SEM SCROLL" 
                   "Proibido: overflow-y: auto" 
                   Requirement says "sidebar divided in 3 blocks... SidebarNav (lista completa)".
                   If list is strictly required to fit, we rely on density. 
                   However, safer to allow scroll if absolutely necessary, but hidden scrollbar + density should prevent it.
                   Let's use overflow-hidden as requested but auto as fallback if user has extremely small height?
                   "Sidebar com height: calc(100vh - TOPBAR_HEIGHT) e overflow: hidden" -> Meaning we must fit.
                */}
                    <nav className={cn("flex-1 overflow-hidden py-1 px-2 space-y-1", density === 'compact' ? "space-y-0.5" : "space-y-2")}>
                        {navGroups.map((group, index) => {
                            const isGroupActive = group.items.some(i => isActive(i.href));

                            return (
                                <div key={group.label} className={cn("border-b border-gray-100 pb-1 mb-1 last:border-0", density === 'compact' ? "pb-0.5 mb-0.5" : "")}>
                                    {group.items.map((item) => (
                                        <Tooltip key={item.name} delayDuration={0} disableHoverableContent={!isVisuallyCollapsed}>
                                            <TooltipTrigger asChild>
                                                {item.isButton ? (
                                                    <button
                                                        ref={item.name === "Cadastros" ? cadastrosRef : item.name === "Configurações" ? settingsRef : item.name === "Vendas" ? vendasRef : null}
                                                        onClick={() => {
                                                            if (item.name === "Cadastros") setIsCadastrosOpen(true);
                                                            if (item.name === "Configurações") setIsSettingsOpen(true);
                                                            if (item.name === "Vendas") setIsVendasOpen(true);
                                                        }}
                                                        className={cn(
                                                            "flex w-full items-center rounded-2xl transition-all duration-300 mb-0.5 group overflow-hidden whitespace-nowrap text-left",
                                                            density === 'compact' ? "h-8" : "h-9",
                                                            (item.name === "Cadastros" && (isActive('/app/cadastros') || isCadastrosOpen)) ||
                                                                (item.name === "Configurações" && (isActive('/app/configuracoes') || isSettingsOpen)) ||
                                                                (item.name === "Vendas" && (isActive('/app/vendas') || isVendasOpen))
                                                                ? "bg-brand-50 text-brand-700 font-medium"
                                                                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                                                        )}
                                                    >
                                                        {/* Fixed Icon Container - ALWAYS w-16 (should match collapsed width 4rem/64px - wait, collapsed is w-16 (64px)) */}
                                                        {/* Parent padding is px-2 (0.5rem each side). Total space 64px. */}
                                                        {/* Content width = 64 - 16 = 48px. */}
                                                        {/* If we center icon in 48px: */}
                                                        <div className="w-[calc(4rem-1rem)] flex items-center justify-center shrink-0 transition-all duration-300">
                                                            <item.icon className="w-5 h-5" />
                                                        </div>

                                                        {/* Text - Transitions opacity/width */}
                                                        <span
                                                            className={cn(
                                                                "text-sm transition-all duration-300 origin-left truncate",
                                                                isVisuallyCollapsed ? "w-0 opacity-0 -ml-2" : "w-auto opacity-100 ml-0 flex-1 pr-4"
                                                            )}
                                                        >
                                                            {item.name}
                                                        </span>
                                                    </button>
                                                ) : (
                                                    <Link
                                                        href={item.href}
                                                        className={cn(
                                                            "flex items-center rounded-md transition-all duration-300 mb-0.5 group overflow-hidden whitespace-nowrap",
                                                            density === 'compact' ? "h-8" : "h-9",
                                                            isActive(item.href)
                                                                ? "bg-brand-50 text-brand-700 font-medium"
                                                                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                                                        )}
                                                    >
                                                        {/* Fixed Icon Container - ALWAYS w-16 (should match collapsed width 4rem/64px - wait, collapsed is w-16 (64px)) */}
                                                        {/* Parent padding is px-2 (0.5rem each side). Total space 64px. */}
                                                        {/* Content width = 64 - 16 = 48px. */}
                                                        {/* If we center icon in 48px: */}
                                                        <div className="w-[calc(4rem-1rem)] flex items-center justify-center shrink-0 transition-all duration-300">
                                                            <item.icon className="w-5 h-5" />
                                                        </div>

                                                        {/* Text - Transitions opacity/width */}
                                                        <span
                                                            className={cn(
                                                                "text-sm transition-all duration-300 origin-left truncate",
                                                                isVisuallyCollapsed ? "w-0 opacity-0 -ml-2" : "w-auto opacity-100 ml-0 flex-1 pr-4"
                                                            )}
                                                        >
                                                            {item.name}
                                                        </span>
                                                    </Link>
                                                )}
                                            </TooltipTrigger>
                                            {/* Only show Tooltip if collapsed */}
                                            {isVisuallyCollapsed && <TooltipContent side="right">{item.name}</TooltipContent>}
                                        </Tooltip>
                                    ))}
                                </div>
                            );
                        })}
                    </nav>

                    {/* Footer: Company Selector - Fixed at bottom */}
                    {/* Footer: Logout Button */}
                    <div className="p-2 border-t border-gray-200 mt-auto bg-white mb-0 sticky bottom-0">
                        <Tooltip delayDuration={0} disableHoverableContent={!isVisuallyCollapsed}>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={handleLogout}
                                    className={cn(
                                        "flex w-full items-center rounded-md transition-all duration-300 mb-0.5 group overflow-hidden whitespace-nowrap text-left",
                                        density === 'compact' ? "h-8" : "h-9",
                                        "text-red-600 hover:bg-red-50 hover:text-red-700"
                                    )}
                                >
                                    <div className="w-[calc(4rem-1rem)] flex items-center justify-center shrink-0 transition-all duration-300">
                                        <LogOut className="w-5 h-5" />
                                    </div>
                                    <span
                                        className={cn(
                                            "text-sm transition-all duration-300 origin-left truncate font-medium",
                                            isVisuallyCollapsed ? "w-0 opacity-0 -ml-2" : "w-auto opacity-100 ml-0 flex-1 pr-4"
                                        )}
                                    >
                                        Sair do Sistema
                                    </span>
                                </button>
                            </TooltipTrigger>
                            {isVisuallyCollapsed && <TooltipContent side="right" className="text-red-600">Sair</TooltipContent>}
                        </Tooltip>
                    </div>

                    <CommandPalette />

                    {/* Flyouts */}
                    <CadastrosFlyoutPanel
                        isOpen={isCadastrosOpen}
                        onClose={() => setIsCadastrosOpen(false)}
                        anchorRef={cadastrosRef as any}
                    />

                    <ConfiguracoesFlyoutPanel
                        isOpen={isSettingsOpen}
                        onClose={() => setIsSettingsOpen(false)}
                        anchorRef={settingsRef as any}
                    />

                    <VendasFlyoutPanel
                        isOpen={isVendasOpen}
                        onClose={() => setIsVendasOpen(false)}
                        anchorRef={vendasRef as any}
                    />
                </aside>
            </div>
        </TooltipProvider>
    );
}
