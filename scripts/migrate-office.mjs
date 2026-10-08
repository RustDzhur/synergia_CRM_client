#!/usr/bin/env node
// Перенос роботов и поручений Робот-офиса из SectionRecord (office:robot / office:task) в таблицы robots / robot_tasks, а сигналов агентов
// платформы (agents:status) — в platform_agents. Идемпотентно: уже перенесённое пропускается; старые записи не удаляются (откат — вернуть
// предыдущий код). Печатает отчёт «до/после»; код выхода 2, если после переноса в новых таблицах меньше записей, чем в старых.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
try {
  const oldRobots = await prisma.sectionRecord.findMany({ where: { key: "office:robot" } });
  const oldTasks = await prisma.sectionRecord.findMany({ where: { key: "office:task" } });
  const oldAgents = await prisma.sectionRecord.findMany({ where: { org: "platform", key: "agents:status" } });
  const before = { robots: await prisma.robot.count(), tasks: await prisma.robotTask.count(), agents: await prisma.platformAgent.count() };
  await prisma.robot.createMany({ skipDuplicates: true, data: oldRobots.map((r) => ({ org: r.org, rid: r.rid, data: r.values ?? {}, enabled: r.values?.enabled !== false, createdAt: r.createdAt })) });
  for (let i = 0; i < oldTasks.length; i += 500) {
    await prisma.robotTask.createMany({ skipDuplicates: true, data: oldTasks.slice(i, i + 500).map((r) => ({ org: r.org, rid: r.rid, robot: String(r.values?.robot ?? ""), status: String(r.values?.status ?? "failed"), data: r.values ?? {}, createdAt: r.createdAt })) });
  }
  for (const r of oldAgents) {
    const v = r.values ?? {};
    const d = { lastActivity: v.lastActivity ? new Date(v.lastActivity) : null, seenAt: v.seenAt ? new Date(v.seenAt) : null, note: String(v.note ?? "") };
    await prisma.platformAgent.upsert({ where: { name: r.rid }, create: { name: r.rid, ...d }, update: {} });
  }
  const after = { robots: await prisma.robot.count(), tasks: await prisma.robotTask.count(), agents: await prisma.platformAgent.count() };
  console.log(JSON.stringify({ old: { robots: oldRobots.length, tasks: oldTasks.length, agents: oldAgents.length }, before, after }));
  if (after.robots < oldRobots.length || after.tasks < oldTasks.length || after.agents < oldAgents.length) { console.error("Перенос неполный"); process.exitCode = 2; }
} finally { await prisma.$disconnect(); }
