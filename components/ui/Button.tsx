
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-2xl text-sm font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95 duration-100",
    {
        variants: {
            variant: {
                primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-md shadow-brand-600/20",
                secondary: "bg-white text-gray-900 shadow-sm border border-gray-200 hover:bg-gray-50",
                ghost: "hover:bg-gray-100 hover:text-gray-900 text-gray-600",
                danger: "bg-red-500 text-white hover:bg-red-600 shadow-sm",
                outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
                pill: "rounded-full bg-brand-600 text-white hover:bg-brand-700 shadow-md shadow-brand-600/20 px-6",
                pillOutline: "rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 shadow-sm px-6",
            },
            size: {
                sm: "h-8 px-3 text-xs",
                md: "h-10 px-4 py-2",
                lg: "h-12 px-8 text-base",
                icon: "h-10 w-10",
            },
        },
        defaultVariants: {
            variant: "primary",
            size: "md",
        },
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> { }

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, ...props }, ref) => {
        return (
            <button
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }
