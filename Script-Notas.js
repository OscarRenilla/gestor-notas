// Pegar este código en la consola de la página de Tareas de ThePowerMBA para exportar tus entregas y rúbricas a un archivo JSON. 
// Exportar el archivo  notas_thepower_YYYY-MM-DD.json a la página web gestor_notas.html 

(async () => {
  const getToken = async () => {
    for (const k of Object.keys(localStorage)) {
      const val = localStorage.getItem(k);
      if (val && val.includes('eyJ')) {
        const match = val.match(/eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/);
        if (match) return match[0];
      }
    }
    return new Promise((resolve) => {
      const req = indexedDB.open('firebaseLocalStorageDb');
      req.onsuccess = () => {
        try {
          const tx = req.result.transaction('firebaseLocalStorage', 'readonly');
          const store = tx.objectStore('firebaseLocalStorage');
          const getAll = store.getAll();
          getAll.onsuccess = () => {
            const entry = getAll.result.find(x => x?.value?.stsTokenManager?.accessToken);
            resolve(entry?.value?.stsTokenManager?.accessToken || null);
          };
        } catch { resolve(null); }
      };
      req.onerror = () => resolve(null);
    });
  };

  const calcularTrimestre = (isoDate) => {
    if (!isoDate) return "Sin fecha";
    const d = new Date(isoDate);
    if (isNaN(d)) return "Sin fecha";

    const finT1 = new Date("2026-11-23T23:59:59");
    const finT2 = new Date("2027-02-19T23:59:59");
    const finT3 = new Date("2027-06-18T23:59:59");

    if (d <= finT1) return "1º Trimestre";
    if (d <= finT2) return "2º Trimestre";
    if (d <= finT3) return "3º Trimestre";
    return "Fuera de curso";
  };

  const token = await getToken();
  if (!token) return console.error("No se encontró el token.");

  const ids = [...new Set(
    [...document.querySelectorAll('a[href]')]
      .map(a => a.href.match(/[a-f0-9]{24}/)?.[0])
      .filter(Boolean)
  )];

  console.log(`Extrayendo ${ids.length} entregas y calculando trimestres...`);

  const resultados = await Promise.all(ids.map(async (id) => {
    const res = await fetch(`https://api.thepowermba.com/api/challenges/${id}?liveEventsLimit=3`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
    });
    if (!res.ok) return null;

    const data = await res.json();
    const score = data?.deliverable?.score ? parseFloat(data.deliverable.score) : null;
    const fechaRef = data?.availableDates?.endDate || data?.deliverable?.updatedAt || data?.createdAt || null;

    const mapaNotas = new Map(
      (data?.deliverable?.scoreByCriteria || []).map(c => [c._id, c.score])
    );

    const criterios = (data?.evaluationCriteria || []).map(c => ({
      criterio: c.criteria,
      maximo: c.score,
      obtenido: mapaNotas.has(c._id) ? mapaNotas.get(c._id) : null
    }));

    return {
      id,
      Trimestre: calcularTrimestre(fechaRef),
      FechaEntrega: fechaRef,
      Asignatura: data?.promotion?.title || "Sin asignatura",
      Modulo: data?.module?.name || "-",
      Tarea: data?.title || id,
      Estado: data?.deliverable?.status || data?.status || "-",
      Nota: score,
      Feedback: data?.deliverable?.feedback || null,
      Criterios: criterios
    };
  }));

  const limpios = resultados
    .filter(Boolean)
    .sort((a, b) => a.Asignatura.localeCompare(b.Asignatura));

  const blob = new Blob([JSON.stringify(limpios, null, 2)], { type: 'application/json;charset=utf-8;' });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(blob);
  enlace.download = `notas_thepower_${new Date().toISOString().slice(0, 10)}.json`;
  enlace.click();

  console.log(`✅ Exportadas ${limpios.length} entregas clasificadas por trimestre.`);
})();