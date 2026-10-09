import { describe, expect, it } from "vitest";
import { hasDb, makeOrg } from "./helpers/db";
import { addRoom, createRobot, listRobots, listRooms, removeRoom, renameRoom, updateRobot, MAX_ROOMS } from "@/lib/office/store";

describe.skipIf(!hasDb)("свои комнаты офиса", () => {
    it("добавить, переименовать, поселить робота, удалить: робот переезжает в «Офис»", async () => {
        const o = await makeOrg();
        const room = await addRoom(o.org, "  Реклама ");
        expect(room.name).toBe("Реклама");
        await expect(addRoom(o.org, "реклама")).rejects.toThrow(/exists/);
        await expect(addRoom(o.org, "x")).rejects.toThrow(/short/);
        const robot = await createRobot(o.org, { name: "Vik", title: "Ads", skills: ["tasks"], zone: room.id });
        expect(robot.zone).toBe(room.id);
        expect((await renameRoom(o.org, room.id, "Ads Team")).name).toBe("Ads Team");
        // чужая/несуществующая комната не принимается
        const other = await createRobot(o.org, { name: "Bob", title: "x", skills: ["tasks"], zone: "room_zzzzzz" });
        expect(other.zone).not.toBe("room_zzzzzz");
        await expect(updateRobot(o.org, other.id, { zone: "room_zzzzzz" })).rejects.toThrow(/zone/i);
        await removeRoom(o.org, room.id);
        expect((await listRooms(o.org))).toHaveLength(0);
        expect((await listRobots(o.org)).find((r) => r.id === robot.id)?.zone).toBe("office");
    });
    it("предел числа комнат", async () => {
        const o = await makeOrg();
        for (let i = 0; i < MAX_ROOMS; i++) await addRoom(o.org, `Room ${i}`);
        await expect(addRoom(o.org, "One more")).rejects.toThrow(/At most/);
    });
});
