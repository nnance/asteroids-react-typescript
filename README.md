# asteroids-react-typescript

Simple Atari Asteroids implemented in React and TypeScript.

## Getting Started

The following steps are how to build and run the development server.

## References

### Drawing with Polygons
* https://www.arungudelli.com/html5/html5-canvas-polygon/
* https://github.com/maxwihlborg/youtube-tutorials/blob/master/asteroids/js/points.js
* https://www.khanacademy.org/math/basic-geo/basic-geo-coord-plane/polygons-in-the-coordinate-plane/e/drawing-polygons

### Building the repo

```
npm run build
```

### Running the development server
To run the development mode in live reload.
```
npm run start
```

## Project Setup
Below are instructions on how to setup a similar project.

### Initialize the project
```
mkdir my-react-app && cd my-react-app
git init && npm init -y
```
### configure gitignore
```
printf "/node_modules\n/dist\n" > .gitignore
```
### Install dev dependencies
This project only uses npm for development dependencies
```
npm i -D  @types/react @types/react-dom react react-dom typescript parcel-bundler react-bootstrap bootstrap @types/react-bootstrap eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser prettier eslint-plugin-prettier
```
### Initialize TypeScript
```
./node_modules/.bin/tsc --init --jsx react --sourceMap --esModuleInterop --lib es6,dom
```
### Add the following commands to package.json
```json
"start": "parcel index.html",
"build": "parcel build index.html"
```
### Happy coding
See the Getting Started section to start the project in development mode.