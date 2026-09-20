import { describe, expect, it } from "vitest";

import { chaosOrder, createEndGameOrder, createOrder, formatLevel, getEndGameConfig, getLevelConfig, getStormConfig, moveOrder, STORM_LEVEL_COUNT } from "../lib/redx-game";

describe("REDX level rules", () => {
  it("starts Training and escalates Focus Track into Chaos and End Game", () => {
    expect(getLevelConfig("campaign", 1)).toMatchObject({ balls: 6, redCount: 1, worldLabel: "TRAINING" });
    expect(getLevelConfig("campaign", 7)).toMatchObject({ balls: 18, speed: 1.75, worldLabel: "CHAOS" });
    expect(getLevelConfig("campaign", 9)).toMatchObject({ redCount: 2, worldLabel: "END GAME" });
  });

  it("increases Infinite mode pressure and caps the arena at thirty balls", () => {
    expect(getLevelConfig("infinite", 1)).toMatchObject({ balls: 10, ballSize: 38, redCount: 1, shuffles: 5, worldLabel: "INFINITE" });
    expect(getLevelConfig("infinite", 37)).toMatchObject({ balls: 30, shuffles: 22, level: 37 });
    expect(getLevelConfig("infinite", 10).balls).toBeGreaterThan(getLevelConfig("infinite", 1).balls);
    expect(getLevelConfig("infinite", 10).ballSize).toBeLessThan(getLevelConfig("infinite", 1).ballSize);
  });

  it("keeps End Game independent and starts with two red targets", () => {
    expect(getEndGameConfig(1)).toMatchObject({ level: 1, redCount: 2, balls: 10, ballSize: 38, worldLabel: "END GAME" });
    expect(getEndGameConfig(10).balls).toBeGreaterThan(getEndGameConfig(1).balls);
    expect(getEndGameConfig(10).ballSize).toBeLessThan(getEndGameConfig(1).ballSize);
    expect(getEndGameConfig(4).redCount).toBe(2);
    expect(getEndGameConfig(11)).toMatchObject({ redCount: 3, worldLabel: "END GAME / TRIPLE RED" });
    expect(getEndGameConfig(99).level).toBe(20);
    expect(createEndGameOrder(10, 2, 1).slice(0, 2)).toEqual([0, 1]);
    expect(createEndGameOrder(10, 2, 4)[5]).toBe(1);
  });

  it("keeps Red Storm independent and makes later levels smaller, faster, and shorter", () => {
    const first = getStormConfig(1);
    const later = getStormConfig(5);
    expect(first).toMatchObject({ balls: 10, ballSize: 30, speed: 145, duration: 17 });
    expect(later.ballSize).toBeLessThan(first.ballSize);
    expect(later.speed).toBeGreaterThan(first.speed);
    expect(later.duration).toBeGreaterThan(first.duration);
    expect(later.label).toContain("COLLISION");
    expect(getStormConfig(6).label).toContain("WALL RUN");
    expect(getStormConfig(99).level).toBe(STORM_LEVEL_COUNT);
  });

  it("preserves ball ids while moving every slot", () => {
    const order = createOrder(6);
    expect(order).toEqual([0, 1, 2, 3, 4, 5]);
    expect(moveOrder(order, 0)).toEqual([1, 2, 3, 4, 5, 0]);
    expect(moveOrder(order, 5)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("adds repeatable cross-swaps for Red Storm without losing any ball", () => {
    const order = createOrder(12);
    const next = chaosOrder(order, 4);
    expect(next).toHaveLength(12);
    expect([...next].sort((a, b) => a - b)).toEqual(order);
    expect(next).not.toEqual(moveOrder(order, 4));
  });

  it("formats level labels for the HUD", () => {
    expect(formatLevel(1)).toBe("01");
    expect(formatLevel(27)).toBe("27");
  });
});
