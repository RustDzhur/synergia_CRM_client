import type { DocSection } from "./types";
import { FINANCE_A } from "./financeA";
import { FINANCE_B } from "./financeB";
import { FINANCE_C } from "./financeC";
import { FINANCE_D } from "./financeD";

// Финансы целиком: четыре файла по смыслу, чтобы каждый оставался обозримым.
export const FINANCE: DocSection[] = [...FINANCE_A, ...FINANCE_B, ...FINANCE_C, ...FINANCE_D];
