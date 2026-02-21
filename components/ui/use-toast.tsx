"use client"

import React, { createContext, useContext, useState, useCallback } from "react"
import { X, CheckCircle, AlertCircle } from "lucide-react"

type ToastType = {
    id: string
    title?: string
    description?: string
    variant?: "default" | "destructive"
}

const ToastContext = createContext<{ toast: (t: Omit<ToastType, "id">) => void } | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<ToastType[]>([])

    const toast = useCallback(({ title, description, variant }: Omit<ToastType, "id">) => {
        const id = Math.random().toString(36).substr(2, 9)
        setToasts((prev) => [...prev, { id, title, description, variant }])

        // Auto remove after 4 seconds
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id))
        }, 4000)
    }, [])

    const removeToast = (id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
    }

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}
            <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 w-full max-w-[380px] pointer-events-none">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className={`
                            pointer-events-auto flex w-full transform rounded-2xl bg-white p-4 shadow-card border border-gray-200/70 transition-all duration-300 animate-in slide-in-from-top-full md:slide-in-from-right-full
                            ${t.variant === "destructive"
                                ? "border-l-4 border-l-red-500"
                                : "border-l-4 border-l-green-500"
                            }
                        `}
                    >
                        <div className="flex w-full gap-3">
                            {t.variant === "destructive" ? (
                                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                            ) : (
                                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                            )}
                            <div className="flex flex-col gap-1 w-full">
                                {t.title && <p className="text-sm font-semibold text-gray-900">{t.title}</p>}
                                {t.description && <p className="text-sm text-gray-500">{t.description}</p>}
                            </div>
                            <button
                                onClick={() => removeToast(t.id)}
                                className="shrink-0 rounded-md p-1 transition-colors hover:bg-gray-100 text-gray-400 hover:text-gray-900"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    )
}

export const useToast = () => {
    const context = useContext(ToastContext)
    if (!context) {
        // Fallback during build or if provider missing (though we will add it)
        return { toast: (props: Omit<ToastType, "id">) => console.log("TOAST (No Provider):", props) }
    }
    return context
}
