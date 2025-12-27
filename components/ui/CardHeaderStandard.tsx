import * as React from "react"
import { cn } from "@/lib/utils"
import { CardHeader, CardTitle, CardDescription } from "./Card"

interface CardHeaderStandardProps extends React.HTMLAttributes<HTMLDivElement> {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    actions?: React.ReactNode;
}

/**
 * ERP Official Card Header (Card Ouro Standard)
 * Pattern: [Icon] [Title + Subtitle] (Left) | [Actions] (Right)
 * No dividers, no backgrounds.
 */
export function CardHeaderStandard({
    icon,
    title,
    description,
    actions,
    className,
    ...props
}: CardHeaderStandardProps) {
    return (
        <CardHeader className={cn("p-6", className)} {...props}>
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                    {icon && (
                        <div className="text-gray-500 flex-shrink-0 mt-1">
                            {icon}
                        </div>
                    )}
                    <div className="flex flex-col min-w-0">
                        <CardTitle className="truncate text-xl font-bold text-gray-900 tracking-tight pt-[0.5px]">
                            {title}
                        </CardTitle>
                        {description && (
                            <CardDescription className="line-clamp-1 text-sm text-gray-500 mt-0.5">
                                {description}
                            </CardDescription>
                        )}
                    </div>
                </div>
                {actions && (
                    <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                        {actions}
                    </div>
                )}
            </div>
        </CardHeader>
    )
}
