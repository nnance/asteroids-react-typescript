import React from "react";
import ReactDOM from "react-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

export const App = () => {
  React.useEffect(() => {
    const { style } = document.body;
    style.backgroundColor = "#282c34";
    style.color = "white";
  });

  return (
    <Container style={{ textAlign: "center" }} fluid>
      <h3 className="m-3">Asteroids</h3>
    </Container>
  );
};

ReactDOM.render(<App />, document.querySelector("#root"));
