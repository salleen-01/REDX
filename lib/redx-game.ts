/**
 * REDX game rules live in this file so difficulty can be tuned without
 * touching the screen component. `campaign` is the finite End Game path;
 * `infinite` generates a level dynamically as the player keeps winning.
 */
export type GameMode = "campaign" | "infinite";

export type LevelConfig = {
  level: number;
  balls: number;
  ballSize: number;
  redCount: number;
  shuffles: number;
  speed: number;
  duration: number;
  world: string;
  worldLabel: string;
  challenge: "standard" | "decoy" | "freeze" | "shrinking";
  decoys: number;
};

/**
 * `balls` controls density, while `ballSize` controls readability. Focus
 * Track intentionally increases balls and decreases ballSize together.
 */

export type StormConfig = {
  level: number;
  balls: number;
  ballSize: number;
  speed: number;
  duration: number;
  label: string;
};

export const STORM_LEVEL_COUNT = 20;
export const END_GAME_LEVEL_COUNT = 20;

export const CAMPAIGN_LEVELS: LevelConfig[] = [
  { level: 1, balls: 6, ballSize: 38, redCount: 1, shuffles: 3, speed: 0.7, duration: 3, world: "01", worldLabel: "TRAINING", challenge: "standard", decoys: 0 },
  { level: 2, balls: 8, ballSize: 37, redCount: 1, shuffles: 4, speed: 0.9, duration: 3.4, world: "01", worldLabel: "TRAINING", challenge: "standard", decoys: 0 },
  { level: 3, balls: 10, ballSize: 36, redCount: 1, shuffles: 5, speed: 1.05, duration: 3.8, world: "01", worldLabel: "TRAINING", challenge: "standard", decoys: 0 },
  { level: 4, balls: 12, ballSize: 35, redCount: 1, shuffles: 6, speed: 1.2, duration: 4.2, world: "01", worldLabel: "TRAINING", challenge: "standard", decoys: 0 },
  { level: 5, balls: 15, ballSize: 34, redCount: 1, shuffles: 7, speed: 1.35, duration: 4.7, world: "02", worldLabel: "SPEED", challenge: "standard", decoys: 0 },
  { level: 6, balls: 16, ballSize: 33, redCount: 1, shuffles: 8, speed: 1.55, duration: 4.4, world: "02", worldLabel: "SPEED", challenge: "standard", decoys: 0 },
  { level: 7, balls: 18, ballSize: 32, redCount: 1, shuffles: 9, speed: 1.75, duration: 4.1, world: "03", worldLabel: "CHAOS", challenge: "standard", decoys: 0 },
  { level: 8, balls: 20, ballSize: 31, redCount: 1, shuffles: 10, speed: 1.95, duration: 3.8, world: "03", worldLabel: "CHAOS", challenge: "standard", decoys: 0 },
  { level: 9, balls: 20, ballSize: 30, redCount: 2, shuffles: 11, speed: 2.1, duration: 3.6, world: "04", worldLabel: "END GAME", challenge: "standard", decoys: 0 },
  { level: 10, balls: 22, ballSize: 29, redCount: 2, shuffles: 12, speed: 2.3, duration: 3.3, world: "04", worldLabel: "END GAME", challenge: "standard", decoys: 0 },
];

export function getLevelConfig(mode: GameMode, level: number): LevelConfig {
  if (mode === "campaign") {
    return CAMPAIGN_LEVELS[Math.min(Math.max(level, 1) - 1, CAMPAIGN_LEVELS.length - 1)];
  }

  const current = Math.max(level, 1);
  const challenge = current >= 12 ? "shrinking" : current >= 8 ? "freeze" : current >= 5 ? "decoy" : "standard";
  return {
    level: current,
    balls: Math.min(10 + (current - 1) * 2, 30),
    ballSize: Math.max(22, 38 - (current - 1) * 0.85),
    redCount: current >= 15 ? 2 : 1,
    shuffles: Math.min(5 + (current - 1) * 2, 22),
    speed: Math.min(1 + (current - 1) * 0.13, 2.5),
    duration: Math.min(4.2 + (current - 1) * 0.16, 7),
    world: "∞",
    worldLabel: challenge === "decoy" ? "DECOY FLASH" : challenge === "freeze" ? "FREEZE RECALL" : challenge === "shrinking" ? "SHRINKING ARENA" : "INFINITE",
    challenge,
    decoys: challenge === "decoy" ? Math.min(1 + Math.floor((current - 5) / 3), 3) : 0,
  };
}

export function getStormConfig(level: number): StormConfig {
  const current = Math.min(Math.max(level, 1), STORM_LEVEL_COUNT);
  return {
    level: current,
    balls: Math.min(10 + (current - 1) * 2, 24),
    ballSize: Math.max(18, 30 - (current - 1) * 0.8),
    speed: Math.min(145 + (current - 1) * 15, 350),
    duration: Math.min(22, 17 + (current - 1) * 0.3),
    label: current >= 6 ? "RED STORM / WALL RUN" : "RED STORM / COLLISION",
  };
}

export function getEndGameConfig(level: number): LevelConfig {
  const current = Math.min(Math.max(level, 1), END_GAME_LEVEL_COUNT);
  return {
    level: current,
    balls: Math.min(10 + (current - 1) * 2, 28),
    ballSize: Math.max(22, 38 - (current - 1) * 0.85),
    redCount: current >= 11 ? 3 : 2,
    shuffles: Math.min(6 + (current - 1) * 2, 24),
    speed: Math.min(1.2 + (current - 1) * 0.14, 2.6),
    duration: Math.min(4.2 + (current - 1) * 0.14, 6),
    world: "04",
    worldLabel: current >= 11 ? "END GAME / TRIPLE RED" : "END GAME",
    challenge: "standard",
    decoys: 0,
  };
}

export function createOrder(count: number) {
  return Array.from({ length: Math.max(0, count) }, (_, index) => index);
}

export function createEndGameOrder(count: number, redCount: number, level: number) {
  const order = createOrder(count);
  if (level <= 3 || redCount < 2) return order;
  const targets = Array.from({ length: redCount }, (_, index) => index);
  const first = (level * 3) % count;
  const second = (first + Math.floor(count * 0.35) + (level % 4)) % count;
  const slots = redCount === 2 ? [first, second] : [first, second, (second + Math.floor(count * 0.27) + 1) % count];
  const result = [...order];
  targets.forEach((target, index) => {
    const slot = slots[index];
    const existing = result.indexOf(target);
    [result[slot], result[existing]] = [result[existing], result[slot]];
  });
  return result;
}

export function moveOrder(order: number[], step: number) {
  if (order.length < 2) return [...order];
  const shift = (Math.max(0, step) % order.length) + 1;
  return order.map((_, index) => order[(index + shift) % order.length]);
}

export function chaosOrder(order: number[], step: number) {
  const next = moveOrder(order, step);
  if (next.length < 4) return next;
  const first = (step * 3) % next.length;
  const second = (first + Math.floor(next.length / 2) + (step % 3)) % next.length;
  [next[first], next[second]] = [next[second], next[first]];
  return next;
}

export function formatLevel(level: number) {
  return String(Math.max(0, level)).padStart(2, "0");
}
