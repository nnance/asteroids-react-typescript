import React, { Fragment } from "react";
import ReactDOM from "react-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import {
  GameStateProvider,
  GameState,
  GameReducer,
  KeyHandlers,
  GameContext,
  GameBoard,
  GameActions,
  Drawer,
  polygonSystem,
  Polygon,
  DrawableSystem,
  DrawableEntity,
  Point,
  applyVelocity,
} from "./engine";

type Laser = DrawableEntity & {
  distTravelled: number;
  explodeTime: number;
};

type Ship = Polygon & {
  rotation: number;
  thrusting: boolean;
  blinkTime: number;
  blinkNum: number;
  canShoot: boolean;
  lasers: Laser[];
};

export function isShip(entity: DrawableEntity): entity is Ship {
  return (entity as Ship).lasers !== undefined;
}

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
  layer: number;
  particles: Particle[];
};

type Asteroid = Polygon & {
  offsets: number[];
  stage: number; // used to determine the size
};

type AsteroidsState = GameState & {
  ship: Ship;
  asteroids: Asteroid[];
  explosions: Explosion[];
};

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

const circleCollision = (obj1: DrawableEntity, obj2: DrawableEntity) => {
  const radiusSum = obj1.radius + obj2.radius;
  const xDiff = obj1.x - obj2.x;
  const yDiff = obj1.y - obj2.y;

  return radiusSum > Math.sqrt(xDiff * xDiff + yDiff * yDiff);
};

const createShip = (): Ship => ({
  x: CANVAS.width / 2,
  y: CANVAS.height / 2,
  points: [
    [0, -6],
    [-3, 3],
    [0, 2],
    [3, 3],
    [0, -6],
  ],
  layer: 0,
  radius: SHIP_SIZE / 2,
  scale: SHIP_SIZE / 2,
  angle: (90 / 180) * Math.PI, // 90 deg -> up, converting to rad
  rotation: 0,
  lineColor: "white",
  lineWidth: SHIP_SIZE / 20,
  thrusting: false,
  xVelocity: 0,
  yVelocity: 0,
  blinkTime: 0,
  blinkNum: Math.ceil(SHIP_INVINCIBLE_DURATION / SHIP_BLINK_DURATION),
  canShoot: true,
  lasers: [],
});

const createLaser = ({ ship }: AsteroidsState): Laser => {
  return {
    x: ship.x + (4 / 3) * ship.radius * Math.cos(ship.angle),
    y: ship.y - (4 / 3) * ship.radius * Math.sin(ship.angle),
    layer: 0,
    xVelocity: (LASER_SPEED * Math.cos(ship.angle)) / FPS,
    yVelocity: (-LASER_SPEED * Math.sin(ship.angle)) / FPS,
    radius: 3,
    distTravelled: 0,
    explodeTime: 0,
  };
};

const createAsteroid = (
  x: number,
  y: number,
  level: number,
  stage = 1
): Asteroid => {
  const levelMultiplier = 1 + 0.1 * level;
  const angle = Math.random() * Math.PI * 2; // in rad
  const length = Math.floor(
    Math.random() * (ASTEROIDS_VERT + 1) + ASTEROIDS_VERT / 2
  );

  const offsets = Array.from(
    { length },
    () => Math.random() * ASTEROID_JAG * 2 + 1 - ASTEROID_JAG
  );

  const vert = offsets.length;
  const points = offsets.map(
    (offset, j) =>
      [
        offset * Math.cos(angle + (j * Math.PI * 2) / vert),
        offset * Math.sin(angle + (j * Math.PI * 2) / vert),
      ] as Point
  );

  return {
    x: x,
    y: y,
    layer: 1,
    xVelocity:
      ((Math.random() * ASTEROIDS_SPEED * levelMultiplier) / FPS) *
      (Math.random() < 0.5 ? 1 : -1),
    yVelocity:
      ((Math.random() * ASTEROIDS_SPEED * levelMultiplier) / FPS) *
      (Math.random() < 0.5 ? 1 : -1),
    radius: Math.ceil(ASTEROIDS_SIZE[stage - 1] / 2),
    scale: Math.ceil(ASTEROIDS_SIZE[stage - 1] / 2),
    lineColor: "slategrey",
    angle,
    stage,
    offsets,
    points,
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
      const asteroid = createAsteroid(x, y, level);
      console.dir(asteroid.offsets);
      return asteroid;
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
  layer: 1,
});

const isGameOver = (state: AsteroidsState): boolean => state.lives === 0;
const isSpawning = ({ ship }: AsteroidsState): boolean => ship.blinkNum > 0;

