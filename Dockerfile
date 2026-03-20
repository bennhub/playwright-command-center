FROM mcr.microsoft.com/playwright:v1.58.2-noble

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=production
ENV LAUNCHER_HOST=0.0.0.0
ENV LAUNCHER_PORT=4173

EXPOSE 4173

CMD ["npm", "start"]
