import { NextResponse } from "next/server";

type ErrorPayload = {
    message: string;
    code?: string;
    details?: unknown;
};

export function errorResponse(
    message: string,
    status = 400,
    code?: string,
    details?: unknown
) {
    const payload: { error: ErrorPayload } = {
        error: { message }
    };
    if (code) payload.error.code = code;
    if (details !== undefined) payload.error.details = details;
    return NextResponse.json(payload, { status });
}

export function okResponse(data?: unknown, status = 200) {
    return NextResponse.json({ data }, { status });
}

export function successResponse(payload: Record<string, unknown>, status = 200) {
    return NextResponse.json(payload, { status });
}