const drawShip = (showBounding: boolean): DrawableSystem => (entity, layer) => {
  if (isShip(entity)) {
    if (entity.blinkNum === 0 || entity.blinkNum % 2 === 0) {
      polygonSystem(showBounding)(entity, layer);
    }
  } else polygonSystem(showBounding)(entity, layer);
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

const drawExplosions: Drawer = (ctxs, state) => {
  (state as AsteroidsState).explosions.forEach((_) => {
    const ctx = ctxs[_.layer];
    _.particles.forEach((_) => drawParticle(ctx, _));
  });
};

const drawLasers: Drawer = (ctxs, state) => {
  const { ship } = state as AsteroidsState;
  // draw laser
  ship.lasers.forEach(({ x, y, explodeTime }) => {
    const ctx = ctxs[ship.layer];

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

const drawGameOver: Drawer = (ctxs, state) => {
  const ctx = ctxs[0];
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

const rotateLeft = ({ ship, ...state }: AsteroidsState): AsteroidsState => {
  return {
    ...state,
    ship: { ...ship, rotation: ((TURN_SPEED / 180) * Math.PI) / FPS } as Ship,
  };
};

const rotateRight = ({ ship, ...state }: AsteroidsState): AsteroidsState => {
  return {
    ...state,
    ship: { ...ship, rotation: ((-TURN_SPEED / 180) * Math.PI) / FPS } as Ship,
  };
};

const rotateStop = ({ ship, ...state }: AsteroidsState): AsteroidsState => {
  return {
    ...state,
    ship: { ...ship, rotation: 0 },
  };
};

const thrustOn = ({ ship, ...state }: AsteroidsState): AsteroidsState => {
  return {
    ...state,
    ship: { ...ship, thrusting: true },
  };
};

const thrustStop = ({ ship, ...state }: AsteroidsState): AsteroidsState => {
  return {
    ...state,
    ship: { ...ship, thrusting: false },
  };
};

const shootLaser = (state: AsteroidsState): AsteroidsState => {
  const { ship } = state;
  return {
    ...state,
    ship: ship.canShoot
      ? ({
          ...ship,
          lasers: ship.lasers.concat(createLaser(state)),
          canShoot: false,
        } as Ship)
      : ship,
  };
};

const enableLaser = ({ ship, ...state }: AsteroidsState): AsteroidsState => {
  return {
    ...state,
    ship: { ...ship, canShoot: true },
  };
};

const moveShip = ({ ship, ...state }: AsteroidsState): AsteroidsState => {
  const angle = ship.angle + ship.rotation;

  const x = ship.x;
  const y = ship.y;

  // const x = ship.x + ship.xVelocity;
  // const y = ship.y + ship.yVelocity;

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
      // offsets: angle !== ship.angle ? rotatePolygon(angle, ship.offsets) : ship.offsets,
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

const blinkShip = ({ ship, ...state }: AsteroidsState): AsteroidsState => {
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

const animateExplosions = (state: AsteroidsState): AsteroidsState => {
  return {
    ...state,
    explosions: state.explosions.map((explosion) => ({
      ...explosion,
      particles: explosion.particles.reduce((prev, particle) => {
        const newPart = moveParticle(particle);
        return newPart ? prev.concat(newPart) : prev;
      }, [] as Particle[]),
    })),
  };
};

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

const checkShipCollision = (state: AsteroidsState): AsteroidsState => {
  const { asteroids, level, ship } = state;

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
          entities: [createShip()],
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

const checkLaserCollision = (state: AsteroidsState): AsteroidsState => {
  const { asteroids, level, ship } = state;

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

const moveLasers = ({ ship, ...state }: AsteroidsState): AsteroidsState => {
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

const moveAsteroids = (state: AsteroidsState): AsteroidsState => {
  const { asteroids } = state;

  const moveAsteroid = (asteroid: Asteroid): Asteroid => {
    const { radius, x, y } = asteroid;
    // const { radius, xVelocity, yVelocity } = asteroid;

    // const x = asteroid.x + xVelocity;
    // const y = asteroid.y + yVelocity;

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

const checkLevelCompleted = (state: AsteroidsState): AsteroidsState => {
  const level = state.level + 1;
  return state.asteroids.length
    ? state
    : {
        ...state,
        asteroids: createAsteroidBelt(level, state.ship),
        level,
      };
};

const gameOverDrawers = (state: AsteroidsState): AsteroidsState => {
  return {
    ...state,
    drawers: [drawExplosions, drawGameOver],
  };
};

const setEntities = (state: AsteroidsState): AsteroidsState => {
  return {
    ...state,
    entities: [...state.asteroids, state.ship],
  };
};

const gameLoop = (state: AsteroidsState): AsteroidsState => {
  const newState = (isGameOver(state)
    ? [animateExplosions, gameOverDrawers]
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

  return setEntities(newState);
};

const reducer: GameReducer = (gameState, action) => {
  const state = gameState as AsteroidsState;
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

const keyHandlers: KeyHandlers = (dispatch) => {
  const keyDown = (e: KeyboardEvent) => {
    if (e.keyCode === 37) dispatch(GameActions.rotateLeft);
    else if (e.keyCode === 38) dispatch(GameActions.thrustOn);
    else if (e.keyCode === 39) dispatch(GameActions.rotateRight);
    else if (e.keyCode === 32) dispatch(GameActions.shootLaser);
  };

  const keyUp = (e: KeyboardEvent) => {
    if (e.keyCode === 37 || e.keyCode === 39) dispatch(GameActions.rotateStop);
    else if (e.keyCode === 38) dispatch(GameActions.thrustStop);
    else if (e.keyCode === 32) dispatch(GameActions.enableLaser);
  };
  return { keyDown, keyUp };
};

const ScoreBoard = () => {
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

const Controls = () => {
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

const Theme: React.FC = (props) => {
  React.useEffect(() => {
    const { style } = document.body;
    style.backgroundColor = "#282c34";
    style.color = "white";
  });
  return <Fragment>{props.children}</Fragment>;
};

const createAsteroidsState = (): AsteroidsState => {
  const level = 1;
  const ship = createShip();
  return {
    score: 0,
    lives: 3,
    level,
    asteroids: createAsteroidBelt(level, ship),
    explosions: [],
    drawers: [drawLasers, drawExplosions],
    renders: [drawShip(SHOW_BOUNDING)],
    systems: [applyVelocity],
    ship,
    entities: [],
  };
};

export const App = () => (
  <Theme>
    <GameStateProvider reducer={reducer} state={createAsteroidsState()}>
      <Container style={{ textAlign: "center" }} fluid>
        <h3 className="m-3">Asteroids</h3>
        <Row>
          <Col>
            <ScoreBoard />
          </Col>
          <Col>
            <GameBoard
              width={CANVAS.width}
              height={CANVAS.height}
              keyHandlers={keyHandlers}
              style={{ backgroundColor: "black" }}
            />
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
