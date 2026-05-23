# Octopus — Optimización de Filtros de Imagen

Este repositorio contiene una implementación en Python del **Octopus Optimization
Algorithm (OOA)** aplicada a la optimización automática de parámetros de filtros
de imagen. El proyecto ha evolucionado desde una herramienta CLI hacia una
aplicación full-stack con API y una interfaz web interactiva.

**Referencias**: [Repositorio original de OOA](https://github.com/Chrisong-gh/MOOA)

---

## Qué hay de nuevo

- Interfaz web (frontend) desarrollada con React + Vite en `frontend/`.
- API backend con `FastAPI` en `backend/main.py` que expone endpoints para
  previsualizar ruido y lanzar optimizaciones.
- Script `run.sh` para arrancar backend y frontend simultáneamente.
- Documentación legacy del CLI movida a [backend/README.md](backend/README.md).

## Inicio rápido

La forma más sencilla de levantar la aplicación (backend + frontend) es usar
el script de conveniencia:

```bash
./run.sh
```

El script instalará dependencias frontend si es necesario y arrancará:

- UI: http://localhost:5173
- API (docs): http://localhost:8000/docs

Si prefieres hacerlo manualmente:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Backend (FastAPI)
uvicorn backend.main:app --port 8000 --reload

# Frontend (en otra terminal)
cd frontend
npm install
npm run dev
```

## Estructura principal

- `backend/` — API FastAPI, filtros y lógica de optimización.
- `frontend/` — Interfaz web en React + Vite.
- `filters/`, `imaging/`, `ooa/`, `visualization/` — módulos de procesamiento.
- `requirements.txt` — dependencias de Python.
- `run.sh` — script para arrancar backend y frontend.

## API relevante

El backend expone varios endpoints (ver documentación automática):

- `GET /api/filters` — lista filtros y parámetros.
- `POST /api/preview-noise` — genera una imagen con ruido de ejemplo.
- `POST /api/optimize` — inicia una optimización (retorna `job_id`).
- `GET /api/optimize/{job_id}/stream` — stream SSE con progreso y resultado.
