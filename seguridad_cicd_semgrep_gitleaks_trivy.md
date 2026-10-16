# Seguridad automatizada en la nube: integración de Semgrep, Gitleaks y Trivy en un pipeline CI/CD

**Por: Stevie Gerald Marca Aguilar y Usher Damiron Halanocca Rojas**

Publicar una aplicación implica más que comprobar que sus funcionalidades respondan correctamente. También debemos revisar si existen credenciales expuestas, instrucciones inseguras o dependencias con vulnerabilidades conocidas.

Durante nuestro proyecto, integramos **Semgrep, Gitleaks y Trivy en un pipeline de GitHub Actions**, conectado al despliegue de una aplicación en Render. El propósito fue establecer una revisión automática de seguridad antes de autorizar la publicación de una nueva versión.

En este artículo explico cómo organizamos la solución, qué función cumple cada herramienta y qué aprendimos al analizar una aplicación con vulnerabilidades incorporadas intencionalmente.

## ¿Por qué incorporar seguridad al pipeline?

Durante el desarrollo pueden aparecer problemas que pasan desapercibidos en una revisión funcional. Por ejemplo, una aplicación puede permitir iniciar sesión correctamente y, al mismo tiempo, construir consultas SQL mediante concatenación o tener una clave privada escrita en sus archivos.

Entre los riesgos que consideramos estuvieron:

- Credenciales y tokens almacenados directamente en el repositorio.
- Dependencias con vulnerabilidades publicadas.
- Consultas SQL construidas con datos ingresados por el usuario.
- Ejecución de código mediante funciones inseguras.
- Registro de información sensible en los mensajes de la aplicación.

Revisar estos aspectos manualmente en cada cambio requiere tiempo y puede producir omisiones. Por ello, incorporamos herramientas que ejecutan controles de forma automática y entregan resultados para su revisión.

## Las herramientas utilizadas

Seleccionamos tres herramientas de código abierto que cubren aspectos diferentes del proyecto.

| Herramienta | Tipo de análisis | Propósito en el proyecto |
|---|---|---|
| Semgrep | Análisis estático de código, SAST | Identificar patrones de programación potencialmente inseguros. |
| Gitleaks | Detección de secretos | Buscar credenciales y otros datos sensibles en el repositorio. |
| Trivy | Análisis de dependencias y configuración | Identificar vulnerabilidades conocidas y configuraciones inseguras. |

### Semgrep: revisión del código fuente

Semgrep analiza el código mediante reglas que describen patrones que queremos identificar. En nuestro caso, lo utilizamos para revisar una aplicación desarrollada con Node.js y Express.

El análisis se orientó a encontrar construcciones como consultas SQL inseguras, uso de `eval()` y otras prácticas que pueden comprometer la aplicación.

Su utilidad depende de las reglas seleccionadas y del contexto del código. Por eso, los resultados necesitan una revisión para determinar cuáles representan problemas reales.

### Gitleaks: búsqueda de credenciales expuestas

Gitleaks permite detectar posibles secretos, como tokens, claves de acceso y credenciales incluidas en archivos versionados.

En el proyecto lo empleamos para revisar el repositorio y su historial disponible. Esto es relevante porque eliminar una contraseña del archivo actual no significa que desaparezca de los commits anteriores.

La detección tampoco debe considerarse infalible: algunas credenciales requieren reglas específicas y ciertos ejemplos pueden generar alertas que necesitan revisión.

### Trivy: revisión de dependencias y configuraciones

Trivy permite analizar distintas partes de una aplicación, entre ellas sus dependencias, imágenes de contenedores y archivos de configuración compatibles.

En nuestra implementación lo utilizamos principalmente para identificar vulnerabilidades conocidas en las bibliotecas del proyecto. También exploramos el análisis de configuraciones, como las incluidas en un Dockerfile.

Sus reportes ayudan a reconocer qué componente está afectado y, cuando existe información disponible, qué versión incorpora una corrección.

## La aplicación de demostración

Para evaluar las herramientas desarrollamos una API REST con Node.js y Express. La aplicación incluía funciones de autenticación, administración de usuarios y búsqueda.

Incorporamos errores de seguridad de manera intencional para observar el comportamiento de los escáneres.

Uno de los casos consistió en declarar un secreto directamente en el código:

```javascript
const JWT_SECRET = 'clave_de_prueba_insegura';
```

También incluimos una consulta SQL construida con datos del usuario:

```javascript
const query =
  `SELECT * FROM users WHERE username = '${username}'`;
```

Otro ejemplo fue la ejecución dinámica de una transformación:

```javascript
const fn = eval(`(${transform})`);
```

Finalmente, agregamos registros que exponían contraseñas y versiones antiguas de algunas dependencias.

Estos casos permitieron comparar los distintos enfoques de análisis. Cada herramienta revisó una parte diferente del problema.

## Ejecución de los análisis

Antes de configurar la automatización, ejecutamos las herramientas localmente para comprender sus resultados.

### Análisis con Semgrep

Utilizamos conjuntos de reglas relacionados con Node.js, JavaScript y riesgos de seguridad web:

```bash
pip install semgrep

semgrep --config "p/nodejs" \
        --config "p/javascript" \
        --config "p/owasp-top-ten" \
        app/
```

La revisión permitió identificar patrones que debían evaluarse y corregirse dentro de la aplicación.

### Análisis con Gitleaks

En la implementación descrita utilizamos el siguiente comando:

```bash
gitleaks detect --source . -v
```

El objetivo fue buscar posibles credenciales expuestas en el repositorio. El alcance efectivo de la revisión depende del historial disponible y de la configuración del escaneo.

### Análisis con Trivy

