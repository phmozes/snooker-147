// Shared plain types for the pure core (physics, rules, solver). No rendering code here.

export interface Vec2 {
  x: number;
  y: number;
}

export type Colour = 'yellow' | 'green' | 'brown' | 'blue' | 'pink' | 'black';
export type BallKind = 'cue' | 'red' | Colour;

export const COLOURS: readonly Colour[] = ['yellow', 'green', 'brown', 'blue', 'pink', 'black'];

export interface Ball {
  id: string; // 'cue', 'red1'..'red15', or the colour name
  kind: BallKind;
  pos: Vec2;
}

export const vec = (x: number, y: number): Vec2 => ({ x, y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });
export const length = (a: Vec2): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
export const normalize = (a: Vec2): Vec2 => scale(a, 1 / length(a));
