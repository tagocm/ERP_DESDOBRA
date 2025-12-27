
import * as React from "react";
import { Input, InputProps } from "@/components/ui/Input";

interface DecimalInputProps extends Omit<InputProps, 'value' | 'onChange'> {
    value: number | null | undefined;
    onChange: (value: number | null) => void;
    precision?: number;
    minPrecision?: number;
    disableDecimalShift?: boolean;
}

export const DecimalInput = React.forwardRef<HTMLInputElement, DecimalInputProps>(
    ({ value, onChange, precision = 2, minPrecision, disableDecimalShift, onBlur, ...props }, ref) => {
        const [displayValue, setDisplayValue] = React.useState<string>("");

        // Formatting Helpers
        const formatNumber = (val: number | null | undefined): string => {
            if (val === null || val === undefined || isNaN(val)) return "";
            return val.toLocaleString("pt-BR", {
                minimumFractionDigits: minPrecision ?? precision,
                maximumFractionDigits: precision,
            });
        };

        const parseString = (str: string): number | null => {
            if (!str) return null;
            // Clean: remove dots (thousands), replace comma with dot
            const clean = str.replace(/\./g, "").replace(",", ".");
            const parsed = parseFloat(clean);
            return isNaN(parsed) ? null : parsed;
        };

        // Effect: Sync from Prop to State (if prop changed externally or initially)
        React.useEffect(() => {
            const currentParsed = parseString(displayValue);
            // Check formatted string equality to avoid re-renders on valid equivalent inputs
            const formattedNew = formatNumber(value);

            // If value is undefined/null, clear
            if (value === undefined || value === null) {
                if (displayValue !== "") setDisplayValue("");
                return;
            }

            // If the formatting of the new value is different from current display, update.
            // But be careful with partial inputs. This effect runs on `value` change.
            // Ideally we only update if `value` changes significantly. 
            // Simple check: if `value` implies a formatted string different from current display, update.
            // BUT: if user types "1,2", value is 1.2. Format is "1,2". Equal.
            // If user types "1,20", value 1.2. Format "1,2" (if minPrecision 0). Mismatch.
            // If we enforce formatting, "1,20" jumps to "1,2".
            // Let's assume we want to enforce standard format on external update.

            if (currentParsed !== value) {
                setDisplayValue(formatNumber(value));
            }
        }, [value, precision, minPrecision]);

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            if (props.disableDecimalShift) {
                // Allow digits and comma only
                let raw = e.target.value.replace(/[^0-9,]/g, "");

                // Prevent multiple commas
                const parts = raw.split(',');
                if (parts.length > 2) {
                    raw = parts[0] + ',' + parts.slice(1).join('');
                }

                if (!raw) {
                    setDisplayValue("");
                    onChange(0);
                    return;
                }

                // Format for Display: 1000 -> 1.000
                const intPart = parts[0].replace(/^0+(?!$)/, ''); // strip leading zeros
                const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                const decimalPart = parts.length > 1 ? ',' + parts[1].slice(0, precision) : ''; // limit decimal chars?

                setDisplayValue(formattedInt + decimalPart);

                // Parse for Value
                const parseRaw = raw.replace(',', '.');
                onChange(parseFloat(parseRaw));
                return;
            }

            const raw = e.target.value.replace(/\D/g, ""); // Keep only digits
            if (!raw) {
                setDisplayValue("");
                // User requirement: "deixe 0 como padrão".
                // If I clear, should it be 0?
                onChange(0);
                return;
            }

            const val = parseInt(raw, 10) / Math.pow(10, precision);
            setDisplayValue(val.toLocaleString("pt-BR", {
                minimumFractionDigits: precision,
                maximumFractionDigits: precision,
            }));
            onChange(val);
        };

        const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
            e.target.select();
            if (props.onFocus) props.onFocus(e);
        };

        const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
            // On blur, force formatting to "standard" pt-BR
            const parsed = parseString(displayValue);
            const formatted = formatNumber(parsed);

            if (displayValue !== formatted) {
                setDisplayValue(formatted);
            }
            if (onBlur) onBlur(e);
        };

        return (
            <Input
                {...props}
                ref={ref}
                type="text"
                inputMode="decimal"
                value={displayValue}
                onChange={handleChange}
                onFocus={handleFocus}
                onClick={(e) => e.currentTarget.select()}
                onBlur={handleBlur}
            />
        );
    }
);
DecimalInput.displayName = "DecimalInput";
