
import * as React from "react";
import { Input, InputProps } from "@/components/ui/Input";

interface DecimalInputProps extends Omit<InputProps, 'value' | 'onChange'> {
    value: number | null | undefined;
    onChange: (value: number | null) => void;
    precision?: number;
}

export const DecimalInput = React.forwardRef<HTMLInputElement, DecimalInputProps>(
    ({ value, onChange, precision = 2, onBlur, ...props }, ref) => {
        const [displayValue, setDisplayValue] = React.useState<string>("");

        // Formatting Helpers
        const formatNumber = (val: number | null | undefined): string => {
            if (val === null || val === undefined || isNaN(val)) return "";
            return val.toLocaleString("pt-BR", {
                minimumFractionDigits: precision,
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
            // Only update display if the prop value is semantically different from current display
            // This prevents re-formatting while typing valid variations (e.g. "1," vs 1)
            // But we must handle precision. If prop is 1.23 and display is "1,2", parsed is 1.2. Mismatch? No.
            // Actually, parsed("1,") is 1. Prop 1. Equal.
            // Use epsilon or exacting match?
            // "1," -> 1. Prop 1. Ok.
            // "1,2" -> 1.2. Prop 1.2. Ok.
            // "1,23" -> 1.23. Prop 1.23. Ok.
            // "1000" -> 1000. Prop 1000. Ok.
            // "1.000" -> 1000. Prop 1000. Ok.

            // What if external update?
            if (value !== currentParsed && value !== undefined) {
                setDisplayValue(formatNumber(value));
            } else if (value === undefined || value === null) {
                if (displayValue !== "") setDisplayValue("");
            }
        }, [value, precision]); // Intentionally omitting displayValue to avoid loop, but depend on value

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const raw = e.target.value.replace(/\D/g, ""); // Keep only digits
            if (!raw) {
                setDisplayValue("");
                onChange(null);
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
