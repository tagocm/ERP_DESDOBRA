"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

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
        return <div className="p-12 text-center text-gray-500">Carregando...</div>;
    }

    if (!data.length) {
        return (
            <div className="p-12 text-center border border-gray-200 rounded-2xl bg-white">
                <p className="text-gray-500 font-medium">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden border border-gray-200 rounded-2xl bg-white">
            <Table>
                <TableHeader className="bg-white">
                    <TableRow className="hover:bg-transparent border-gray-200">
                        {columns.map((col, idx) => (
                            <TableHead
                                key={idx}
                                className={cn(
                                    "px-6 h-11 text-xs font-bold text-gray-500 uppercase tracking-wider",
                                    col.className
                                )}
                            >
                                {col.header}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((item, rowIdx) => (
                        <TableRow
                            key={rowIdx}
                            onClick={() => onRowClick && onRowClick(item)}
                            className={cn(
                                "group border-gray-100 hover:bg-gray-50 transition-colors",
                                onRowClick ? "cursor-pointer" : ""
                            )}
                        >
                            {columns.map((col, colIdx) => (
                                <TableCell
                                    key={colIdx}
                                    className={cn("px-6 py-4", col.className)}
                                >
                                    {col.cell
                                        ? col.cell(item)
                                        : (col.accessorKey ? String(item[col.accessorKey]) : "")}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
