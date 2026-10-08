import { NextResponse } from "next/server";
import { failure } from "@/lib/api";
import { LegalError } from "./service";

export function legalFailure(e: unknown) {
    if (e instanceof LegalError) return NextResponse.json({ message: e.message }, { status: e.status });
    return failure(e);
}
