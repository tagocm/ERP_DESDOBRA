"use client";

import React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmDialogDesdobraProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel?: () => void;
    variant?: "default" | "danger" | "success" | "info";
    isLoading?: boolean;
    closeOnOutsideClick?: boolean;
}

export function ConfirmDialogDesdobra({
    open,
    onOpenChange,
    title,
    description,
    confirmText = "Confirmar",
    cancelText = "Cancelar",
    onConfirm,
    onCancel,
    variant = "default",
    isLoading = false,
    closeOnOutsideClick = true
}: ConfirmDialogDesdobraProps) {
    const handleConfirm = (e: React.MouseEvent) => {
        e.preventDefault();
        onConfirm();
    };

    const handleCancel = (e: React.MouseEvent) => {
        e.preventDefault();
        if (onCancel) onCancel();
        onOpenChange(false);
    };

    let confirmButtonVariant: "primary" | "danger" | "default" | "secondary" | "ghost" | "outline" = "primary";
    let confirmButtonClass = "";

    switch (variant) {
        case "danger":
            confirmButtonVariant = "danger";
            break;
        case "success":
            // Button component might not have explicit 'success' variant, so we use custom class
            confirmButtonVariant = "primary"; // Fallback to primary structure
            confirmButtonClass = "bg-green-600 hover:bg-green-700 text-white shadow-green-600/20";
            break;
        case "info":
        default:
            confirmButtonVariant = "primary";
            break;
    }

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val && isLoading) return; // Prevent closing while loading
            if (!val && !closeOnOutsideClick) return;
            onOpenChange(val);
        }}>
            <DialogContent className="sm:max-w-[550px] gap-6" onInteractOutside={(e) => {
                if (!closeOnOutsideClick || isLoading) {
                    e.preventDefault();
                }
            }}>
                <DialogHeader className="text-left space-y-3">
                    <DialogTitle className="text-xl font-semibold text-gray-900">
                        {title}
                    </DialogTitle>
                    <DialogDescription asChild className="text-base text-gray-600 leading-relaxed block">
                        <div>
                            {description}
                        </div>
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="outline"
                        onClick={handleCancel}
                        disabled={isLoading}
                        className="w-full sm:w-auto mt-2 sm:mt-0"
                    >
                        {cancelText}
                    </Button>
                    <Button
                        variant={confirmButtonVariant}
                        className={cn("w-full sm:w-auto", confirmButtonClass)}
                        onClick={handleConfirm}
                        disabled={isLoading}
                    >
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {confirmText}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
