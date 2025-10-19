# Node + LibreOffice olan baza
FROM node:18-bullseye-slim

# LibreOffice və fontlar
RUN apt-get update && \
    apt-get install -y libreoffice libreoffice-writer libreoffice-draw \
                       fonts-dejavu fonts-noto && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json /app/package.json
RUN npm install --omit=dev

COPY server.js /app/server.js

ENV PORT=8080
EXPOSE 8080
CMD ["npm", "start"]
