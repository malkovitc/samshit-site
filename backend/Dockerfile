# Medusa v2: сборка в .medusa/server, на рантайм идут только продовые зависимости.
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json yarn.lock* .yarnrc.yml ./
COPY .yarn/releases .yarn/releases
RUN yarn install
COPY . .
RUN yarn medusa build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable
COPY --from=build /app/.medusa/server ./
COPY --from=build /app/.yarnrc.yml ./
COPY --from=build /app/yarn.lock ./
COPY --from=build /app/.yarn/releases .yarn/releases
RUN yarn install && yarn cache clean
COPY static ./static-seed
COPY docker-entrypoint.sh /usr/local/bin/
EXPOSE 9000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["yarn", "medusa", "start"]
