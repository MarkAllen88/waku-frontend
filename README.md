# waku-frontend
Waku's frontend. Interact with your waku node via this simple user interface

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## To run independently

```bash
npm run build
npm run serve
```

## To run in docker

```bash
npm run build
docker build -t waku_frontend .
docker run -d -p 8080:80 waku_frontend
```