Para revisar las dependencias ejecutamos:

```bash
trivy fs ./app
```

También realizamos un análisis de configuración:

```bash
trivy config .
```

Estos resultados permitieron identificar componentes y configuraciones que requerían atención.

## Correcciones realizadas

Después de revisar los hallazgos, aplicamos cambios en el código y en la gestión de dependencias.

### 1. Uso de variables de entorno

Reemplazamos los secretos escritos directamente en los archivos por valores obtenidos desde el entorno:

```javascript
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('La variable JWT_SECRET no está configurada');
}
```

Esto permite configurar la credencial sin incluirla en el código fuente. Si una credencial real ya fue expuesta, también debe revocarse o reemplazarse; retirarla del archivo no resuelve por sí solo la exposición anterior.

### 2. Consultas parametrizadas

Sustituimos la concatenación de datos por parámetros:

```javascript
const query = 'SELECT * FROM users WHERE username = ?';

db.get(query, [username], callback);
```

Así, el valor ingresado se proporciona por separado de la estructura de la consulta.

### 3. Sustitución de `eval()`

Reemplazamos la ejecución dinámica por un conjunto definido de operaciones permitidas:

```javascript
const TRANSFORMS = {
  uppercase: (user) => ({
    ...user,
    username: user.username.toUpperCase()
  })
};

const fn = TRANSFORMS[transform];

if (!fn) {
  throw new Error('Transformación no permitida');
}
```

De esta manera, la aplicación selecciona una operación previamente implementada.

### 4. Actualización de dependencias

Revisamos las bibliotecas señaladas por Trivy y actualizamos las versiones correspondientes. Después repetimos los análisis para comprobar el efecto de las correcciones.

## Resultados de la experiencia

Los resultados reportados en el proyecto mostraron una reducción de los hallazgos después de aplicar los cambios.

| Herramienta | Resultado inicial reportado | Resultado posterior reportado |
|---|---|---|
| Semgrep | 9 hallazgos | 1 hallazgo, considerado falso positivo tras su revisión. |
| Gitleaks | 3 posibles secretos | 0 hallazgos en la revisión posterior. |
| Trivy | 4 vulnerabilidades | 0 vulnerabilidades críticas reportadas. |

En Trivy, **no encontrar vulnerabilidades críticas no equivale a no tener vulnerabilidades de otras severidades**. La interpretación del resultado debe considerar los filtros utilizados.

Asimismo, la ausencia de alertas en cualquiera de las herramientas no garantiza que la aplicación esté libre de problemas de seguridad.

## Integración con GitHub Actions

Una vez realizadas las pruebas locales, incorporamos los análisis al flujo automatizado del repositorio.

El pipeline se configuró para ejecutarse con los cambios enviados a la rama `main`. Organizamos el proceso en cuatro trabajos:

1. Análisis estático con Semgrep.
2. Detección de secretos con Gitleaks.
3. Revisión de dependencias con Trivy.
4. Solicitud de despliegue a Render.

La dependencia del trabajo de despliegue se expresó de esta forma:

```yaml
deploy:
  needs: [semgrep, gitleaks, trivy]
```

Esto hace que ese trabajo espere la finalización satisfactoria de los tres análisis.

Para disponer del historial completo durante la revisión del repositorio, utilizamos:

```yaml
with:
  fetch-depth: 0
```

En el análisis de Trivy configuramos el bloqueo ante vulnerabilidades críticas:

```yaml
severity: 'CRITICAL'
exit-code: '1'
```

Por tanto, el criterio de aprobación de este análisis estuvo limitado a dicha severidad. Los hallazgos de niveles inferiores requieren una política adicional si también se desea bloquear el despliegue por ellos.

## Despliegue de la aplicación en Render

Utilizamos Render como plataforma de despliegue de la API. La configuración del servicio definió el directorio de la aplicación, los comandos de instalación y ejecución, y la ruta de comprobación de salud.

```yaml
services:
  - type: web
    name: vulnerable-demo-api
    runtime: node
    rootDir: app
    buildCommand: npm install
    startCommand: node server.js
    healthCheckPath: /health
    envVars:
      - key: JWT_SECRET
        sync: false
```

La solicitud de despliegue se realizó mediante un webhook cuya dirección se almacenó en GitHub Secrets como `RENDER_DEPLOY_HOOK_URL`.

El flujo planteado fue que GitHub Actions solicitara la publicación después de aprobar los controles. Para que esta condición se cumpla en toda la solución, la configuración de Render también debe evitar despliegues automáticos que omitan ese flujo.

## Aprendizajes del proyecto

**Integrar seguridad desde el desarrollo facilita detectar problemas antes de publicar.** Los análisis automáticos aportan una revisión repetible en cada ejecución del pipeline.

**Las herramientas se complementan.** Semgrep revisa patrones del código, Gitleaks busca posibles secretos y Trivy analiza componentes y configuraciones compatibles.

**Los reportes necesitan interpretación.** Una alerta debe revisarse considerando el contexto, mientras que un análisis aprobado debe entenderse según sus reglas, filtros y alcance.

**La gestión de secretos requiere más que eliminarlos del código.** También es necesario proteger su almacenamiento y reemplazar cualquier credencial real que haya quedado expuesta.

**Mantener las dependencias actualizadas es una tarea continua.** Una versión sin alertas hoy puede presentar vulnerabilidades conocidas posteriormente.

Este proyecto nos permitió incorporar controles de seguridad al proceso de entrega de software y comprender cómo conectarlos con un despliegue en la nube. Además de ejecutar herramientas, aprendimos a revisar sus resultados y a definir qué condiciones deben cumplirse antes de publicar una nueva versión.
