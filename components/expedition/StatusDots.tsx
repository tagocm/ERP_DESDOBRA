'use client';

import { cn } from '@/lib/utils';
import type { OrderStatusIndicator } from '@/lib/route-status-helpers';

interface StatusDot {
    color: OrderStatusIndicator;
    key: string;
}

interface StatusDotsProps {
    dots: StatusDot[];
    maxVisible?: number;
    size?: 'sm' | 'md';
}

export function StatusDots({ dots, maxVisible = 5, size = 'sm' }: StatusDotsProps) {
    const visibleDots = dots.slice(0, maxVisible);
    const remainingCount = Math.max(0, dots.length - maxVisible);

    const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';

    return (
        <div className="flex items-center gap-0.5">
            {visibleDots.map((dot) => (
                <div
                    key={dot.key}
                    className={cn(
                        'rounded-full',
                        dotSize,
                        dot.color === 'green' && 'bg-green-500',
                        dot.color === 'yellow' && 'bg-amber-400',
                        dot.color === 'red' && 'bg-red-500',
                        dot.color === 'neutral' && 'bg-gray-300'
                    )}
                />
            ))}
            {remainingCount > 0 && (
                <span className="text-[8px] text-gray-400 ml-0.5 font-medium">
                    +{remainingCount}
                </span>
            )}
        </div>
    );
}
