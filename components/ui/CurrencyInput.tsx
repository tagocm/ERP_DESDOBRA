/**
 * CurrencyInput Component
 * 
 * Calculator-style input for monetary values with Brazilian formatting (1.234,56)
 * - Always shows at least "0,00"
 * - Digits are entered from right to left (starting with cents)
 * - Example: type "123" → displays "1,23"
 * - Thousand separator: . (ponto)
 * - Decimal separator: , (vírgula)
 */

import { Input } from "@/components/ui/Input";
import { forwardRef, useState, useEffect } from "react";

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
    value: number;
    onChange: (value: number) => void;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
    ({ value, onChange, className, ...props }, ref) => {
        // Convert prop value to cents (integer) for initialization
        const numberToCents = (num: number): number => {
            return Math.round(num * 100);
        };

        // Initialize from prop value once
        const [cents, setCents] = useState(() => numberToCents(value || 0));
        const [isFullySelected, setIsFullySelected] = useState(false);

        // Format cents to Brazilian currency display
        const formatCents = (centsValue: number): string => {
            const reais = Math.floor(centsValue / 100);
            const centavos = centsValue % 100;

            // Format reais with thousand separator
            const reaisFormatted = reais.toLocaleString('pt-BR');

            // Format centavos with leading zero if needed
            const centavosFormatted = centavos.toString().padStart(2, '0');

            return `${reaisFormatted},${centavosFormatted}`;
        };

        // Convert cents (integer) to number (decimal)
        const centsToNumber = (centsValue: number): number => {
            return centsValue / 100;
        };

        const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
            const input = e.currentTarget;

            // Check if text is fully selected
            const isSelected = input.selectionStart === 0 &&
                input.selectionEnd === input.value.length;

            // Allow: backspace, delete, tab, escape, enter
            if ([8, 9, 27, 13, 46].includes(e.keyCode)) {
                // Backspace (8) or Delete (46)
                if (e.keyCode === 8 || e.keyCode === 46) {
                    e.preventDefault();

                    // If fully selected, reset to 0
                    if (isSelected) {
                        setCents(0);
                        onChange(0);
                        setIsFullySelected(false);
                    } else {
                        // Otherwise just remove last digit
                        const newCents = Math.floor(cents / 10);
                        setCents(newCents);
                        onChange(centsToNumber(newCents));
                    }
                }
                return;
            }

            // Ensure it's a number 0-9
            if (e.keyCode < 48 || e.keyCode > 57) {
                e.preventDefault();
                return;
            }

            e.preventDefault();
            const digit = e.key;

            let newCents: number;

            // If fully selected, replace entire value
            if (isSelected) {
                newCents = parseInt(digit);
                setIsFullySelected(false);
            } else {
                // Otherwise append digit (multiply by 10 and add new digit)
                newCents = cents * 10 + parseInt(digit);
            }

            // Limit to reasonable max (99,999,999.99 = 9999999999 cents)
            if (newCents > 9999999999) {
                return;
            }

            setCents(newCents);
            onChange(centsToNumber(newCents));
        };

        const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
            // Select all on focus for easy replacement
            e.target.select();
            setIsFullySelected(true);
        };

        const handleSelect = (e: React.SyntheticEvent<HTMLInputElement>) => {
            const input = e.currentTarget;
            const isSelected = input.selectionStart === 0 &&
                input.selectionEnd === input.value.length;
            setIsFullySelected(isSelected);
        };

        return (
            <Input
                ref={ref}
                type="text"
                inputMode="numeric"
                value={formatCents(cents)}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                onSelect={handleSelect}
                readOnly // Prevent typing outside of keyDown handler
                className={className}
                {...props}
            />
        );
    }
);

CurrencyInput.displayName = "CurrencyInput";

