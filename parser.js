export function computeTerm(isoDate, cutoffs) {
  if (!isoDate) return 'Sin fecha';
  const d = new Date(isoDate);
  if (isNaN(d)) return 'Sin fecha';

  const endT1 = new Date(`${cutoffs.t1}T23:59:59`);
  const endT2 = new Date(`${cutoffs.t2}T23:59:59`);
  const endT3 = new Date(`${cutoffs.t3}T23:59:59`);

  if (d <= endT1) return '1º Trimestre';
  if (d <= endT2) return '2º Trimestre';
  if (d <= endT3) return '3º Trimestre';
  return 'Fuera de curso';
}

export function formatShortDate(isoDate) {
  if (!isoDate) return '-';
  const d = new Date(isoDate);
  if (isNaN(d)) return '-';
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

export function normalizeRecord(raw, cutoffs) {
  const parsedNota = typeof raw.Nota === 'number'
    ? raw.Nota
    : parseFloat(String(raw.Nota || '').replace(',', '.'));

  const fechaRaw = raw.FechaEntrega || null;
  const ts = fechaRaw ? new Date(fechaRaw).getTime() : 0;

  return {
    Asignatura: raw.Asignatura || 'Sin asignatura',
    Modulo: raw.Modulo || '-',
    Tarea: raw.Tarea || '-',
    Estado: raw.Estado || '-',
    NotaNum: !isNaN(parsedNota) ? parsedNota : null,
    FechaEntrega: fechaRaw,
    FechaTimestamp: isNaN(ts) ? 0 : ts,
    Trimestre: fechaRaw ? computeTerm(fechaRaw, cutoffs) : (raw.Trimestre || 'Sin fecha'),
    Feedback: raw.Feedback || null,
    Criterios: Array.isArray(raw.Criterios) ? raw.Criterios : []
  };
}

export function parseCSV(text, cutoffs) {
  const clean = text.replace(/^\uFEFF/, '').trim();
  const lines = clean.split(/\r?\n/);
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes(';') ? ';' : ',';

  const parseLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  return lines.slice(1).filter(Boolean).map(line => {
    const values = parseLine(line);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] ?? '';
    });
    return normalizeRecord(obj, cutoffs);
  });
}

export function exportToCSV(records, filename) {
  const header = 'Trimestre;Fecha;Asignatura;Modulo;Tarea;Estado;Nota;Criterios';
  const rows = records.map(r => {
    const nota = r.NotaNum !== null ? r.NotaNum.toString().replace('.', ',') : 'Sin calificar';
    const critSummary = r.Criterios
      .map(c => `${c.criterio}: ${c.obtenido ?? '-'}/${c.maximo}`)
      .join(' | ');

    return [
      r.Trimestre,
      formatShortDate(r.FechaEntrega),
      r.Asignatura,
      r.Modulo,
      r.Tarea,
      r.Estado,
      nota,
      critSummary
    ]
      .map(v => `"${String(v).replace(/"/g, '""')}"`)
      .join(';');
  });

  const blob = new Blob(['\uFEFF' + [header, ...rows].join('\r\n')], {
    type: 'text/csv;charset=utf-8;'
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}