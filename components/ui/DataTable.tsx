
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface Column<T> {
    header: string;
    accessorKey?: keyof T;
    cell?: (item: T) => React.ReactNode;
    className?: string;
}

interface DataTableProps<T> {
    data: T[];
    columns: Column<T>[];
    onRowClick?: (item: T) => void;
    isLoading?: boolean;
    emptyMessage?: string;
}

export function DataTable<T>({
    data,
    columns,
    onRowClick,
    isLoading,
    emptyMessage = "Nenhum registro encontrado.",
}: DataTableProps<T>) {
    if (isLoading) {
        return <div className="p-8 text-center text-gray-500">Carregando...</div>;
    }

    if (!data.length) {
        return (
            <div className="p-8 text-center border rounded-lg bg-gray-50 border-gray-200">
                <p className="text-gray-500">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto border rounded-lg border-gray-200 shadow-sm">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 font-medium">
                    <tr>
                        {columns.map((col, idx) => (
                            <th key={idx} className={cn("px-4 py-3", col.className)}>
                                {col.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                    {data.map((item, rowIdx) => (
                        <tr
                            key={rowIdx}
                            onClick={() => onRowClick && onRowClick(item)}
                            className={cn(
                                "group transition-colors",
                                onRowClick ? "cursor-pointer hover:bg-brand-50/50" : ""
                            )}
                        >
                            {columns.map((col, colIdx) => (
                                <td key={colIdx} className={cn("px-4 py-3", col.className)}>
                                    {col.cell
                                        ? col.cell(item)
                                        : (col.accessorKey ? String(item[col.accessorKey]) : "")}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
