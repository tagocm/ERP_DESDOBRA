
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
            className="px-2 py-1.5 rounded text-[11px] border border-red-200 bg-red-50 hover:bg-red-100 hover:border-red-300 cursor-pointer transition-colors group relative"
        >
            <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-700 truncate flex-1 min-w-0">
                    {name}
                </span>
                <span className="shrink-0 flex items-center gap-2 text-red-700 font-semibold leading-none">
                    <span className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {shortage} {uom}
                    </span>
                    {recipes > 0 && (
                        <span className="flex items-center gap-1 text-amber-700 bg-amber-100/50 px-1.5 py-0.5 rounded">
                            <Utensils className="w-2.5 h-2.5" />
                            {recipes}
                        </span>
                    )}
                </span>
            </div>
        </div>
    )
}
