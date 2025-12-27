
import * as React from "react";
import { Input, InputProps } from "@/components/ui/Input";

interface DecimalInputProps extends Omit<InputProps, 'value' | 'onChange'> {
    value: number | null | undefined;
    onChange: (value: number | null) => void;
    precision?: number;
}

export const DecimalInput = React.forwardRef<HTMLInputElement, DecimalInputProps>(
    ({ value, onChange, precision = 2, minPrecision, onBlur, ...props }, ref) => {
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
            const raw = e.target.value;

            // Allow typing numbers, comma, dots (though dots are stripped in parse)
            // But we want to block invalid chars
            if (!/^[0-9.,]*$/.test(raw)) return;

            // If empty
            if (!raw) {
                setDisplayValue("");
                onChange(null);
                return;
            }

            // Just update display to allow typing
            setDisplayValue(raw);

            // Parse and propagate
            const parsed = parseString(raw);
            if (parsed !== null && !isNaN(parsed)) {
                onChange(parsed);
            } else {
                // if parsing fails (e.g. "1,,"), maybe don't call onChange or call with null?
                // Current logic: keep display, maybe nullify value?
                // Let's keep value if it was valid before? No, Input needs to be controlled.
                // If invalid number, maybe don't fire onChange?
            }
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
