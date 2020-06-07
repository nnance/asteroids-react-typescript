import { GameState, Entity, Position, SystemEntity } from "~/engine/types";

export type Point = [number, number];

export type Drawable = {
  layer: number;
}

export type DrawableEntity = Entity & Position & Drawable;

export type Circle = DrawableEntity & {
  radius: number;
}

export type Polygon = DrawableEntity & {
  points: Point[];
  scale: number;
  angle: number;
  lineWidth?: number;
  lineColor?: string;
  fillColor?: string;
};

export type DrawableSystem = (entity: DrawableEntity, layer: CanvasRenderingContext2D) => void;

export function isCircle(entity: DrawableEntity): entity is Circle {
  return (entity as Circle).radius !== undefined;
}

export function isPolygon(entity: DrawableEntity): entity is Polygon {
  return (entity as Polygon).points !== undefined;
}

export function isDrawable(entity: SystemEntity | DrawableEntity): entity is DrawableEntity {
  return (entity as DrawableEntity).layer !== undefined;
}

const rotatePolygon = (angle: number, offsets: Point[]): Point[] => {
  return offsets.map((offset) => [
    offset[0] * Math.sin(angle) - offset[1] * Math.cos(angle),
    offset[0] * Math.cos(angle) + offset[1] * Math.sin(angle),
  ]);
};

const drawPolygon = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  angle: number,
  points: Point[],
  lineColor = "white",
  lineWidth = 1
) => {
  const offsets = rotatePolygon(angle, points);

  ctx.beginPath();
  ctx.moveTo(x + radius * offsets[0][0], y + radius * offsets[0][1]);

  ctx.strokeStyle = lineColor;
  ctx.lineWidth = lineWidth;

  // POLYGON
  offsets.forEach((offset, idx) => {
    if (idx > 0) {
      ctx.lineTo(x + radius * offset[0], y + radius * offset[1]);
    }
  });

  ctx.closePath();
  ctx.stroke();
};

export const polygonSystem = (showBounding: boolean): DrawableSystem => (entity, layer) => {
  if (isPolygon(entity)) {
    const { x, y, radius, angle, points} = entity;
    drawPolygon(layer, x, y, radius - 7, angle, points);
    if (showBounding) {
      layer.strokeStyle = "lime";
      layer.beginPath();
      layer.arc(x, y, radius, 0, Math.PI * 2, false);
      layer.stroke();
    }
  }
}

export const drawBoard = (
  ctx: CanvasRenderingContext2D,
  layers: CanvasRenderingContext2D[],
  state: GameState
) => {
  layers.forEach((layer) => {
    layer.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
  });

  state.drawers.forEach((drawer) => drawer(layers, state));
  state.renders.forEach((render) => state.entities.forEach((entity) => {
    if (isDrawable(entity)) render(entity, layers[entity.layer]);
  }));

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  layers.forEach((layer) => ctx.drawImage(layer.canvas, 0, 0));
};
