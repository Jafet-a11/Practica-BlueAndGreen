
set -e # Termina el script si un comando falla

echo "Iniciando despliegue Blue-Green con 'envsubst'..."

export SERVER_NAME="64.23.179.0"
# -------------------------

# Rutas de los archivos
CONFIG_FILE="/etc/nginx/conf.d/proxy.conf"
TEMPLATE_FILE="/etc/nginx/templates/proxy.conf.template"

# 1. Detectar el entorno ACTIVO
if [ ! -f $CONFIG_FILE ]; then
    echo "No se encontró $CONFIG_FILE. Asumiendo despliegue inicial a BLUE (8082)."
    # Forzamos que el INACTIVO sea BLUE
    ACTIVE_PORT="8083"
elif grep -q "8082" $CONFIG_FILE; then
    ACTIVE_PORT="8082"
    ACTIVE_ENV="blue"
else
    ACTIVE_PORT="8083"
    ACTIVE_ENV="green"
fi

# 2. Decidir el entorno INACTIVO y exportar la variable BASE_HOST
if [ "$ACTIVE_PORT" == "8082" ]; then
    INACTIVE_ENV="green"
    INACTIVE_PORT="8083"
    export BASE_HOST="http://127.0.0.1:8083"
else
    INACTIVE_ENV="blue"
    INACTIVE_PORT="8082"
    export BASE_HOST="http://127.0.0.1:8082"
fi

echo "-----------------------------------"
echo "Entorno ACTIVO detectado: $ACTIVE_ENV (Puerto: $ACTIVE_PORT)"
echo "Desplegando en INACTIVO: $INACTIVE_ENV (Puerto: $INACTIVE_PORT)"
echo "-----------------------------------"

# 3. Construir y lanzar el entorno INACTIVO
echo "Construyendo y levantando el contenedor '$INACTIVE_ENV'..."
# 'cd ..' para estar en la raíz del proyecto donde está docker-compose.yml
cd ..
docker compose up -d --build --no-deps $INACTIVE_ENV

# Regresar a la carpeta de scripts
cd scripts

# 4. Prueba de Humo (Smoke Test)
echo "Esperando 10s para que el contenedor inicie..."
sleep 10
echo "Ejecutando prueba de humo en $BASE_HOST"
curl -fsL $BASE_HOST > /dev/null
if [ $? -ne 0 ]; then
    echo "¡Prueba de humo FALLIDA! ❌ El contenedor '$INACTIVE_ENV' no responde."
    docker compose logs $INACTIVE_ENV
    echo "CANCELANDO DESPLIEGUE."
    exit 1
else
    echo "Prueba de humo EXITOSA. 👍"
fi

# 5. El "Switch": Usar envsubst para regenerar el config [cite: 44]
echo "Regenerando $CONFIG_FILE para apuntar a $BASE_HOST"
# Usamos la sintaxis '${VAR}' para solo reemplazar esas variables [cite: 43]
envsubst '${SERVER_NAME},${BASE_HOST}' < $TEMPLATE_FILE | sudo tee $CONFIG_FILE

# 6. Recargar Nginx
sudo systemctl reload nginx

echo "-----------------------------------"
echo "¡DESPLIEGUE COMPLETADO! 🚀"
echo "'$INACTIVE_ENV' (en $BASE_HOST) está ahora ACTIVO."
echo "-----------------------------------"

# 7. Detener el entorno antiguo
if [ -n "$ACTIVE_ENV" ]; then
    echo "Deteniendo el entorno antiguo '$ACTIVE_ENV'..."
    cd .. # Ir a la raíz del proyecto
    docker compose stop $ACTIVE_ENV
fi

exit 0
