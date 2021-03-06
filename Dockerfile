# BUILDER
FROM node:14-alpine AS cl-builder
ENV NODE_ENV=development
WORKDIR /app
COPY . .
RUN apk update && apk upgrade && npm install && ./node_modules/.bin/tsc

# DEPENDENCIES
FROM node:14-alpine AS cl-dependencies
ENV NODE_ENV=production
WORKDIR /app
COPY . .
RUN apk update && apk upgrade && npm install --production

# FINAL IMAGE
FROM node:14-alpine AS cl-final
ENV NODE_ENV=production
WORKDIR /app
COPY . .
COPY --from=cl-dependencies ./app/node_modules ./node_modules
COPY --from=cl-builder ./app/lib ./lib

CMD ["npm", "start"]
