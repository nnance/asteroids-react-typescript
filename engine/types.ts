import { DrawableSystem } from "./rendering";

export type Position = { x: number; y: number };

export type Drawer = (
  layers: CanvasRenderingContext2D[],
  state: GameState
) => void;

export type GameState = {
  score: number;
  level: number;
  lives: number;
  drawers: Drawer[];
  renders: DrawableSystem[];
  entities: SystemEntity[];
};

export type Entity = {
  radius: number;
  xVelocity: number;
  yVelocity: number;
  layer: number;
};

export type GameEntity = Entity & Position;
export type SystemEntity = Entity | Position;

export function hasPosition(entity: SystemEntity): entity is Position {
  return (entity as Position).x !== undefined;
}
