
import { cn } from "@/lib/utils"
import { AlertTriangle, Utensils } from "lucide-react"

interface PendingSkuCardProps {
    name: string
    shortage: number
    recipes: number
    uom: string
    onClick?: () => void
}

export function PendingSkuCard({ name, shortage, recipes, uom, onClick }: PendingSkuCardProps) {
    return (
        <div
            onClick={onClick}
            className="p-1.5 rounded text-[10px] border border-red-200 bg-red-50 hover:bg-red-100 hover:border-red-300 cursor-pointer transition-colors group relative"
        >
            <div className="font-semibold text-slate-700 truncate pr-1 mb-0.5">
                {name}
            </div>
            <div className="flex items-center justify-between text-red-700 font-medium leading-none">
                <span className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {shortage} {uom}
                </span>
                {recipes > 0 && (
                    <span className="flex items-center gap-1 text-amber-700 bg-amber-100/50 px-1 rounded">
                        <Utensils className="w-2.5 h-2.5" />
                        {recipes}
                    </span>
                )}
            </div>
        </div>
    )
}
