Proyecto de Título - Anteproyecto
Desarrollo de software de parametrización de filtros digitales
aplicados sobre imágenes degradadas en condiciones de
laboratorio mediante un método de Swarm Intelligence basado
en Octopus Optimization Algorithm


Nombre de
## Estudiantes:
## Lucas Benjamín Álvarez Alegría
## Nicolás Sebastián Corvalán Neira
Rut de Estudiantes: 21.253.938-4 / 21.201.178-9
Año de Ingreso: 2021
## Carrera:  Ingeniería Civil Informática
## Email Institucional:
lucas.alvarez@alumnos.ucm.cl
nicolas.corvalan@alumnos.ucm.cl
## Teléfonos: 997640977 / 995151810
Actividad Curricular: INF613 – Módulo Integrador de Formación Profesional
## Académico/a: Francisco Philip Vásquez Iglesias






Índice de Contenidos
Introducción .................................................................................................................. 1
Desarrollo ..................................................................................................................... 2
- Problemática ................................................................................................... 2
- Cliente y/o Público objetivo ............................................................................. 3
- Carta de Compromiso ...................................................................................... 3
- Propuesta de Solución ..................................................................................... 4
- Objetivos ......................................................................................................... 6
- Alcance del Proyecto ........................................................................................ 7
- Planificación Inicial .......................................................................................... 9
Bibliografía .................................................................................................................. 10







## 1

## Introducción
La  calidad  de  una  imagen  digital  influye  directamente  en  su  interpretación  y  en  los
análisis  que  pueden  realizarse  a  partir  de  ella.  Cuando  una  imagen  presenta  ruido  o
degradaciones, se dificulta no solo su observación, sino también procesos posteriores
como la extracción de información, la clasificación o el uso en sistemas informáticos, lo
que  adquiere  especial  relevancia  en  áreas  donde  las  imágenes  cumplen  un  papel
importante, como la investigación, la medicina y el procesamiento digital.
Los  filtros  digitales  son una  herramienta  habitual  para  mejorar  imágenes  degradadas,
aunque  su desempeño depende  de  cómo  se  configuren  sus parámetros. Definir  estos
valores  manualmente  suele  ser  un  proceso  lento  y  poco  preciso,  por  lo  que  resulta
pertinente explorar alternativas que permitan automatizar esta tarea. A partir de ello,
este  trabajo  propone  el  desarrollo  de  una  herramienta  de  software  orientada  a  la
parametrización  de  filtros  digitales  sobre  imágenes  degradadas,  utilizando  Octopus
Optimization  Algorithm (OOA) como  un  novedoso  método  de  Swarm  Intelligence (SI)
para la búsqueda de configuraciones adecuadas.
La   propuesta   busca   reunir   en   una   misma   aplicación   la   carga   de   imágenes,   la
configuración del proceso, la ejecución del método de optimización y la visualización de
resultados,  de  manera  que  el  uso  de  estas  técnicas  sea  más  accesible  dentro  de  un
entorno controlado.














## 2

