# 🔐 Vulnerable Demo API — DevSecOps Pipeline

> **Proyecto académico** que demuestra cómo integrar herramientas de seguridad (SAST, detección de secretos y SCA) en un pipeline CI/CD automatizado.

[![Security Scan](https://github.com/Stevien04/Articulo-Marca-Usher/actions/workflows/security-scan-deploy.yml/badge.svg)](https://github.com/Stevien04/Articulo-Marca-Usher/actions)

---

## 📋 Descripción

API REST en Node.js/Express que contiene **vulnerabilidades intencionales** para demostrar cómo las herramientas de seguridad las detectan automáticamente en un pipeline CI/CD.

## ⚠️ Vulnerabilidades incluidas (intencionales)

| # | Vulnerabilidad | Herramienta que la detecta |
|---|---------------|---------------------------|
| 1 | JWT Secret hardcodeado | Gitleaks |
| 2 | Stripe API Key en código | Gitleaks |
| 3 | AWS Access Key expuesta | Gitleaks |
| 4 | SQL Injection en login | Semgrep |
| 5 | Log de contraseñas | Semgrep |
| 6 | SQL Injection en /users/:id | Semgrep |
| 7 | SQL Injection en búsqueda | Semgrep |
| 8 | Uso de `eval()` con input externo | Semgrep |
| 9 | lodash 4.17.20 (CVE-2021-23337) | Trivy |
| 10 | jsonwebtoken 8.5.1 (CVE-2022-23529) | Trivy |

## 🛠️ Herramientas de seguridad

| Herramienta | Tipo | Propósito |
|-------------|------|-----------|
| **Semgrep** | SAST | Detecta patrones inseguros en el código |
| **Gitleaks** | Secret Detection | Detecta credenciales y tokens en el historial |
| **Trivy** | SCA / IaC | Detecta dependencias con CVEs conocidos |

## 🚀 Pipeline CI/CD

```
Push → Semgrep ──┐
              ├──→ ✅ Deploy (Render)
Push → Gitleaks ─┤
              │
Push → Trivy ───┘
```

El pipeline también ejecuta las pruebas de integración de la API. Semgrep
reporta sus hallazgos sin bloquear; Gitleaks y el control de vulnerabilidades
críticas de Trivy sí pueden impedir el despliegue. Un fallo de seguridad es
posible y esperado en esta demostración con vulnerabilidades intencionales.

El despliegue en este repositorio está conectado a Render mediante GitHub Actions. Para habilitarlo en otra copia,
configura la variable de GitHub Actions `ENABLE_RENDER_DEPLOY=true` y los
secretos de Render indicados abajo. Las pruebas y escaneos funcionan sin Render.

## 📁 Estructura del proyecto

```
devsecops-scan-pipeline/
├── .github/
│   └── workflows/
│       └── security-scan-deploy.yml   # Pipeline CI/CD
├── app/
│   ├── server.js                      # API con vulnerabilidades intencionales
│   ├── db.js                          # Módulo de base de datos
│   ├── package.json                   # Dependencias (con versiones vulnerables)
│   └── .env.example                   # Template de variables de entorno
├── Dockerfile                         # Contenedor Docker
├── render.yaml                        # Configuración de despliegue en Render
└── README.md
```

## 🏃 Ejecución local

```bash
# 1. Clonar el repositorio
git clone https://github.com/Stevien04/Articulo-Marca-Usher.git
cd Articulo-Marca-Usher/app

# 2. Instalar dependencias
npm ci

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores

# 4. Ejecutar
npm start
# → API disponible en http://localhost:3000
```

En Windows (PowerShell), desde la raíz del proyecto:

```powershell
cd app
npm ci
Copy-Item .env.example .env # Solo la primera vez, si no tienes un .env
npm start
```

La aplicación carga `app/.env` y crea automáticamente la carpeta, la base
SQLite y los usuarios de demostración antes de aceptar conexiones.
`DB_PATH` relativo se interpreta desde `app/`. Puedes entrar con
`admin` / `admin123` o `alice` / `password1` mediante `POST /login`.
La raíz muestra la descripción de la API en JSON; no incluye una interfaz gráfica.

Para comprobar el servicio desde otra terminal PowerShell:

```powershell
Invoke-RestMethod http://localhost:3000/health
$login = Invoke-RestMethod http://localhost:3000/login -Method Post -ContentType 'application/json' -Body '{"username":"admin","password":"admin123"}'
Invoke-RestMethod http://localhost:3000/users -Headers @{ Authorization = "Bearer $($login.token)" }
```

Las pruebas de integración usan una base temporal y requieren Node.js 18 o superior:

```powershell
npm test # Desde app/
```

## 🔍 Escanear manualmente

### Semgrep
```bash
pip install semgrep
semgrep --config "p/nodejs" --config "p/owasp-top-ten" app/
```

### Gitleaks
```bash
# macOS
brew install gitleaks

# Windows (via Chocolatey)
choco install gitleaks

# Ejecutar
gitleaks detect --source . -v
```

### Trivy
```bash
# macOS
brew install aquasecurity/trivy/trivy

# Windows (via Chocolatey)
choco install trivy

# Escanear dependencias
trivy fs ./app

# Escanear configuración (Dockerfile, etc.)
trivy config .
```

## ☁️ Despliegue

App desplegada en: **[https://articulo-marca-usher.onrender.com](https://articulo-marca-usher.onrender.com)**

## 🔐 Configurar GitHub Secrets

En `Settings → Secrets and variables → Actions` del repositorio, agregar:

| Secret | Descripción |
|--------|-------------|
| `RENDER_DEPLOY_HOOK_URL` | URL del webhook de Render |
| `APP_URL` | URL pública de la aplicación |

## 👥 Equipo

- Usher Damiron Halanocca Rojas — 2023076795
- Stevie Gerald Marca Aguilar — 2023076802

## 📚 Referencias

- [OWASP Source Code Analysis Tools](https://owasp.org/www-community/Source_Code_Analysis_Tools)
- [NIST Source Code Security Analyzers](https://www.nist.gov/itl/ssd/software-quality-group/source-code-security-analyzers)
- [Semgrep Docs](https://semgrep.dev/docs/)
- [Gitleaks](https://github.com/gitleaks/gitleaks)
- [Trivy Docs](https://aquasecurity.github.io/trivy/)
