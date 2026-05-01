FROM node:22-alpine
WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
COPY src ./src
RUN mkdir -p data
EXPOSE 8787
CMD ["node", "--enable-source-maps", "src/index.js"]
