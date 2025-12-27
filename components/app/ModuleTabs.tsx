"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface TabItem {
    name: string;
    href: string;
}

interface ModuleTabsProps {
    items: TabItem[];
}

export function ModuleTabs({ items }: ModuleTabsProps) {
    const pathname = usePathname();

    return (
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
            {items.map((item) => {
                // Active if the current path starts with the tab href
                // But we need to be careful with overlapping paths if any.
                // Assuming distinct paths for tabs.
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                            isActive
                                ? "border-brand-600 text-brand-600"
                                : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
                        )}
                    >
                        {item.name}
                    </Link>
                );
            })}
        </div>
    );
}
