"use client";
import React from "react";

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    description?: string; // alias for subtitle if needed
    actions?: React.ReactNode; // Preferred prop name
    rightSlot?: React.ReactNode; // Legacy alias to avoid breaking immediate usages, will map to actions
    errorSummary?: React.ReactNode;
    children?: React.ReactNode;
}

export function PageHeader({ title, subtitle, description, actions, rightSlot, errorSummary, children }: PageHeaderProps) {
    const finalSubtitle = subtitle || description;
    const finalActions = actions || rightSlot;
    return (
        <div className="bg-white border-b border-gray-200 pt-6 px-6 mb-6">
            <div className="flex items-start justify-between pb-4">
                <div className="space-y-1">
                    <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight">
                        {title}
                    </h1>
                    {finalSubtitle && (
                        <p className="text-sm md:text-base text-gray-500">
                            {finalSubtitle}
                        </p>
                    )}
                </div>
                {finalActions && (
                    <div className="flex items-center gap-2">
                        {finalActions}
                    </div>
                )}
            </div>
            {errorSummary && (
                <div className="mt-4">
                    {errorSummary}
                </div>
            )}
            {children && (
                <div className="mt-2">
                    {children}
                </div>
            )}
        </div>
    );
}
