export type Position = { x: number; y: number };
export type Velocity = { xVelocity: number; yVelocity: number };

export type GameState = {
  score: number;
  level: number;
  lives: number;
  drawers: Drawer[];
  renders: DrawableSystem[];
  systems: System[];
  entities: SystemEntity[];
};

export type Entity = { radius: number };

export type GameEntity = Entity & Position & Velocity;
export type SystemEntity = Entity | Position | Velocity;

export type Point = [number, number];

export type Drawable = {
  layer: number;
};

export type DrawableEntity = Entity & Position & Velocity & Drawable;

export type Circle = DrawableEntity & {
  radius: number;
};

export type Polygon = DrawableEntity & {
  points: Point[];
  scale: number;
  angle: number;
  lineWidth?: number;
  lineColor?: string;
  fillColor?: string;
};

export type Drawer = (
  layers: CanvasRenderingContext2D[],
  state: GameState
) => void;

export type DrawableSystem = (
  entity: DrawableEntity,
  layer: CanvasRenderingContext2D
) => void;

export type System = (entity: Entity) => Entity;

export function isCircle(entity: DrawableEntity): entity is Circle {
  return (entity as Circle).radius !== undefined;
}

export function isPolygon(entity: DrawableEntity): entity is Polygon {
  return (entity as Polygon).points !== undefined;
}

export function isDrawable(
  entity: SystemEntity | DrawableEntity
): entity is DrawableEntity {
  return (entity as DrawableEntity).layer !== undefined;
}

export function hasPosition(entity: SystemEntity): entity is Position {
  return (entity as Position).x !== undefined;
}

export function hasVelocity(entity: SystemEntity): entity is Velocity {
  return (entity as Velocity).xVelocity !== undefined;
}
