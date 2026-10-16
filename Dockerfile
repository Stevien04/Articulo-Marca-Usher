FROM node:18-alpine

# Crear directorio de trabajo
WORKDIR /usr/src/app

# Copiar archivos de dependencias
COPY app/package*.json ./

# Instalar dependencias
RUN npm ci --omit=dev

# Crear directorio de datos
RUN mkdir -p data

# Copiar código fuente
COPY app/ .

# Exponer puerto
EXPOSE 3000

# Usuario no-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /usr/src/app/data
USER appuser

# Comando de inicio
CMD ["node", "server.js"]
