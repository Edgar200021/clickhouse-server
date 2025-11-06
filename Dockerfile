FROM node:22-alpine as development

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

#RUN npm run build

RUN npm install -g concurrently
CMD ["concurrently", "npm run migration:run", "npm run start:dev" ]

FROM node:22-alpine as production

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=development /app/dist ./dist

CMD [ "npm", "run", "start:prod" ]

FROM node:22-alpine as testing

WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .

CMD [ "npm", "run", "vitest" ]