import { describe, expect, it } from "vitest";
import { formatDateTimeInBrasilia } from "../services/brasilia-time";

describe("formatDateTimeInBrasilia", () => {
    it("formata data UTC no horário de Brasília", () => {
        const input = new Date("2026-02-28T22:49:12.000Z");
        expect(formatDateTimeInBrasilia(input)).toBe("2026-02-28T19:49:12-03:00");
    });

    it("ajusta corretamente virada de dia no fuso de Brasília", () => {
        const input = new Date("2026-02-28T00:05:09.000Z");
        expect(formatDateTimeInBrasilia(input)).toBe("2026-02-27T21:05:09-03:00");
    });
});

