import React, { Fragment } from "react";
import ReactDOM from "react-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

type GameEntity = {
  x: number;
  y: number;
  radius: number;
  xVelocity: number;
  yVelocity: number;
};

type Laser = GameEntity & {
  distTravelled: number;
  explodeTime: number;
};

type Ship = GameEntity & {
  angle: number;
  rotation: number;
  thrusting: boolean;
  blinkTime: number;
  blinkNum: number;
  canShoot: boolean;
  lasers: Laser[];
};

type Asteroid = GameEntity & {
  angle: number;
  vert: number;
  offsets: number[];
  stage: number; // used to determine the size
};

type Particle = {
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

type Explosion = {
  x: number;
  y: number;
  particles: Particle[];
};

type GameState = {
  score: number;
  level: number;
  lives: number;
  ship: Ship;
  asteroids: Asteroid[];
  explosions: Explosion[];
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

const FPS = 60;
const CANVAS = { width: 700, height: 500 };
const SHIP_SIZE = 20;
const TURN_SPEED = 180; // deg per second
const SHIP_THRUST = 5; // acceleration of the ship in pixels per sec
const FRICTION = 0.7; // friction coefficient of space. (0 = no friction, 1 = full friction)
const ASTEROIDS_NUM = 3;
const ASTEROIDS_SIZE = [100, 50, 25]; // size in pixel per stage
const ASTEROIDS_SPEED = 50; // max starting speed in pixels per sec
const ASTEROIDS_VERT = 10; // avg num of vertices
const ASTEROID_JAG = 0.3;
const SHIP_EXPLODE_DURATION = 0.3;
const SHIP_INVINCIBLE_DURATION = 3;
const SHIP_BLINK_DURATION = 0.3;
const SHOW_BOUNDING = false;
const PARTICLE_TRAIL = 2; // the length of the trail on particles
const PARTICLE_COUNT = 10; // the number of particles in the explosion
const PARTICLE_GRAVITY = 0; // gravity will be applied and pull the particle down
const PARTICLE_MAX_SPEED = 2;
const PARTICLE_FRICTION = 0.95; // friction will slow the particle down
const PARTICLE_DECAY_MIN = 0.01; // the range of of how fast a particle decays
const PARTICLE_DECAY_MAX = 0.05;
const LASER_MAX = 10;
const LASER_SIZE = 3; // pixel size of laser
const LASER_SPEED = 500; // pixels per second
const LASER_DIST = 0.6; // fraction of screen width
const LASER_EXPLODE_DURATION = 0.1;
const GAME_LIVES = 3;
const POINTS = [20, 50, 100]; // points per asteroid stage

const distBetweenPoints = (
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number => {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
};

// get a random number within a range
function random(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

const circleCollision = (obj1: GameEntity, obj2: GameEntity) => {
  const radiusSum = obj1.radius + obj2.radius;
  const xDiff = obj1.x - obj2.x;
  const yDiff = obj1.y - obj2.y;

  return radiusSum > Math.sqrt(xDiff * xDiff + yDiff * yDiff);
};

const createShip = (): Ship => ({
  x: CANVAS.width / 2,
  y: CANVAS.height / 2,
  radius: SHIP_SIZE / 2,
  angle: (90 / 180) * Math.PI, // 90 deg -> up, converting to rad
  rotation: 0,
  thrusting: false,
  xVelocity: 0,
  yVelocity: 0,
  blinkTime: 0,
  blinkNum: Math.ceil(SHIP_INVINCIBLE_DURATION / SHIP_BLINK_DURATION),
  canShoot: true,
  lasers: [],
});

const createLaser = ({ ship }: GameState): Laser => ({
  x: ship.x + (4 / 3) * ship.radius * Math.cos(ship.angle),
  y: ship.y - (4 / 3) * ship.radius * Math.sin(ship.angle),
  xVelocity: (LASER_SPEED * Math.cos(ship.angle)) / FPS,
  yVelocity: (-LASER_SPEED * Math.sin(ship.angle)) / FPS,
  radius: 3,
  distTravelled: 0,
  explodeTime: 0,
});

const createAsteroid = (
  x: number,
  y: number,
  level: number,
  stage = 1
): Asteroid => {
  const levelMultiplier = 1 + 0.1 * level;
  const angle = Math.random() * Math.PI * 2; // in rad
  const vert = Math.floor(
    Math.random() * (ASTEROIDS_VERT + 1) + ASTEROIDS_VERT / 2
  );

  return {
    x: x,
    y: y,
    xVelocity:
      ((Math.random() * ASTEROIDS_SPEED * levelMultiplier) / FPS) *
      (Math.random() < 0.5 ? 1 : -1),
    yVelocity:
      ((Math.random() * ASTEROIDS_SPEED * levelMultiplier) / FPS) *
      (Math.random() < 0.5 ? 1 : -1),
    radius: Math.ceil(ASTEROIDS_SIZE[stage - 1] / 2),
    angle,
    vert,
    stage,
    offsets: Array(vert)
      .fill(0)
      .map((_) => Math.random() * ASTEROID_JAG * 2 + 1 - ASTEROID_JAG),
  };
};

const createAsteroidBelt = (level: number, ship: Ship): Asteroid[] => {
  return Array(ASTEROIDS_NUM + level)
    .fill(0)
    .map((_) => {
      let x: number, y: number;
      do {
        x = Math.floor(Math.random() * CANVAS.width);
        y = Math.floor(Math.random() * CANVAS.height);
      } while (
        distBetweenPoints(ship.x, ship.y, x, y) <
        ASTEROIDS_SIZE[0] * 2 + ship.radius
      );
      return createAsteroid(x, y, level);
    });
};

const createParticle = (x: number, y: number): Particle => ({
  x: x,
  y: y,
  // track the past coordinates of each particle to create a trail effect, increase the coordinate count to create more prominent trails
  coordinates: Array.from({ length: PARTICLE_TRAIL }, () => [x, y]),
  // set a random angle in all possible directions, in radians
  angle: random(0, Math.PI * 2),
  speed: random(1, PARTICLE_MAX_SPEED),
  brightness: random(50, 80),
  alpha: 1,
  // set how fast the particle fades out
  decay: random(PARTICLE_DECAY_MIN, PARTICLE_DECAY_MAX),
});

const createExplosion = (x: number, y: number): Explosion => ({
  x,
  y,
  particles: Array.from({ length: PARTICLE_COUNT }, () => createParticle(x, y)),
});

const createGameState = (): GameState => {
  const level = 1;
  const ship = createShip();
  return {
    score: 0,
    lives: 3,
    level,
    ship,
    asteroids: createAsteroidBelt(level, ship),
    explosions: [],
  };
};

const isGameOver = (state: GameState): boolean => state.lives === 0;
const isSpawning = (state: GameState): boolean => state.ship.blinkNum > 0;

const drawShip = (
  ctx: CanvasRenderingContext2D,
  state: GameState,
  color = "white"
) => {
  const { x, y, angle, ...ship } = state.ship;

  if (state.ship.blinkNum === 0 || state.ship.blinkNum % 2 === 0) {
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
  }
};

const drawParticle = (ctx: CanvasRenderingContext2D, state: Particle) => {
  ctx.beginPath();
  // move to the last tracked coordinates in the set, then draw a line to the current x and y
  ctx.moveTo(
    state.coordinates[state.coordinates.length - 1][0],
    state.coordinates[state.coordinates.length - 1][1]
  );
  ctx.lineTo(state.x, state.y);
  ctx.strokeStyle = `hsla(white, 100%, ${state.brightness}%, ${state.alpha})`;
  ctx.stroke();
};

const drawExplosions = (ctx: CanvasRenderingContext2D, state: GameState) => {
  state.explosions.forEach((_) =>
    _.particles.forEach((_) => drawParticle(ctx, _))
  );
};

const drawLasers = (ctx: CanvasRenderingContext2D, { ship }: GameState) => {
  // draw laser
  ship.lasers.forEach(({ x, y, explodeTime }) => {
    if (explodeTime === 0) {
      ctx.fillStyle = "white";
      ctx.fillRect(x, y, LASER_SIZE, LASER_SIZE);
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

const drawBelt = (ctx: CanvasRenderingContext2D, state: GameState) => {
  // asteroids
  ctx.lineWidth = SHIP_SIZE / 20;
  state.asteroids.forEach(({ x, y, radius, angle, vert, offsets }, i) => {
    ctx.strokeStyle = "slategrey";

    // PATH
    ctx.beginPath();
    ctx.moveTo(
      x + radius * offsets[0] * Math.cos(angle),
      y + radius * offsets[0] * Math.sin(angle)
    );

    // POLYGON
    for (let j = 1; j < vert; j++) {
      ctx.lineTo(
        x + radius * offsets[j] * Math.cos(angle + (j * Math.PI * 2) / vert),
        y + radius * offsets[j] * Math.sin(angle + (j * Math.PI * 2) / vert)
      );
    }
    ctx.closePath();
    ctx.stroke();

    if (SHOW_BOUNDING) {
      ctx.strokeStyle = "lime";
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2, false);
      ctx.stroke();
    }
  });
};

const drawGameOver = (ctx: CanvasRenderingContext2D, state: GameState) => {
  ctx.fillStyle = "black";
  ctx.globalAlpha = 0.75;
  ctx.fillRect(0, CANVAS.height / 2 - 30, CANVAS.width, 60);

  ctx.globalAlpha = 1;
  ctx.fillStyle = "white";
  ctx.font = "36px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("GAME OVER!", CANVAS.width / 2, CANVAS.height / 2);
};

const drawBoard = (ctx: CanvasRenderingContext2D, state: GameState) => {
  // space
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);

  const drawers = isGameOver(state)
    ? [drawBelt, drawExplosions, drawGameOver]
    : [drawBelt, drawShip, drawLasers, drawExplosions];
  drawers.forEach((drawer) => drawer(ctx, state));
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

  const x = ship.x + ship.xVelocity;
  const y = ship.y + ship.yVelocity;

  // handle edge of the board
  const leftCorner = 0 - ship.radius;
  const rightCorner = CANVAS.width + ship.radius;
  const topCorner = 0 - ship.radius;
  const bottomCorner = CANVAS.height + ship.radius;

  return {
    ...state,
    ship: {
      ...ship,
      x: x < leftCorner ? rightCorner : x > rightCorner ? leftCorner : x,
      y: y < topCorner ? bottomCorner : y > bottomCorner ? topCorner : y,
      angle,
      xVelocity: ship.thrusting
        ? ship.xVelocity + (SHIP_THRUST * Math.cos(angle)) / FPS
        : ship.xVelocity - (FRICTION * ship.xVelocity) / FPS,
      yVelocity: ship.thrusting
        ? ship.yVelocity - (SHIP_THRUST * Math.sin(angle)) / FPS
        : ship.yVelocity - (FRICTION * ship.yVelocity) / FPS,
    },
  };
};

const moveParticle = (state: Particle): Particle | undefined => {
  const { x, y } = state;
  const coordinates = [...state.coordinates];
  // remove last item in coordinates array
  coordinates.pop();
  // add current coordinates to the start of the array
  coordinates.unshift([x, y]);

  // slow down the particle
  const speed = state.speed * PARTICLE_FRICTION;

  // fade out the particle
  const alpha = state.alpha - state.decay;

  // remove the particle once the alpha is low enough
  return alpha <= state.decay
    ? undefined
    : {
        ...state,
        coordinates,
        speed,
        alpha,
        // apply velocity
        x: x + Math.cos(state.angle) * speed,
        y: y + Math.sin(state.angle) * speed + PARTICLE_GRAVITY,
      };
};

const blinkShip = (state: GameState): GameState => {
  const { ship } = state;
  return {
    ...state,
    ship: {
      ...ship,
      // reduce blink time and num
      blinkTime:
        ship.blinkTime === 0
          ? Math.ceil(SHIP_BLINK_DURATION * FPS)
          : ship.blinkTime - 1,
      blinkNum:
        ship.blinkTime === 0 && ship.blinkNum > 0
          ? ship.blinkNum - 1
          : ship.blinkNum,
    },
  };
};

const animateExplosions = (state: GameState): GameState => ({
  ...state,
  explosions: state.explosions.map((explosion) => ({
    ...explosion,
    particles: explosion.particles.reduce((prev, particle) => {
      const newPart = moveParticle(particle);
      return newPart ? prev.concat(newPart) : prev;
    }, [] as Particle[]),
  })),
});

const removeAsteroid = (
  asteroids: Asteroid[],
  asteroid: Asteroid,
  level: number
): Asteroid[] => {
  const { stage: stage, x, y } = asteroid;

  const newBelt = asteroids.reduce(
    (prev, ast) => (asteroid == ast ? prev : prev.concat(ast)),
    [] as Asteroid[]
  );

  return stage === 1
    ? newBelt.concat([
        createAsteroid(x - 5, y - 5, level, 2),
        createAsteroid(x + 5, y + 5, level, 2),
      ])
    : stage === 2
    ? newBelt.concat([
        createAsteroid(x - 5, y - 5, level, 3),
        createAsteroid(x + 5, y + 5, level, 3),
      ])
    : newBelt;
};

const removeLaser = (asteroid: Asteroid, ship: Ship) =>
  ship.lasers.reduce(
    (prev, laser) =>
      circleCollision(laser, asteroid) ? prev : prev.concat(laser),
    [] as Laser[]
  );

const checkShipCollision = (state: GameState): GameState => {
  const { ship, asteroids, level } = state;

  const hitAsteroid = asteroids.find((asteroid) =>
    circleCollision(ship, asteroid)
  );

  const explosion =
    hitAsteroid &&
    createExplosion(
      ship.x + (4 / 3) * ship.radius * Math.cos(ship.angle),
      ship.y - (4 / 3) * ship.radius * Math.sin(ship.angle)
    );

  return hitAsteroid
    ? state.lives > 1
      ? {
          ...state,
          ship: createShip(),
          lives: state.lives - 1,
          asteroids: removeAsteroid(asteroids, hitAsteroid, level),
          explosions: state.explosions.concat(explosion || []),
        }
      : {
          ...state,
          lives: 0,
          explosions: state.explosions.concat(explosion || []),
        }
    : state;
};

const checkLaserCollision = (state: GameState): GameState => {
  const { asteroids, ship, level } = state;

  const hitLaser = ship.lasers.find((laser) =>
    asteroids.find((asteroid) => circleCollision(laser, asteroid))
  );

  const hitAsteroid =
    hitLaser &&
    asteroids.find((asteroid) => circleCollision(hitLaser, asteroid));

  const explosion = hitLaser && createExplosion(hitLaser.x, hitLaser.y);

  return hitAsteroid
    ? {
        ...state,
        asteroids: removeAsteroid(asteroids, hitAsteroid, level),
        ship: {
          ...ship,
          lasers: removeLaser(hitAsteroid, ship),
        },
        explosions: state.explosions.concat(explosion || []),
        score: state.score + POINTS[hitAsteroid.stage - 1],
      }
    : state;
};

const moveLasers = (state: GameState): GameState => {
  const { ship } = state;

  // if laser is off the board remove it from the array otherwise move it
  const moveIfOnBoard = (prev: Laser[], { x, y, ...laser }: Laser): Laser[] => {
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

const moveAsteroids = (state: GameState): GameState => {
  const { asteroids } = state;

  const moveAsteroid = (asteroid: Asteroid): Asteroid => {
    const { radius, xVelocity, yVelocity } = asteroid;

    const x = asteroid.x + xVelocity;
    const y = asteroid.y + yVelocity;

    // handle edge of the board
    const leftCorner = 0 - radius;
    const rightCorner = CANVAS.width + radius;
    const topCorner = 0 - radius;
    const bottomCorner = CANVAS.height + radius;

    return {
      ...asteroid,
      x: x < leftCorner ? rightCorner : x > rightCorner ? leftCorner : x,
      y: y < topCorner ? bottomCorner : y > bottomCorner ? topCorner : y,
    };
  };

  return {
    ...state,
    asteroids: asteroids.map(moveAsteroid),
  };
};

const checkLevelCompleted = (state: GameState): GameState => {
  const level = state.level + 1;
  return state.asteroids.length
    ? state
    : {
        ...state,
        asteroids: createAsteroidBelt(level, state.ship),
        level,
      };
};

const gameLoop = (state: GameState): GameState => {
  return (isGameOver(state)
    ? [animateExplosions]
    : isSpawning(state)
    ? [blinkShip, moveAsteroids, animateExplosions]
    : [
        moveShip,
        moveLasers,
        moveAsteroids,
        checkShipCollision,
        checkLaserCollision,
        checkLevelCompleted,
        animateExplosions,
      ]
  ).reduce((prev, transducer) => transducer(prev), state);
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

export const ScoreBoard = () => {
  const [state] = React.useContext(GameContext);
  return (
    <div style={{ float: "right" }}>
      <table>
        <tbody>
          <tr>
            <td>Score:</td>
            <td>
              <b>{state.score}</b>
            </td>
          </tr>
          <tr>
            <td>Level:</td>
            <td>
              <b>{state.level}</b>
            </td>
          </tr>
          <tr>
            <td>Lives:</td>
            <td>
              <b>{state.lives}</b>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export const Controls = () => {
  return (
    <div>
      <table>
        <tbody>
          <tr>
            <td>
              <b>Space bar</b>
            </td>
          </tr>
          <tr>
            <td>Fire Laser</td>
          </tr>
          <tr>
            <td>
              <b>R</b>
            </td>
          </tr>
          <tr>
            <td>reset</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
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
            <ScoreBoard />
          </Col>
          <Col>
            <GameBoard />
          </Col>
          <Col>
            <Controls />
          </Col>
        </Row>
      </Container>
    </GameStateProvider>
  </Theme>
);

ReactDOM.render(<App />, document.querySelector("#root"));
