import React, { Fragment, ProviderProps } from "react";
import ReactDOM from "react-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

type Ship = {
  x: number;
  y: number;
  radius: number;
  angle: number;
  rotation: number;
  thrusting: boolean;
  thrust: {
    x: number;
    y: number;
  };
  explodeTime: number;
  blinkTime: number;
  blinkNum: number;
  canShoot: boolean;
  lasers: [];
  dead: boolean;
};

type GameState = {
  ship: Ship;
};

enum GameActions {
  rotateRight,
  rotateLeft,
  rotateStop,
  thrustOn,
  thrustStop,
  gameLoop,
}

type GameReducer = (state: GameState, action: GameActions) => GameState;
type GameStore = [GameState, React.Dispatch<GameActions>];

const CANVAS = {
  width: 700,
  height: 500,
};

const FPS = 60;
const SHIP_SIZE = 30;
const TURN_SPEED = 360; // deg per second
const SHIP_THRUST = 5; // acceleration of the ship in pixels per sec per sec
const FRICTION = 0.7; // friction coefficient of space. (0 = no friction, 1 = full friction)
const SHIP_EXPLODE_DURATION = 0.3;
const SHIP_INVINCIBLE_DURATION = 3;
const SHIP_BLINK_DURATION = 0.1;
const SHOW_BOUNDING = false;

const createShip = (): Ship => ({
  x: CANVAS.width / 2,
  y: CANVAS.height / 2,
  radius: SHIP_SIZE / 2,
  angle: (90 / 180) * Math.PI, // 90 deg -> up, converting to rad
  rotation: 0,
  thrusting: false,
  thrust: {
    x: 0,
    y: 0,
  },
  explodeTime: 0,
  blinkTime: Math.ceil(SHIP_BLINK_DURATION * FPS),
  blinkNum: Math.ceil(SHIP_INVINCIBLE_DURATION / SHIP_BLINK_DURATION),
  canShoot: true,
  lasers: [],
  dead: false,
});

const createGameState = (): GameState => ({
  ship: createShip(),
});

const drawShip = (
  ctx: CanvasRenderingContext2D,
  { x, y, angle, ...ship }: Ship,
  color = "white"
) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = SHIP_SIZE / 20;
  ctx.beginPath();
  ctx.moveTo(
    // nose
    x + (4 / 3) * ship.radius * Math.cos(angle), // cosine represents horizontal
    y - (4 / 3) * ship.radius * Math.sin(angle) // sine represents vertical
  );
  ctx.lineTo(
    // rear left
    x - ship.radius * ((2 / 3) * Math.cos(angle) + Math.sin(angle)),
    y + ship.radius * ((2 / 3) * Math.sin(angle) - Math.cos(angle))
  );
  ctx.lineTo(
    // rear right
    x - ship.radius * ((2 / 3) * Math.cos(angle) - Math.sin(angle)),
    y + ship.radius * ((2 / 3) * Math.sin(angle) + Math.cos(angle))
  );
  ctx.closePath();
  ctx.stroke();

  if (SHOW_BOUNDING) {
    ctx.strokeStyle = "lime";
    ctx.beginPath();
    ctx.arc(x, y, ship.radius, 0, Math.PI * 2, false);
    ctx.stroke();
  }
};

const drawBoard = (ctx: CanvasRenderingContext2D, state: GameState) => {
  // space
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);

  drawShip(ctx, state.ship);
};

const rotateLeft = (state: GameState): GameState => {
  const { ship } = state;
  return {
    ...state,
    ship: { ...ship, rotation: ((TURN_SPEED / 180) * Math.PI) / FPS },
  };
};

const rotateRight = (state: GameState): GameState => {
  const { ship } = state;
  return {
    ...state,
    ship: { ...ship, rotation: ((-TURN_SPEED / 180) * Math.PI) / FPS },
  };
};

const rotateStop = (state: GameState): GameState => {
  const { ship } = state;
  return {
    ...state,
    ship: { ...ship, rotation: 0 },
  };
};

const thrustOn = (state: GameState): GameState => ({
  ...state,
  ship: { ...state.ship, thrusting: true },
});

const thrustStop = (state: GameState): GameState => ({
  ...state,
  ship: { ...state.ship, thrusting: false },
});

const moveShip = (state: GameState): GameState => {
  const { ship } = state;
  const angle = ship.angle + ship.rotation;
  return {
    ...state,
    ship: {
      ...ship,
      x: ship.x + ship.thrust.x,
      y: ship.y + ship.thrust.y,
      angle,
      thrust: ship.thrusting
        ? {
            x: ship.thrust.x + (SHIP_THRUST * Math.cos(angle)) / FPS,
            y: ship.thrust.y - (SHIP_THRUST * Math.sin(angle)) / FPS,
          }
        : {
            x: ship.thrust.x - (FRICTION * ship.thrust.x) / FPS,
            y: ship.thrust.y - (FRICTION * ship.thrust.y) / FPS,
          },
    },
  };
};

const gameLoop = (state: GameState): GameState => {
  return [moveShip].reduce((prev, transducer) => transducer(prev), state);
};

const reducer: GameReducer = (state, action) => {
  return action === GameActions.rotateLeft
    ? rotateLeft(state)
    : action === GameActions.rotateRight
    ? rotateRight(state)
    : action === GameActions.rotateStop
    ? rotateStop(state)
    : action === GameActions.thrustOn
    ? thrustOn(state)
    : action === GameActions.thrustStop
    ? thrustStop(state)
    : action === GameActions.gameLoop
    ? gameLoop(state)
    : state;
};

const GameContext = React.createContext<GameStore>([
  createGameState(),
  () => {},
]);

const GameStateProvider: React.FC = (props) => {
  const store: GameStore = React.useReducer(reducer, createGameState());
  return (
    <GameContext.Provider value={store}>{props.children}</GameContext.Provider>
  );
};

const keyHandlers = (dispatch: React.Dispatch<GameActions>) => {
  const keyDown = (e: KeyboardEvent) => {
    if (e.keyCode === 37) dispatch(GameActions.rotateLeft);
    else if (e.keyCode === 38) dispatch(GameActions.thrustOn);
    else if (e.keyCode === 39) dispatch(GameActions.rotateRight);
  };

  const keyUp = (e: KeyboardEvent) => {
    console.log(`keyup: ${e.keyCode}`);
    if (e.keyCode === 37 || e.keyCode === 39) dispatch(GameActions.rotateStop);
    else if (e.keyCode === 38) dispatch(GameActions.thrustStop);
  };
  return { keyDown, keyUp };
};

const GameBoard = () => {
  const { width, height } = CANVAS;
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [state, dispatch] = React.useContext(GameContext);

  // draw the board every time the state changes
  React.useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) drawBoard(ctx, state);
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

const Theme: React.FC = (props) => {
  React.useEffect(() => {
    const { style } = document.body;
    style.backgroundColor = "#282c34";
    style.color = "white";
  });
  return <Fragment>{props.children}</Fragment>;
};

export const App = () => (
  <Theme>
    <GameStateProvider>
      <Container style={{ textAlign: "center" }} fluid>
        <h3 className="m-3">Asteroids</h3>
        <Row>
          <Col>
            <GameBoard />
          </Col>
        </Row>
      </Container>
    </GameStateProvider>
  </Theme>
);

ReactDOM.render(<App />, document.querySelector("#root"));
