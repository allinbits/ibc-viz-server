FROM node:latest
WORKDIR /app
COPY package*.json ./
COPY . .
RUN npm install
EXPOSE 80
CMD npm run start