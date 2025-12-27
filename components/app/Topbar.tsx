import { Bell, Menu } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";

interface TopbarProps {
    collapsed: boolean;
    onToggle: () => void;
}

export function Topbar({ collapsed, onToggle }: TopbarProps) {
    return (
        <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-4 shrink-0 sticky top-0 z-[60] w-full">
            {/* Left: Logo + Toggle */}
            <div className="flex items-center gap-4">
                {/* Logo Area - Fixed width when expanded matches sidebar width approximately or just auto */}
                <div className={cn("flex items-center transition-all duration-300", collapsed ? "w-auto" : "w-56")}>
                    <Logo />
                </div>

                <button
                    onClick={onToggle}
                    className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500"
                >
                    <Menu className="w-5 h-5" />
                </button>
            </div>

            {/* Right: Global Actions */}
            <div className="flex items-center gap-4">
                <button className="text-gray-500 hover:text-gray-700">
                    <Bell className="w-5 h-5" />
                </button>
                <div className="h-6 w-px bg-gray-200" />
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-sm font-medium">
                        U
                    </div>
                </div>
            </div>
        </header>
    );
}
