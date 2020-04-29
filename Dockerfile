FROM node:12-alpine

WORKDIR /app
COPY . /app

ENV NODE_ENV=production

RUN npm install
CMD npm run start