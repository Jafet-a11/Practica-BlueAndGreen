# 1. Imagen base
FROM node:18-alpine

# 2. Directorio de trabajo
WORKDIR /usr/src/app

# 3. Instalar dependencias
COPY package*.json ./
RUN npm install

# 4. Copiar código de la app
COPY . .

# 5. Crear el directorio de datos y darle permisos
RUN mkdir -p /usr/src/app/data && chown -R node:node /usr/src/app/data

USER node

# 6. Exponer puerto
EXPOSE 3000

# 7. Comando de inicio
CMD [ "node", "index.js" ]
