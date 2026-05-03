# Optimización de Filtros de Imagen con OOA

## Sobre el Proyecto

Este repositorio contiene la implementación en Python del algoritmo **Octopus Optimization Algorithm (OOA)**, desarrollado como parte de un proyecto de tesis universitaria. 

El objetivo principal de esta investigación y desarrollo es explorar el uso de algoritmos de **Inteligencia de Enjambre (*Swarm Intelligence*)** y metaheurísticas inspiradas en la naturaleza específicamente el comportamiento inteligente de forrajeo de los pulpos para la optimización automática de parámetros en filtros digitales de imágenes (como el filtro Bilateral, la Difusión Anisotrópica y Non-Local Means). El sistema busca restaurar imágenes degradadas con ruido, ajustando dinámicamente los parámetros para minimizar el Error Cuadrático Medio (MSE), maximizar la Relación Señal-Ruido (SNR) o minimizar el PIQE (Perception-based Image Quality Evaluator), una métrica perceptual no-referencia.

Este trabajo representa una adaptación y un *port* a Python orientado al procesamiento de imágenes, basado en el código matemático original.

**Referencia**: [Repositorio original de OOA](https://github.com/Chrisong-gh/MOOA)
**Paper Base**: *Octopus optimization algorithm: A novel single- and multi-objective optimization algorithm for optimization problems* (Song, M., et al., 2025).

---

## Instalación y Uso

### 1. Preparar el entorno virtual

Para aislar las dependencias del proyecto, es altamente recomendable utilizar un entorno virtual de Python. Desde tu terminal, en la raíz del proyecto, ejecuta:

```bash
# Crear entorno virtual
python3 -m venv venv

# Activar el entorno virtual (Mac/Linux)
source venv/bin/activate

# En Windows: venv\Scripts\activate

# Instalar las dependencias requeridas
pip install -r requirements.txt
```

### 2. Ejecutar la optimización

La herramienta de optimización se lanza a través del script `main.py`. Solo necesitas indicar la ruta de la imagen que deseas procesar.

```bash
# Ejecutar optimización con el filtro bilateral (comportamiento por defecto)
python main.py cere.png

# Ejecutar optimización con el filtro de difusión anisotrópica
python main.py cere.png --filter anisotropic

# Ejecutar optimización con el filtro Non-Local Means
python main.py cere.png --filter nlmeans
```

### Opciones de línea de comandos

El script expone múltiples argumentos para afinar la experimentación:

- `image` *(posicional)*: Ruta de la imagen original a procesar (obligatorio).
- `--filter`: Filtro a optimizar. Opciones válidas: `bilateral`, `anisotropic`, `nlmeans` (por defecto: `bilateral`).
- `--metric`: Métrica objetivo para guiar la optimización. Opciones válidas: `mse` (minimiza el Error Cuadrático Medio), `snr` (maximiza la Relación Señal-Ruido), `piqe` (minimiza PIQE, métrica perceptual no-referencia) (por defecto: `mse`).
- `--noise-sigma`: Nivel (desviación estándar) del ruido Gaussiano sintético que se inyectará a la imagen (por defecto: `25.0`).
- `--population`: Tamaño de la población (número de agentes/pulpos) para el OOA (por defecto: `30`).
- `--iterations`: Número máximo de iteraciones del algoritmo (por defecto: `50`).
- `--seed`: Semilla aleatoria (entero) para asegurar la reproducibilidad de los resultados experimentales.

**Ejemplos por filtro y métrica:**
```bash
# Filtro Bilateral
python main.py cere.png --filter bilateral --metric mse --population 30 --iterations 30 --seed 42
python main.py cere.png --filter bilateral --metric snr --population 30 --iterations 30 --seed 42
python main.py cere.png --filter bilateral --metric piqe --population 30 --iterations 30 --seed 42

# Difusión Anisotrópica (Perona-Malik)
python main.py cere.png --filter anisotropic --metric mse --population 40 --iterations 30 --seed 42
python main.py cere.png --filter anisotropic --metric snr --population 40 --iterations 30 --seed 42
python main.py cere.png --filter anisotropic --metric piqe --population 40 --iterations 30 --seed 42

# Non-Local Means
python main.py cere.png --filter nlmeans --metric mse --population 40 --iterations 30 --seed 42
python main.py cere.png --filter nlmeans --metric snr --population 40 --iterations 30 --seed 42
python main.py cere.png --filter nlmeans --metric piqe --population 40 --iterations 30 --seed 42
```