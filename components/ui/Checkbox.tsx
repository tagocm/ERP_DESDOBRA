"use client"

import * as React from "react"
import { Check, Minus } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & { checked?: boolean | "indeterminate"; onCheckedChange?: (checked: boolean) => void }
>(({ className, checked, onCheckedChange, ...props }, ref) => {
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={checked === "indeterminate" ? "mixed" : checked}
            onClick={() => {
                if (onCheckedChange) {
                    onCheckedChange(checked === "indeterminate" ? true : !checked);
                }
            }}
            ref={ref}
            className={cn(
                "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground",
                checked === true || checked === "indeterminate" ? "bg-brand-600 border-brand-600 text-white" : "border-gray-400 bg-white",
                className
            )}
            {...props}
        >
            <div className={cn("flex items-center justify-center text-current")}>
                {checked === true && <Check className="h-3 w-3 font-bold stroke-[3px]" />}
                {checked === "indeterminate" && <Minus className="h-3 w-3 font-bold stroke-[3px]" />}
            </div>
        </button>
    )
})
Checkbox.displayName = "Checkbox"

export { Checkbox }
