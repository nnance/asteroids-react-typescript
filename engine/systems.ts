import { hasVelocity, hasPosition, System } from "./types";

export const applyVelocity: System = (entity) => {
  if (hasVelocity(entity) && hasPosition(entity)) {
    entity.x += entity.xVelocity;
    entity.y += entity.yVelocity;
  }

  return entity;
};
