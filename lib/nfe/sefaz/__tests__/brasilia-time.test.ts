import { describe, expect, it } from "vitest";
import { formatDateTimeInBrasilia, formatYearMonthInBrasilia } from "../services/brasilia-time";

describe("formatDateTimeInBrasilia", () => {
    it("formata data UTC no horário de Brasília", () => {
        const input = new Date("2026-02-28T22:49:12.000Z");
        expect(formatDateTimeInBrasilia(input)).toBe("2026-02-28T19:49:12-03:00");
    });

    it("ajusta corretamente virada de dia no fuso de Brasília", () => {
        const input = new Date("2026-02-28T00:05:09.000Z");
        expect(formatDateTimeInBrasilia(input)).toBe("2026-02-27T21:05:09-03:00");
    });

    it("gera AAMM no fuso de Brasília para chave de acesso", () => {
        const input = new Date("2026-03-01T00:02:00.000Z");
        expect(formatYearMonthInBrasilia(input)).toBe("2602");
    });
});