## Desarrollo
## 1. Problemática
Las   imágenes   digitales   suelen   verse   afectadas   por   ruido   y   otras   degradaciones
introducidas durante su adquisición, transmisión o procesamiento, lo que disminuye su
calidad  visual  y  dificulta  tareas  posteriores  como  la  segmentación,  la  extracción  de
características,  la  clasificación  y el  análisis  automatizado  de  imágenes. La  literatura
reciente indica que la restauración de imágenes degradadas, particularmente frente a
ruido  y  desenfoque,  sigue  siendo  un  problema  vigente,  no  solo  por  la  necesidad  de
remover ruido,  sino  también  por  la  dificultad  de  preservar  información  estructural
relevante durante el proceso de restauración (Mao, Sun, Chen, & Yu, 2025).
Frente  a  ello,  los  filtros  digitales  constituyen  una  alternativa  clásica  para  mejorar
imágenes  degradadas.  Sin  embargo,  su  desempeño  depende  directamente  de  la
configuración de sus parámetros de entrada. Cuando esta parametrización se realiza de
forma  manual  o  por  prueba  y  error,  los  resultados  pueden  ser inconsistentes,  poco
reproducibles y difíciles de comparar objetivamente. Estudios recientes muestran que
la optimización de parámetros en algoritmos de restauración de imágenes degradadas
es un  problema   relevante, y  que   métricas   como ECM y SNR permiten  evaluar
cuantitativamente la calidad final del filtrado (Gaur, Khan, & Suthar, 2024).
Además,  revisiones  recientes  muestran  que  los  enfoques  de  Swarm  Intelligence  han
sido  aplicados  al  procesamiento  de  imágenes  precisamente  por  su  capacidad  para
abordar problemas complejos de análisis, síntesis y optimización en esta área (Xu, Cao,
## Lu, Hu, & Yue, 2023).
La  problemática también  se adentra en  la necesidad  de  contar  con herramientas  que
faciliten la ejecución de procesos de optimización y la revisión integrada de resultados,
especialmente cuando dichas tareas suelen ser percibidas como complejas y propias de
usuarios  con  conocimientos  especializados  (Pascual,  Högberg,  Syberfeldt,  &  Brolin,
## 2024).





## 3

Esta situación puede traducirse en mayores dificultades para usuarios no especializados
al interactuar con herramientas, parámetros y flujos de trabajo técnicos necesarios para
ejecutar pruebas y revisar resultados de manera metódica.
-  Cliente y/o Público objetivo
El  público  objetivo  de  la  propuesta  corresponde  a  investigadores  y  profesionales
vinculados al procesamiento y análisis de imágenes médicas, especialmente en ámbitos
como  imagenología  PET,  medicina  nuclear,  bioingeniería  e  investigación  biomédica,
donde la presencia de ruido y la baja relación señal-ruido afectan tanto la interpretación
visual como el análisis cuantitativo posterior. La literatura reciente en PET muestra que
la  reducción  de  ruido  y  la  mejora  de  imagen  siguen  siendo  necesidades  activas  de
investigación y desarrollo (Hashimoto et al., 2024).
También se consideran a   investigadores   que   trabajan   con   imágenes   antiguas,
deterioradas o degradadas, así como a usuarios que requieren mejorar la calidad de las
imágenes antes de someterlas a etapas posteriores de procesamiento. Dentro de este
grupo  se  encuentran  quienes  emplean  imágenes  como  insumo  para  algoritmos  de
aprendizaje profundo, como lo son las redes neuronales convolucionales utilizadas en
clasificación de imágenes médicas (Chen, Mat Isa, & Liu, 2025).
-  Carta de Compromiso

Ilustración 1: Carta de compromiso. [Elaboración Propia]





## 4

-  Propuesta de Solución
Aspectos técnicos: Se propone desarrollar un software orientado a la parametrización
automática   de   filtros   aplicados   sobre   imágenes   degradadas   intencionalmente,
empleando como núcleo de optimización un método de Swarm Intelligence (SI) basado
en  Octopus Optimization Algorithm (OOA), una metaheurística reciente planteada para
explorar espacios de búsqueda complejos y encontrar soluciones óptimas o cercanas al
óptimo (Song, Lin, Liu, Jia, & Luo, 2025). Su elección también se respalda en que, en su
publicación  original,  el OOA fue  evaluado  frente  a  otros  algoritmos  de  optimización
mediante funciones benchmark, pruebas CEC2019 y problemas de diseño de ingeniería,
reportando un desempeño competitivo o superior en distintos escenarios (Song et al.,
2025). La propuesta buscará reducir la dependencia de configuraciones manuales o por
prueba  y  error,  favoreciendo  una  parametrización  más  objetiva  y  consistente.  Para
evaluar  el  desempeño  del  método  propuesto,  este  será  comparado  con otros  dos
algoritmos  publicados  durante  los  últimos  dos  años,  los  cuales  son Hippopotamus
Optimization   Algorithm (HOA) y   Starfish   Optimization   Algorithm (SFOA) en   la
parametrización  de  filtros (Amiri,  Mehrabi  Hashjin,  Montazeri,  Mirjalili,  &  Khodadadi,
2024; Zhong et al., 2024).
El  sistema  permitirá  definir  el  filtro  a  utilizar,  establecer  los  parámetros  de  entrada,
ejecutar el proceso de optimización y visualizar los resultados obtenidos dentro de una
misma  interfaz.  Para  ello,  la  aplicación  se  organizará  en  las  siguientes  secciones
principales:
- Carga de imágenes: destinada al ingreso de las imágenes que serán utilizadas en
el  proceso,  dejándolas  disponibles  para  su  tratamiento  posterior  dentro  del
sistema.
- Selección de filtro: orientada a escoger el filtro digital con el que se trabajará en
cada prueba, definiendo así el método de procesamiento a utilizar.





## 5

- Configuración del algoritmo de optimización: orientada a preparar la ejecución
del método basado en OOA, fijando las condiciones bajo las cuales se realizará
la búsqueda de configuraciones.
- Ejecución   del   proceso:   correspondiente   a   la   puesta   en   marcha   de   la
parametrización  automática  del  filtro  sobre  la  imagen  cargada,  a  partir  de  la
configuración previamente definida.
- Visualización de resultados: dedicada a presentar la imagen procesada junto con
la  configuración  obtenida,  facilitando  la  observación  directa  del  resultado
generado.
- Métricas  de  evaluación:  enfocada  en  mostrar  los  valores  calculados  en  cada
ejecución,  permitiendo  revisar  el  desempeño  alcanzado  por  la  configuración
encontrada.
- Historial de ejecuciones: destinada al registro de pruebas anteriores, con el fin
de  conservar  resultados,  configuraciones  y  antecedentes  de  cada  ejecución
realizada.
Aspectos tecnológicos:
La  propuesta  se  plantea  como  una  aplicación  web  con  una  interfaz  clara,  ordenada  y
fácil de utilizar, pensada para concentrar en un mismo entorno la carga de imágenes, la
configuración del proceso y la revisión de resultados. Se considera un diseño responsivo,
de  manera  que  la  aplicación  pueda  adaptarse  correctamente  a  distintos  tamaños  de
pantalla sin perder claridad en la distribución de sus secciones ni en la presentación de
la información. Del mismo modo, se busca que la navegación sea simple y continua, para
que  el  usuario  pueda  desplazarse  entre  las  distintas  funciones  del  sistema  de  forma
natural.  Junto  con  ello,  la  solución  contempla  una  visualización  comprensible  de  las
imágenes procesadas, los parámetros definidos y las métricas obtenidas, otorgando una
experiencia de uso con buenas prácticas.
Aspectos  de  arquitectura: La  arquitectura  propuesta  será  de  tipo  cliente-servidor
organizada por capas. La capa de presentación estará compuesta por una interfaz web





## 6

desarrollada en React, encargada de la interacción con el usuario. La capa de servicios
se implementará mediante FastAPI, responsable de recibir las solicitudes, coordinar el
flujo  de  trabajo  y  comunicar  la  interfaz  con  el  procesamiento  interno.  La  capa  de
procesamiento reunirá la lógica asociada a la parametrización de filtros, la ejecución del
método  OOA  y  el  cálculo  de  métricas,  desarrollada  en  Python  para  el  tratamiento  de
imágenes y la ejecución del proceso de optimización. La capa de datos estará orientada
al almacenamiento de imágenes, parámetros, métricas y resultados de las ejecuciones.

Ilustración 2: Arquitectura del sistema propuesto dividido por capas. [Elaboración Propia]
## 5.  Objetivos
## 5.1.  Objetivo General
Desarrollar una herramienta de software con interfaz gráfica para la parametrización de
filtros  digitales  aplicados  a  imágenes  ruidosas,  basada  en  un  método  de  Swarm
Intelligence a partir de Octopus Optimization Algorithm.
## 5.2.  Objetivos Específicos





## 7

- OE1:   Generar   una   base   de   datos   de   imágenes   de   prueba   degradadas
artificialmente  manteniendo  las  imágenes  originales  como  terreno  de  verdad
conocido.
- OE2:  Definir  métricas  de  desempeño  que  permitan  evaluar  objetivamente  la
calidad de las imágenes resultantes del proceso de filtrado, con y sin terreno de
verdad.
- OE3:  Diseñar  un  método  de  parametrización  de  filtros  basado  en  Swarm
Intelligence a partir del algoritmo Octopus para la búsqueda de configuraciones
adecuadas.
- OE4: Implementar una herramienta de software con interfaz gráfica que permita
cargar  imágenes,  configurar  filtros,  ejecutar  el  algoritmo  de  optimización  y
visualizar los resultados obtenidos.
- OE5: Comparar  los  resultados  obtenidos  por  el  método  propuesto  con  una
estrategia  de  referencia  de  la  literatura,  considerando  calidad  de  imagen  y
consistencia de los parámetros encontrados.
- OE6: Verificar   el   correcto   funcionamiento  de   la   herramienta   desarrollada
mediante pruebas de software.
-  Alcance del Proyecto
El  proyecto  abarcará  el  diseño,  implementación  y  validación  experimental  de  una
herramienta de software orientada a la parametrización automática de filtros digitales
aplicados  sobre  imágenes  degradadas de  manera  controlada.  La  propuesta  incluirá  la
construcción  de  una  base  de  imágenes  de  prueba  con  degradaciones  controladas,  la
definición de métricas de evaluación, la implementación del método basado en OOA y
su  comparación  con  HOA  y  SFOA,  así  como  el  desarrollo  de  una  interfaz  gráfica que
facilite el uso del sistema.
El  alcance  considera  la  obtención  de  una  aplicación  web funcional  con  capacidad  de
cargar   imágenes,   aplicar   configuraciones al   algoritmo,   ejecutar   el   proceso   de
optimización y mostrar resultados cuantitativos y visuales. Se contemplará la realización





## 8

de pruebas de software para verificar el correcto funcionamiento, incluyendo pruebas
unitarias  sobre  componentes  clave,  y  pruebas  funcionales  sobre  flujos  principales  de
uso del sistema (pruebas E2E).
El  proyecto  se  limitará  a  un software orientado a  la  parametrización  y  evaluación
experimental  de  filtros  digitales, por  lo  que  no  contemplará  el  desarrollo  de  una
aplicación  móvil  nativa,  soporte  multidioma,  despliegue  en  un  entorno  productivo,
procesamiento  en  tiempo  real,  integración  con  plataformas  o  sistemas  externos,  ni
validación  en  contextos  clínicos  u  operacionales.  Del  mismo  modo,  no  se  incluirán
funcionalidades avanzadas propias de un producto comercial, como personalización por
perfiles de usuario, escalabilidad para uso masivo o soporte para un conjunto amplio e
indefinido de filtros e imágenes fuera del contexto establecido para la investigación.





## 9

## 7.  Planificación Inicial

Ilustración 3: Planificación de actividades por semana en base a los objetivos planteados. [Elaboración Propia]
## S1
## S2
## S3
## S4
## S5
## S6
## S7
## S8
## S9
## S10
## S11
## S12
## S13
## S14
## S15
## S16
## S17
## S18
Investigación y levantamiento de requerimientos
Investigación y Fundamentación
Estudio profundo del algoritmo Octopus Optimization
Definición de métricas de calidad
Definición y codificación de métricas de calidad
## Anteproyecto
Desarrollo del documento
Revisión y Entrega de Anteproyecto
Construcción de la Herramienta
Generación de dataset de prueba con ruido artificial
Pruebas preliminares del algoritmo en Python
Ajuste teórico de la metaheurística Octopus para filtros
Desarrollo de la Aplicación (Software)
Implementación del backend de optimización en Python con FastAPI
Desarrollo de la Interfaz Web de visualización (React)
Integración de módulos y pruebas de sistema
Evaluación y Resultados
Evaluación experimental del desempeño del software
Comparativa técnica con métodos de referencia
Redacción de conclusiones y trabajo final
Cierre del proyecto
Entrega de documentación
Preparación de defensa
Correcciones finales
## Julio
## Planificación Inicial
## Actividad / Tarea
## Marzo
## Abril
## Mayo
## Junio





## 10

## Bibliografía
Amiri,  M.  H.,  Mehrabi  Hashjin,  N.,  Montazeri,  M.,  Mirjalili,  S.,  &  Khodadadi,  N.  (2024).
Hippopotamus optimization algorithm: a novel nature-inspired optimization algorithm.
## Scientific Reports. 14. 10.1038/s41598-024-54910-3
Chen, C., Mat Isa, N. A., & Liu, X. (2025). A review of convolutional neural network based
methods  for  medical  image  classification.  Computers  in  Biology  and  Medicine,  185,
- doi:10.1016/j.compbiomed.2024.109507
Gaur, S., Khan, A. M., & Suthar, D. L. (2024). Optimization of parameters for image denoising
algorithm   pertaining   to   generalized   Caputo-Fabrizio   fractional   operator.   EURASIP
Journal on Image and Video Processing, 2024, 29. doi:10.1186/s13640-024-00632-5
Hashimoto,  F.,  Onishi,  Y.,  Ote,  K.,  Tashima,  H.,  Reader,  A.  J.,  &  Yamaya,  T.  (2024).  Deep
learning-based PET image denoising and reconstruction: A review. Radiological Physics
and Technology, 17(1), 24-46. doi:10.1007/s12194-024-00780-3
Mao, J., Sun, L., Chen, J., & Yu, S. (2025). Overview of research on digital image denoising
methods. Sensors, 25(8), 2615. doi:10.3390/s25082615
Pascual,  A.  I.,  Högberg,  D.,  Syberfeldt,  A.,  &  Brolin,  E.  (2024).  Development  and  initial
usability evaluation of a digital tool for simulation-based multi-objective optimization of
productivity  and  worker  well-being.  Advanced  Engineering  Informatics,  62, 102726.
doi:10.1016/j.aei.2024.102726
Song, M., Lin, J., Liu, X., Jia, H., & Luo, S. (2025). Octopus optimization algorithm: A novel
single- and  multi-objective  optimization  algorithm  for  optimization  problems. Cluster
Computing, 28, 484. doi:10.1007/s10586-025-05141-2
Xu, M., Cao, L., Lu, D., Hu, Z., & Yue, Y. (2023). Application of swarm intelligence optimization
algorithms  in  image  processing:  A  comprehensive  review  of  analysis,  synthesis,  and
optimization. Biomimetics, 8(2), 235. doi:10.3390/biomimetics8020235
Zhong,  C.,  Li,  G.,  Meng,  Z.,  Li,  H.,  Yildiz,  A.  R.,  &  Mirjalili,  S.  (2024). Starfish  optimization
algorithm   (SFOA):   a   bio-inspired   metaheuristic   algorithm   for   global   optimization





## 11

compared  with  100  optimizers.  Neural  Computing  and  Applications.  37.  3641-3683.
doi:10.1007/s00521-024-10694-1.