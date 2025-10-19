# Base image with Node
FROM node:18-bullseye-slim

# Install LibreOffice and fonts
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
      libreoffice \
      libreoffice-writer \
      libreoffice-draw \
      fonts-dejavu \
      fonts-noto \
      fontconfig \
      ca-certificates \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# copy package.json & install
COPY package.json /app/package.json
RUN npm install --omit=dev

# copy server code
COPY server.js /app/server.js

ENV PORT=8080

EXPOSE 8080

CMD ["node", "server.js"]
