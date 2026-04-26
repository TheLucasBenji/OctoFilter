# Optimización de Filtros de Imagen con OOA

## Sobre el Proyecto

Este repositorio contiene la implementación en Python del algoritmo **Octopus Optimization Algorithm (OOA)**, desarrollado como parte de un proyecto de tesis universitaria. 

El objetivo principal de esta investigación y desarrollo es explorar el uso de algoritmos de **Inteligencia de Enjambre (*Swarm Intelligence*)** y metaheurísticas inspiradas en la naturaleza —específicamente el comportamiento inteligente de forrajeo de los pulpos— para la optimización automática de parámetros en filtros digitales de imágenes (como el filtro Bilateral y la Difusión Anisotrópica). El sistema busca restaurar imágenes degradadas con ruido, ajustando dinámicamente los parámetros para minimizar el Error Cuadrático Medio (MSE) y maximizar la Relación Señal-Ruido (SNR).

Este trabajo representa una adaptación y un *port* a Python orientado al procesamiento de imágenes, basado en el código matemático original.

**Referencia**: [Repositorio original de MOOA/OOA](https://github.com/meijiasong/MOOA) *(Ajustar enlace si es necesario)*  
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
```

### Opciones de línea de comandos

El script expone múltiples argumentos para afinar la experimentación:

- `image` *(posicional)*: Ruta de la imagen original a procesar (obligatorio).
- `--filter`: Filtro a optimizar. Opciones válidas: `bilateral`, `anisotropic` (por defecto: `bilateral`).
- `--noise-sigma`: Nivel (desviación estándar) del ruido Gaussiano sintético que se inyectará a la imagen (por defecto: `25.0`).
- `--population`: Tamaño de la población (número de agentes/pulpos) para el OOA (por defecto: `30`).
- `--iterations`: Número máximo de iteraciones del algoritmo (por defecto: `50`).
- `--seed`: Semilla aleatoria (entero) para asegurar la reproducibilidad de los resultados experimentales.

**Ejemplo de ejecución con parámetros personalizados:**
```bash
python main.py woody.png --filter anisotropic --noise-sigma 30 --population 40 --iterations 50
```