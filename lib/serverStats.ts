import fs from "node:fs/promises";
import os from "node:os";
import { prisma } from "@/lib/prisma";

// Состояние сервера для админ-кабинета. Приложение работает в Docker-контейнере, но /proc/meminfo, /proc/stat и /proc/uptime
// в нём показывают сам сервер, а статистика диска корня и тома файлов — диск сервера, поэтому доступ к хосту и docker.sock не нужен.
export interface ServerStats {
    at: number;
    cpu: { cores: number; model: string; percent: number; load: [number, number, number] };
    memory: { totalMb: number; usedMb: number; availableMb: number; percent: number; swapTotalMb: number; swapUsedMb: number };
    disk: { totalGb: number; usedGb: number; freeGb: number; percent: number };
    storage: { usedMb: number } | null;
    database: { sizeMb: number } | null;
    uptimeDays: number;
    app: { rssMb: number; node: string };
}

const mb = (bytes: number) => Math.round(bytes / 1048576);
const gb = (bytes: number) => Math.round((bytes / 1073741824) * 10) / 10;

// Суммарные «тики» процессора: [занято, всего] — загрузка считается как разница между двумя замерами
async function cpuTicks(): Promise<[number, number]> {
    const line = (await fs.readFile("/proc/stat", "utf8")).split("\n")[0].trim().split(/\s+/).slice(1).map(Number);
    const idle = (line[3] ?? 0) + (line[4] ?? 0); // idle + iowait
    const total = line.reduce((a, b) => a + b, 0);
    return [total - idle, total];
}

let lastTicks: { at: number; busy: number; total: number } | null = null;

async function cpuPercent(): Promise<number> {
    try {
        let prev = lastTicks;
        if (!prev || Date.now() - prev.at > 60_000) {
            const [busy, total] = await cpuTicks();
            prev = { at: Date.now(), busy, total };
            await new Promise((r) => setTimeout(r, 400));
        }
        const [busy, total] = await cpuTicks();
        lastTicks = { at: Date.now(), busy, total };
        const dt = total - prev.total;
        return dt > 0 ? Math.min(100, Math.max(0, Math.round(((busy - prev.busy) / dt) * 100))) : 0;
    } catch {
        return 0;
    }
}

async function meminfo() {
    const out: Record<string, number> = {};
    try {
        for (const l of (await fs.readFile("/proc/meminfo", "utf8")).split("\n")) {
            const m = l.match(/^(\w+):\s+(\d+)/);
            if (m) out[m[1]] = Number(m[2]) * 1024;
        }
    } catch { /* не Linux — берём данные Node */ }
    const total = out.MemTotal ?? os.totalmem();
    const available = out.MemAvailable ?? os.freemem();
    return { total, available, swapTotal: out.SwapTotal ?? 0, swapFree: out.SwapFree ?? 0 };
}

async function dirSize(dir: string, depth = 0): Promise<number> {
    let sum = 0;
    try {
        for (const e of await fs.readdir(dir, { withFileTypes: true })) {
            const p = `${dir}/${e.name}`;
            if (e.isDirectory()) { if (depth < 8) sum += await dirSize(p, depth + 1); }
            else if (e.isFile()) sum += (await fs.stat(p)).size;
        }
    } catch { /* нет доступа или каталога — считаем нулём */ }
    return sum;
}

export async function serverStats(): Promise<ServerStats> {
    const [cpu, mem] = await Promise.all([cpuPercent(), meminfo()]);
    const st = await fs.statfs("/");
    const diskTotal = st.blocks * st.bsize;
    const diskFree = st.bavail * st.bsize;
    const root = (process.env.LOCAL_STORAGE_ROOT ?? "").trim();
    const [storageBytes, dbRows] = await Promise.all([
        root ? dirSize(root) : Promise.resolve(null),
        prisma.$queryRaw<{ size: bigint }[]>`select pg_database_size(current_database()) as size`.catch(() => null),
    ]);
    const used = mem.total - mem.available;
    const cpus = os.cpus();
    const load = os.loadavg().map((n) => Math.round(n * 100) / 100) as [number, number, number];
    let uptime = os.uptime();
    try { uptime = Number((await fs.readFile("/proc/uptime", "utf8")).split(" ")[0]); } catch { /* os.uptime */ }
    return {
        at: Date.now(),
        cpu: { cores: cpus.length, model: cpus[0]?.model ?? "", percent: cpu, load },
        memory: {
            totalMb: mb(mem.total), usedMb: mb(used), availableMb: mb(mem.available), percent: Math.round((used / mem.total) * 100),
            swapTotalMb: mb(mem.swapTotal), swapUsedMb: mb(mem.swapTotal - mem.swapFree),
        },
        disk: { totalGb: gb(diskTotal), usedGb: gb(diskTotal - diskFree), freeGb: gb(diskFree), percent: Math.round(((diskTotal - diskFree) / diskTotal) * 100) },
        storage: storageBytes === null ? null : { usedMb: mb(storageBytes) },
        database: dbRows?.[0] ? { sizeMb: mb(Number(dbRows[0].size)) } : null,
        uptimeDays: Math.round((uptime / 86400) * 10) / 10,
        app: { rssMb: mb(process.memoryUsage().rss), node: process.version },
    };
}
