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

const CANVAS = {
  width: 700,
  height: 500,
};

const FPS = 60;
const SHIP_SIZE = 30;
const TURN_SPEED = 360; // deg per second
const SHIP_THRUST = 5; // acceleration of the ship in pixels per sec per sec
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

const drawShip = (ctx: CanvasRenderingContext2D, {x, y, angle, ...ship}: Ship, color = "white") => {
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

const GameContext = React.createContext(createGameState());

const GameStateProvider: React.FC = (props) => {
  const [state] = React.useState(createGameState());
  return (
    <GameContext.Provider value={state}>{props.children}</GameContext.Provider>
  );
};

const GameBoard = () => {
  const { width, height } = CANVAS;
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const state = React.useContext(GameContext);

  React.useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) drawShip(ctx, state.ship);
  }, [canvasRef, state]);

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
            <GameBoard></GameBoard>
          </Col>
        </Row>
      </Container>
    </GameStateProvider>
  </Theme>
);

ReactDOM.render(<App />, document.querySelector("#root"));
