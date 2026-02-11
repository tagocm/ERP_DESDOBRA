"use client";

import { Button } from "@/components/ui/Button";

interface ListPaginationProps {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    label?: string;
    disabled?: boolean;
    className?: string;
}

export function ListPagination({
    page,
    pageSize,
    total,
    onPageChange,
    label = "registros",
    disabled = false,
    className = "",
}: ListPaginationProps) {
    if (total <= 0) return null;

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const startItem = (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, total);
    const pageWindowStart = Math.max(1, currentPage - 2);
    const pageWindowEnd = Math.min(totalPages, pageWindowStart + 4);

    return (
        <div className={`mt-4 flex items-center justify-between text-sm text-gray-600 ${className}`}>
            <p>
                Mostrando {startItem}–{endItem} de {total} {label}
            </p>
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    disabled={disabled || currentPage <= 1}
                    onClick={() => onPageChange(currentPage - 1)}
                >
                    Anterior
                </Button>
                <div className="flex items-center gap-1">
                    {Array.from({ length: Math.max(0, pageWindowEnd - pageWindowStart + 1) }).map((_, index) => {
                        const pageNumber = pageWindowStart + index;
                        const isActive = pageNumber === currentPage;
                        return (
                            <Button
                                key={pageNumber}
                                variant={isActive ? "primary" : "outline"}
                                size="sm"
                                disabled={disabled}
                                onClick={() => onPageChange(pageNumber)}
                                className="min-w-9"
                            >
                                {pageNumber}
                            </Button>
                        );
                    })}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={disabled || currentPage >= totalPages}
                    onClick={() => onPageChange(currentPage + 1)}
                >
                    Próxima
                </Button>
            </div>
        </div>
    );
}
