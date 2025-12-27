"use client";

interface FieldErrorProps {
    error?: string | null;
}

export function FieldError({ error }: FieldErrorProps) {
    if (!error) return null;
    return (
        <p className="text-xs text-red-500 mt-1 font-medium animate-in slide-in-from-left-1">
            {error}
        </p>
    );
}
