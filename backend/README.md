# Legacy: CLI de Optimización (backend)

Este README contiene la documentación heredada del CLI para ejecutar la
optimización de filtros desde la terminal. El proyecto ahora incluye una API
FastAPI y una interfaz web; esta documentación se mantiene por compatibilidad.

## Requisitos

- Python 3.8+ (se recomienda 3.10+)
- Dependencias listadas en `requirements.txt`.

Instalación rápida:

```bash
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
```

## Uso (CLI legacy)

El script CLI heredado está en `backend/cli_legacy.py`.

```bash
# Ejecutar la optimización desde la terminal
python backend/cli_legacy.py <ruta_a_imagen.png>

# Ejemplo básico
python backend/cli_legacy.py cere.png --filter bilateral --metric mse --population 30 --iterations 30 --seed 42
```

### Opciones principales

- `image` (posicional): Ruta de la imagen de entrada.
- `--filter`: `bilateral`, `anisotropic`, `nlmeans` (default: `bilateral`).
- `--metric`: `mse`, `snr`, `piqe` (default: `mse`).
- `--noise-type`: `gaussian` o `sp` (sal y pimienta) (default: `gaussian`).
- `--noise-sigma`: Desviación estándar para ruido gaussiano (default: `25.0`).
- `--noise-amount`: Proporción para ruido sal y pimienta (default: `0.05`).
- `--population`: Tamaño de la población OOA (default: `30`).
- `--iterations`: Iteraciones máximas OOA (default: `50`).
- `--seed`: Semilla para reproducibilidad.

### Ejemplos

```bash
# Filtro Bilateral
python backend/cli_legacy.py cere.png --filter bilateral --metric mse --population 30 --iterations 30 --seed 42

# Difusión Anisotrópica
python backend/cli_legacy.py cere.png --filter anisotropic --metric snr --population 40 --iterations 30 --seed 42

# Non-Local Means
python backend/cli_legacy.py cere.png --filter nlmeans --metric piqe --population 40 --iterations 30 --seed 42

# Salt & Pepper
python backend/cli_legacy.py cere.png --filter anisotropic --noise-type sp --noise-amount 0.05 --metric snr
```

## Notas

- El código original del CLI imprime progreso por iteración y muestra resultados
  mediante `visualization/display.py`.
- Para integraciones modernas use la API FastAPI ubicada en `backend/main.py`.
