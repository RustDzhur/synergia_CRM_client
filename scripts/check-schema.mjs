#!/usr/bin/env node
// Сверка схемы после накатки: все таблицы из schema.prisma должны быть в базе. Код выхода 3 — каких-то нет (список в выводе).
import { PrismaClient, Prisma } from "@prisma/client";
const prisma = new PrismaClient();
try {
  const wanted = Prisma.dmmf.datamodel.models.map((m) => m.dbName ?? m.name);
  const rows = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()`;
  const have = new Set(rows.map((r) => r.table_name));
  const missing = wanted.filter((t) => !have.has(t));
  if (missing.length) { console.error("Нет таблиц: " + missing.join(", ")); process.exitCode = 3; }
  else console.log(`Схема на месте: ${wanted.length} таблиц`);
} finally { await prisma.$disconnect(); }
