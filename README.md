# Octopus — Optimización de Filtros de Imagen

Este repositorio contiene una implementación en Python del **Octopus Optimization
Algorithm (OOA)** aplicada a la optimización automática de parámetros de filtros
de imagen. El proyecto ha evolucionado desde una herramienta CLI hacia una
aplicación full-stack con API y una interfaz web interactiva. Además del OOA,
la app incluye el **Starfish Optimization Algorithm (SFOA)** como algoritmo
alternativo seleccionable desde la interfaz.

**Referencias**:
- [Repositorio original de OOA](https://github.com/Chrisong-gh/MOOA)
- [Repositorio original de SFOA (MATLAB)](https://es.mathworks.com/matlabcentral/fileexchange/173735-starfish-optimization-algorithm-sfoa)

---

- Interfaz web (frontend) desarrollada con React + Vite en `frontend/`.
- API backend con `FastAPI` en `backend/main.py` que expone endpoints para
  previsualizar ruido y lanzar optimizaciones.
- Selección de algoritmo desde la UI: **OOA** (Octopus) o **SFOA** (Starfish).
- Script `run.sh` para arrancar backend y frontend simultáneamente.
- Documentación legacy del CLI movida a [backend/README.md](backend/README.md).

## Inicio

Descargar bibliotecas python (solo 1 vez)
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```
La forma más sencilla de levantar la aplicación (backend + frontend) es usar
el script de conveniencia:

```bash
./run.sh
```

El script instalará dependencias frontend si es necesario y arrancará:

- UI: http://localhost:5173
- API (docs): http://localhost:8000/docs

### Acceso

La aplicación usa autenticación con SQLite. Al iniciar el backend se crea
automáticamente la base `backend/data/octopus.sqlite3` y el usuario de prueba si
no existe:

- Email: `test@mail.com`
- Password: `Test2026`

La ruta de la base se puede cambiar con `OCTOPUS_DB_PATH`:

```bash
OCTOPUS_DB_PATH=/tmp/octopus.sqlite3 ./run.sh
```

Si prefieres hacerlo manualmente:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Backend (FastAPI)
uvicorn backend.main:app --port 8000 --reload

# Frontend (en otra terminal)
cd frontend
pnpm install 
npm run dev
```

## Estructura principal

- `backend/` — API FastAPI, filtros y lógica de optimización.
- `frontend/` — Interfaz web en React + Vite.
- `filters/`, `imaging/`, `ooa/`, `sfoa/`, `visualization/` — módulos de procesamiento.
- `requirements.txt` — dependencias de Python.
- `run.sh` — script para arrancar backend y frontend.

## Inspección de la base local

```bash
# Ver tablas
sqlite3 backend/data/octopus.sqlite3 ".tables"

# Ver schema de usuarios
sqlite3 backend/data/octopus.sqlite3 ".schema users"

# Listar usuarios sin exponer hashes completos en la UI
sqlite3 -header -column backend/data/octopus.sqlite3 \
  "select id,email,created_at,updated_at from users;"

# Ver sesiones
sqlite3 -header -column backend/data/octopus.sqlite3 \
  "select id,user_id,created_at,expires_at,revoked_at from sessions;"

# Ver hashes de password guardados
sqlite3 -header -column backend/data/octopus.sqlite3 \
  "select id,email,password_hash from users;"
```

Para resetear el entorno local, detén el servidor, borra
`backend/data/octopus.sqlite3` y vuelve a ejecutar `./run.sh`.

## API relevante

El backend expone varios endpoints (ver documentación automática):

- `POST /api/auth/login` — inicia sesión y crea cookie HTTP-only.
- `GET /api/auth/me` — devuelve el usuario autenticado.
- `POST /api/auth/logout` — revoca la sesión actual.
- `GET /api/filters` — lista filtros y parámetros.
- `POST /api/preview-noise` — genera una imagen con ruido de ejemplo.
- `POST /api/optimize` — inicia una optimización (retorna `job_id`). Acepta el parámetro `algorithm`: `ooa` (default) o `sfoa`.
- `GET /api/optimize/{job_id}/stream` — stream SSE con progreso y resultado.
