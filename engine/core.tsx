import React, { CSSProperties } from "react";
import { drawBoard } from "./rendering";
import { GameState, Entity, SystemEntity } from "./types";

export enum GameActions {
  rotateRight,
  rotateLeft,
  rotateStop,
  thrustOn,
  thrustStop,
  shootLaser,
  enableLaser,
  gameLoop,
}

export type GameReducer = (state: GameState, action: GameActions) => GameState;
export type GameStore = [Partial<GameState>, React.Dispatch<GameActions>];

export type GameProviderProps = {
  reducer: GameReducer;
  state: GameState;
};

export type KeyHandlers = (
  dispatch: React.Dispatch<GameActions>
) => {
  keyDown: (e: KeyboardEvent) => void;
  keyUp: (e: KeyboardEvent) => void;
};

export type GameBoardProps = {
  width: number;
  height: number;
  keyHandlers: KeyHandlers;
  style?: CSSProperties;
};

const createLayer = (
  width: number,
  height: number
): CanvasRenderingContext2D | null => {
  const layer = document.createElement("canvas");
  layer.width = width;
  layer.height = height;
  return layer.getContext("2d");
};

const createLayers = (width: number, height: number) => {
  const layers = Array.from({ length: 3 }, () => createLayer(width, height));
  return layers.filter((_) => _ !== null) as CanvasRenderingContext2D[];
};

const updateEntities = (state: GameState): GameState => {
  return {
    ...state,
    entities: state.entities.map((entity) =>
      state.systems.reduce((prev, system) => system(prev as Entity), entity)
    ),
  };
};

const coreReducer = (reducer: GameReducer): GameReducer => (gameState, action) => {
  const updatedState = updateEntities(gameState);
  return reducer(updatedState, action);
};

export const GameContext = React.createContext<GameStore>([{}, () => {}]);

export const GameStateProvider: React.FC<GameProviderProps> = ({
  reducer,
  state,
  children,
}) => {
  const store: GameStore = React.useReducer(coreReducer(reducer), state);
  return <GameContext.Provider value={store}>{children}</GameContext.Provider>;
};

export const GameBoard: React.FC<GameBoardProps> = ({
  width,
  height,
  style,
  keyHandlers,
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const layerRef = React.useRef(createLayers(width, height));
  const [state, dispatch] = React.useContext(GameContext);

  // draw the board every time the state changes
  React.useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) drawBoard(ctx, layerRef.current, state as GameState);
  }, [canvasRef, state]);

  // dispatch the game loop on every animation frame
  React.useEffect(() => {
    let frameId: number;
    const loop = () => {
      frameId = requestAnimationFrame(loop);
      dispatch(GameActions.gameLoop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [canvasRef]);

  // setup keyboard handlers
  React.useEffect(() => {
    const { keyDown, keyUp } = keyHandlers(dispatch);
    document.addEventListener("keydown", keyDown);
    document.addEventListener("keyup", keyUp);
    return () => {
      document.removeEventListener("keydown", keyDown);
      document.removeEventListener("keyup", keyUp);
    };
  });

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={style}
    ></canvas>
  );
};
