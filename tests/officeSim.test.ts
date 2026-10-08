import { describe, expect, it } from "vitest";
import { OfficeSim } from "@/components/crm/RobotOffice/scene/sim";

describe("симуляция офиса", () => {
    it("робот, который стоит на своём месте, не превращается в NaN даже при отрицательном шаге времени", () => {
        const sim = new OfficeSim();
        const inputs = [0, 1, 2].map((i) => ({ id: `p${i}`, zone: "platform" as const, index: i, mode: "desk" as const, working: false }));
        let now = Date.now();
        for (const dt of [-0.05, -0.01, 0, 0.016, 0.1]) {
            now += 16;
            const out = sim.update(dt, now, inputs);
            out.forEach((v) => { expect(Number.isFinite(v.x)).toBe(true); expect(Number.isFinite(v.y)).toBe(true); });
        }
    });
});
