import {
  GameState,
  Point,
  DrawableSystem,
  isPolygon,
  isDrawable,
} from "./types";

const rotatePolygon = (angle: number, offsets: Point[]): Point[] => {
  return offsets.map((offset) => [
    offset[0] * Math.sin(angle) - offset[1] * Math.cos(angle),
    offset[0] * Math.cos(angle) + offset[1] * Math.sin(angle),
  ]);
};

export const drawPolygon = (
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

export const polygonSystem = (showBounding: boolean): DrawableSystem => (
  entity,
  layer
) => {
  if (isPolygon(entity)) {
    const { x, y, radius, angle, points, lineColor, lineWidth } = entity;
    drawPolygon(layer, x, y, radius - 7, angle, points, lineColor, lineWidth);

    if (showBounding) {
      layer.strokeStyle = "lime";
      layer.beginPath();
      layer.arc(x, y, radius, 0, Math.PI * 2, false);
      layer.stroke();
    }
  }
};

export const drawBoard = (
  ctx: CanvasRenderingContext2D,
  layers: CanvasRenderingContext2D[],
  state: GameState
) => {
  layers.forEach((layer) => {
    layer.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
  });

  state.drawers.forEach((drawer) => drawer(layers, state));
  
  state.renders.forEach((render) =>
    state.entities.forEach((entity) => {
      if (isDrawable(entity)) render(entity, layers[entity.layer]);
    })
  );

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  layers.forEach((layer) => ctx.drawImage(layer.canvas, 0, 0));
};
