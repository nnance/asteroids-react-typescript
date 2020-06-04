import React from "react";

export type GameEntity = {
  x: number;
  y: number;
  radius: number;
  xVelocity: number;
  yVelocity: number;
};

export type Particle = {
  x: number;
  y: number;
  // track the past coordinates of each particle to create a trail effect, increase the coordinate count to create more prominent trails
  coordinates: [number, number][];
  // set a random angle in all possible directions, in radians
  angle: number;
  speed: number;
  brightness: number;
  alpha: number;
  // set how fast the particle fades out
  decay: number;
};

export type Explosion = {
  x: number;
  y: number;
  particles: Particle[];
};

export type GameState = {
  score: number;
  level: number;
  lives: number;
  explosions: Explosion[];
};

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
  drawBoard: (ctx: CanvasRenderingContext2D, state: GameState) => void;
  keyHandlers: KeyHandlers;
};

export const GameContext = React.createContext<GameStore>([{}, () => {}]);

export const GameStateProvider: React.FC<GameProviderProps> = ({
  reducer,
  state,
  children,
}) => {
  const store: GameStore = React.useReducer(reducer, state);
  return <GameContext.Provider value={store}>{children}</GameContext.Provider>;
};

export const GameBoard: React.FC<GameBoardProps> = ({
  width,
  height,
  drawBoard,
  keyHandlers,
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [state, dispatch] = React.useContext(GameContext);

  // draw the board every time the state changes
  React.useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) drawBoard(ctx, state as GameState);
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

  return <canvas ref={canvasRef} width={width} height={height}></canvas>;
};
