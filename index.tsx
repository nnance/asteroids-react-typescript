import React, { Fragment, ProviderProps } from "react";
import ReactDOM from "react-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

type Laser = {
  x: number;
  y: number;
  xVelocity: number;
  yVelocity: number;
  distTravelled: number;
  explodeTime: number;
};

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
  lasers: Laser[];
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
  shootLaser,
  enableLaser,
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
const LASER_MAX = 10;
const LASER_SPEED = 500; // pixels per second
const LASER_DIST = 0.6; // fraction of screen width
const LASER_EXPLODE_DURATION = 0.1;

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

const createLaser = ({ ship }: GameState): Laser => ({
  x: ship.x + (4 / 3) * ship.radius * Math.cos(ship.angle),
  y: ship.y - (4 / 3) * ship.radius * Math.sin(ship.angle),
  xVelocity: (LASER_SPEED * Math.cos(ship.angle)) / FPS,
  yVelocity: (-LASER_SPEED * Math.sin(ship.angle)) / FPS,
  distTravelled: 0,
  explodeTime: 0,
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

const drawLasers = (ctx: CanvasRenderingContext2D, { ship }: GameState) => {
  // draw laser
  ship.lasers.forEach(({ x, y, explodeTime }) => {
    if (explodeTime === 0) {
      ctx.fillStyle = "salmon";
      ctx.beginPath();
      ctx.arc(x, y, SHIP_SIZE / 15, 0, Math.PI * 2, false);
      ctx.fill();
    } else {
      ctx.fillStyle = "orangered";
      ctx.beginPath();
      ctx.arc(x, y, ship.radius * 0.75, 0, Math.PI * 2, false);
      ctx.fill();
      ctx.fillStyle = "salmon";
      ctx.beginPath();
      ctx.arc(x, y, ship.radius * 0.5, 0, Math.PI * 2, false);
      ctx.fill();
      ctx.fillStyle = "pink";
      ctx.beginPath();
      ctx.arc(x, y, ship.radius * 0.25, 0, Math.PI * 2, false);
      ctx.fill();
    }
  });
};

const drawBoard = (ctx: CanvasRenderingContext2D, state: GameState) => {
  // space
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);

  drawShip(ctx, state.ship);
  drawLasers(ctx, state);
};

const rotateLeft = (state: GameState): GameState => ({
  ...state,
  ship: { ...state.ship, rotation: ((TURN_SPEED / 180) * Math.PI) / FPS },
});

const rotateRight = (state: GameState): GameState => ({
  ...state,
  ship: { ...state.ship, rotation: ((-TURN_SPEED / 180) * Math.PI) / FPS },
});

const rotateStop = (state: GameState): GameState => ({
  ...state,
  ship: { ...state.ship, rotation: 0 },
});

const thrustOn = (state: GameState): GameState => ({
  ...state,
  ship: { ...state.ship, thrusting: true },
});

const thrustStop = (state: GameState): GameState => ({
  ...state,
  ship: { ...state.ship, thrusting: false },
});

const shootLaser = (state: GameState): GameState => ({
  ...state,
  ship: state.ship.canShoot
    ? {
        ...state.ship,
        lasers: state.ship.lasers.concat(createLaser(state)),
        canShoot: false,
      }
    : { ...state.ship },
});

const enableLaser = (state: GameState): GameState => ({
  ...state,
  ship: { ...state.ship, canShoot: true },
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

const moveLasers = (state: GameState): GameState => {
  const {ship} = state;
  
  // if laser is off the board remove it from the array otherwise move it
  const moveIfOnBoard = (prev: Laser[], {x, y, ...laser}: Laser): Laser[] => {
    return x < 0 || x > CANVAS.width || y < 0 || y > CANVAS.height
      ? prev
      : prev.concat({
          ...laser,
          x: x + laser.xVelocity,
          y: y + laser.yVelocity,
        });
  };

  return {
    ...state,
    ship: {
      ...ship,
      lasers: ship.lasers.reduce(moveIfOnBoard, []),
    },
  };
};

const gameLoop = (state: GameState): GameState => {
  return [moveShip, moveLasers].reduce(
    (prev, transducer) => transducer(prev),
    state
  );
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
    : action === GameActions.shootLaser
    ? shootLaser(state)
    : action === GameActions.enableLaser
    ? enableLaser(state)
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
    else if (e.keyCode === 32) dispatch(GameActions.shootLaser);
  };

  const keyUp = (e: KeyboardEvent) => {
    console.log(`keyup: ${e.keyCode}`);
    if (e.keyCode === 37 || e.keyCode === 39) dispatch(GameActions.rotateStop);
    else if (e.keyCode === 38) dispatch(GameActions.thrustStop);
    else if (e.keyCode === 32) dispatch(GameActions.enableLaser);
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
