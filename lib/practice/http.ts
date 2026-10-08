import { NextResponse } from "next/server";
import { failure } from "@/lib/api";
import { PracticeError } from "./service";

/** Ответ на ошибку маршрутов практики: понятное сообщение и статус, остальное — как везде. */
export function practiceFailure(e: unknown) {
    if (e instanceof PracticeError) return NextResponse.json({ message: e.message }, { status: e.status });
    return failure(e);
}
