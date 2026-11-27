# 📊 Gestor de Notas Académicas

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Client-Side](https://img.shields.io/badge/Storage-LocalStorage-4CAF50?style=for-the-badge)

Aplicación web interactiva y herramienta de extracción automática diseñada para exportar, analizar y visualizar calificaciones académicas desde la plataforma educativa **ThePower / Prometeo**. Permite transformar los registros de evaluaciones en un panel de control visual con métricas en tiempo real, filtros por asignatura y cálculo automático de medias.

---

## ✨ Características Principales

* **Extracción Automatizada (`Script-Notas.js`):** Script de consola que consulta los endpoints internos de la plataforma usando la sesión activa del navegador, recopila todas las páginas de retos/evaluaciones y descarga automáticamente un archivo `.csv` compatible con Excel.
* **Procesamiento Local (`parser.js`):** Lectura e interpretación de archivos CSV directamente en el navegador mediante `FileReader`, sin necesidad de subir datos a servidores externos.
* **Dashboard de Estadísticas:** Cálculo automático de nota media global, media por módulo/asignatura, total de entregas realizadas, pendientes y tasa de aprobados.
* **Filtrado y Búsqueda Dinámica:** Filtrado instantáneo por asignatura, estado de calificación (aprobado, suspenso, pendiente) y buscador por nombre de actividad.
* **Persistencia en el Navegador:** Almacenamiento automático en `localStorage` para conservar el historial cargado entre sesiones.
* **Interfaz Adaptable:** Diseño *responsive* con soporte de temas y visualización clara en escritorio y móvil.

---

## 🛠️ Estructura del Proyecto

```text
gestor-notas-main/
├── index.html        # Estructura principal de la interfaz web y paneles de métricas
├── styles.css        # Estilos, variables CSS, diseño responsive y modo oscuro
├── app.js            # Lógica de negocio, cálculo de estadísticas, filtros y DOM
├── parser.js         # Lectura, limpieza y normalización de archivos CSV
├── Script-Notas.js   # Script de extracción vía API para la consola del navegador
└── README.md         # Documentación del proyecto
```

## Autor

- **Óscar Renilla Rodríguez** - [@OscarRenilla](https://github.com/OscarRenilla)
- **Prtfolio Web** - [PortfolioWeb](https://oscar-renilla-portfolio.vercel.app/)
