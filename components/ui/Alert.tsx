import { cva, type VariantProps } from "class-variance-authority";
import { X, AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const alertVariants = cva(
    "fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-[480px] rounded-xl border shadow-2xl backdrop-blur-sm transition-all duration-300 animate-in fade-in slide-in-from-top-4",
    {
        variants: {
            variant: {
                default: "bg-white/95 text-gray-900 border-gray-200",
                destructive:
                    "bg-gradient-to-br from-red-50/95 to-white/95 text-red-900 border-red-200/80",
                success:
                    "bg-gradient-to-br from-emerald-50/95 to-white/95 text-emerald-900 border-emerald-200/80",
                warning:
                    "bg-gradient-to-br from-amber-50/95 to-white/95 text-amber-900 border-amber-200/80",
                info:
                    "bg-gradient-to-br from-blue-50/95 to-white/95 text-blue-900 border-blue-200/80",
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
    const iconConfig = {
        destructive: { Icon: AlertCircle, className: "text-red-600" },
        success: { Icon: CheckCircle2, className: "text-emerald-600" },
        warning: { Icon: AlertTriangle, className: "text-amber-600" },
        info: { Icon: Info, className: "text-blue-600" },
        default: { Icon: Info, className: "text-gray-600" },
    };

    const { Icon, className: iconClassName } = iconConfig[variant || "default"];

    return (
        <div
            role="alert"
            className={cn(alertVariants({ variant }), className)}
            {...props}
        >
            <div className="flex items-start gap-3 p-4">
                <div className={cn("shrink-0 mt-0.5", iconClassName)}>
                    <Icon className="h-5 w-5" strokeWidth={2.5} />
                </div>
                <div className="flex-1 text-sm font-medium leading-relaxed pt-0.5">
                    {children}
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="shrink-0 -mr-1 -mt-1 p-1.5 rounded-lg transition-all hover:bg-black/5 active:scale-95"
                        aria-label="Fechar"
                    >
                        <X className="h-4 w-4 opacity-60" />
                    </button>
                )}
            </div>
        </div>
    );
}
