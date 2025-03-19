# US Elections Prediction

![Elections Banner](https://www.fairus.org/sites/default/files/styles/hero_basic_page_fullsize/public/images/iStock-478038889.jpg.webp?itok=B-BALXpW)

## 📌 Descripción
Este repositorio contiene un modelo de predicción electoral para las elecciones presidenciales de EE.UU. en 2024. Se utilizan datos electorales por condado de años anteriores, junto con características demográficas y socioeconómicas, para estimar el ganador en cada región y, finalmente, el presidente electo.

## 📊 Datos Utilizados [TBD]
Los datos provienen de diversas fuentes, incluyendo:
- 🗳️ **Resultados electorales por condado**
- 📈 **Datos socioeconómicos y demográficos** (ingresos, educación, densidad poblacional, etc.)
- 📍 **Distribución geográfica y tendencias históricas**

## 🏗️ Estructura del Proyecto
```
📂 US-Elections-Prediction
 ├── 📄 README.md
 ├── 📄 .gitignore
 ├── 📄 .gitkeep
 ├── 📄 models.txt          # Registro de modelos probados
 ├── 📂 notebooks/          # Jupyter Notebooks con análisis exploratorio y modelado
 │   ├── census_api.ipynb   # Obtención de datos del censo
 │   ├── data_analysis.ipynb # Análisis exploratorio de datos
 │   ├── gwr.ipynb          # Regresión geográficamente ponderada
 │   ├── process_data.ipynb # Preprocesamiento de datos
 │   ├── regression.ipynb   # Modelos de regresión
 │   ├── simulation.ipynb   # Simulación de escenarios electorales
 │   ├── unsupervised.ipynb # Métodos no supervisados para análisis
```

## 🏆 Resultados
📌 **Evaluación del modelo:** [TBD]

📊 **Visualización de resultados:**  [TBD]
Los resultados pueden visualizarse en mapas interactivos y gráficos comparativos.

## 🚀 Instalación y Uso
1. Clonar el repositorio:
   ```bash
   git clone https://github.com/jorgegarcelan/US-Elections.git
   cd US-Elections
   ```
2. Instalar dependencias:
   ```bash
   pip install -r requirements.txt
   ```
3. Ejecutar el modelo:
   ```bash
   python main.py
   ```

## 📌 Contribución
¡Toda contribución es bienvenida! Para colaborar:
1. Haz un fork del repositorio 📌
2. Crea una nueva rama (`git checkout -b feature-nueva`)
3. Sube tus cambios (`git commit -m 'Descripción' && git push origin feature-nueva`)
4. Abre un Pull Request 🚀

## 📜 Licencia
Este proyecto está bajo la licencia **MIT**.

---
✨ *Desarrollado por  [Lucía Cordero](https://github.com/lucia-corsan) y [Jorge Garcelán](https://github.com/jorgegarcelan)*
