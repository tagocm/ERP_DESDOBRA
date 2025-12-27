
import { cn } from "@/lib/utils";
import { LayoutGrid } from "lucide-react";

interface LogoProps {
    className?: string;
    collapsed?: boolean;
}

export function Logo({ className, collapsed = false }: LogoProps) {
    return (
        <div className={cn("flex items-center gap-2", className)}>
            <div className="bg-brand-600 text-white p-1.5 rounded-lg">
                <LayoutGrid className="w-5 h-5" />
            </div>
            {!collapsed && (
                <span className="font-bold text-xl tracking-tight text-gray-900">
                    Desdobra
                </span>
            )}
        </div>
    );
}
