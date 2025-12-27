import { cva, type VariantProps } from "class-variance-authority";
import { X, AlertCircle, CheckCircle, Info } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const alertVariants = cva(
    "fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-[600px] p-4 rounded-lg border shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-top-2",
    {
        variants: {
            variant: {
                default: "bg-background text-foreground border-border",
                destructive:
                    "bg-red-50 text-red-900 border-red-200 dark:border-red-900/50 dark:text-red-200 dark:bg-red-900/10",
                success:
                    "bg-green-50 text-green-900 border-green-200 dark:border-green-900/50 dark:text-green-200 dark:bg-green-900/10",
                warning:
                    "bg-yellow-50 text-yellow-900 border-yellow-200 dark:border-yellow-900/50 dark:text-yellow-200 dark:bg-yellow-900/10",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
);

interface AlertProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
    onClose?: () => void;
}

export function Alert({ className, variant, children, onClose, ...props }: AlertProps) {
    const Icon = variant === "destructive" ? AlertCircle : variant === "success" ? CheckCircle : Info;

    return (
        <div
            role="alert"
            className={cn(alertVariants({ variant }), className)}
            {...props}
        >
            <div className="flex items-start gap-4">
                <Icon className="h-5 w-5 mt-0.5 shrink-0" />
                <div className="flex-1 text-sm font-medium leading-relaxed">
                    {children}
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="shrink-0 -mr-1 -mt-1 p-1 rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>
        </div>
    );
}
