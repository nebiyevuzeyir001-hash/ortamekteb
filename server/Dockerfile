FROM debian:bookworm-slim

# LibreOffice və Node.js quraşdırırıq
RUN apt-get update && \
    apt-get install -y libreoffice-writer npm nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json /app/package.json
RUN npm install --omit=dev

COPY server.js /app/server.js

EXPOSE 8080
CMD ["npm", "start"]
