const STORAGE_KEY = 'thepower_grades_data_v3';
const DATES_KEY = 'thepower_term_dates_v1';

let allRecords = [];
let filteredRecords = [];
let activeTerm = '';
let sortState = { key: 'FechaTimestamp', asc: false };

const $ = (id) => document.getElementById(id);

function getTermCutoffs() {
  return {
    t1: $('dateT1').value || '2026-11-23',
    t2: $('dateT2').value || '2027-02-19',
    t3: $('dateT3').value || '2027-06-18'
  };
}

function computeTerm(isoDate) {
  if (!isoDate) return 'Sin fecha';
  const d = new Date(isoDate);
  if (isNaN(d)) return 'Sin fecha';

  const { t1, t2, t3 } = getTermCutoffs();
  const endT1 = new Date(`${t1}T23:59:59`);
  const endT2 = new Date(`${t2}T23:59:59`);
  const endT3 = new Date(`${t3}T23:59:59`);

  if (d <= endT1) return '1º Trimestre';
  if (d <= endT2) return '2º Trimestre';
  if (d <= endT3) return '3º Trimestre';
  return 'Fuera de curso';
}

function formatShortDate(isoDate) {
  if (!isoDate) return '-';
  const d = new Date(isoDate);
  if (isNaN(d)) return '-';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function normalizeRecord(raw) {
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
    Trimestre: fechaRaw ? computeTerm(fechaRaw) : (raw.Trimestre || 'Sin fecha'),
    Feedback: raw.Feedback || null,
    Criterios: Array.isArray(raw.Criterios) ? raw.Criterios : []
  };
}

function parseCSV(text) {
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
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = parseLine(line);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] ?? '';
    });
    return normalizeRecord(obj);
  });
}

function recalculateAllTerms() {
  allRecords = allRecords.map((r) => ({
    ...r,
    Trimestre: r.FechaEntrega ? computeTerm(r.FechaEntrega) : r.Trimestre
  }));
  updateTermCounters();
  applyFilters();
}

function loadRecords(records, sourceName = 'Sesión guardada') {
  allRecords = records;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ records, sourceName, date: new Date().toLocaleString() })
  );

  $('dropzone').classList.add('hidden');$('dashboard').classList.remove('hidden');
  $('btnToggleDates').classList.remove('hidden');$('btnExport').classList.remove('hidden');
  $('btnClear').classList.remove('hidden');$('lastUpdate').textContent = `Archivo activo: ${sourceName} (${records.length} registros)`;

  populateSubjectSelect();
  updateTermCounters();
  applyFilters();
}

function updateTermCounters() {
  $('countAll').textContent = `(${allRecords.length})`;
  $('countT1').textContent = `(${allRecords.filter((r) => r.Trimestre === '1º Trimestre').length})`;
  $('countT2').textContent = `(${allRecords.filter((r) => r.Trimestre === '2º Trimestre').length})`;
  $('countT3').textContent = `(${allRecords.filter((r) => r.Trimestre === '3º Trimestre').length})`;
}

function populateSubjectSelect() {
  const subjects = [...new Set(allRecords.map((r) => r.Asignatura))].sort();
  const select = $('subjectSelect');
  select.innerHTML = '<option value="">Todas las asignaturas</option>';
  subjects.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    select.appendChild(opt);
  });
}

function renderSubjectCards(baseRecords) {
  const bySubject = {};
  baseRecords.forEach((r) => {
    if (!bySubject[r.Asignatura]) bySubject[r.Asignatura] = [];
    bySubject[r.Asignatura].push(r);
  });

  const grid = $('subjectsGrid');
  grid.innerHTML = '';

  Object.entries(bySubject)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([subject, items]) => {
      const graded = items.filter((i) => i.NotaNum !== null);
      const avg = graded.length
        ? graded.reduce((acc, i) => acc + i.NotaNum, 0) / graded.length
        : null;

      const card = document.createElement('div');
      card.className = 'subject-card';
      if ($('subjectSelect').value === subject) card.classList.add('active');

      const pct = avg !== null ? Math.min(100, Math.max(0, avg * 10)) : 0;

      card.innerHTML = `
        <div class="subject-top">
          <div class="subject-name">${escapeHtml(subject)}</div>
          <div class="subject-avg">${avg !== null ? avg.toFixed(2) : 'S/C'}</div>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="subject-meta">
          <span>${graded.length}/${items.length} calificadas</span>
          <span>${items.filter((i) => i.Estado === 'APPROVED').length} aprobadas</span>
        </div>
      `;

      card.addEventListener('click', () => {
        $('subjectSelect').value =$('subjectSelect').value === subject ? '' : subject;
        applyFilters();
      });

      grid.appendChild(card);
    });
}

function applyFilters() {
  const q = $('searchInput').value.toLowerCase().trim();
  const subject = $('subjectSelect').value;
  const status = $('statusSelect').value;
  const minG = $('minGrade').value !== '' ? parseFloat($('minGrade').value) : null;
  const maxG = $('maxGrade').value !== '' ? parseFloat($('maxGrade').value) : null;

  const termRecords = activeTerm
    ? allRecords.filter((r) => r.Trimestre === activeTerm)
    : allRecords;

  filteredRecords = termRecords.filter((r) => {
    if (subject && r.Asignatura !== subject) return false;
    if (status === 'CALIFICADA' && r.NotaNum === null) return false;
    if (status === 'SIN_CALIFICAR' && r.NotaNum !== null) return false;
    if (status && status !== 'CALIFICADA' && status !== 'SIN_CALIFICAR' && r.Estado !== status) return false;
    if (minG !== null && (r.NotaNum === null || r.NotaNum < minG)) return false;
    if (maxG !== null && (r.NotaNum === null || r.NotaNum > maxG)) return false;
    if (q && !`${r.Asignatura} ${r.Modulo} ${r.Tarea}`.toLowerCase().includes(q)) return false;
    return true;
  });

  sortRecords();
  updateKPIs();
  renderSubjectCards(termRecords);
  renderTable();
}

function sortRecords() {
  const { key, asc } = sortState;
  filteredRecords.sort((a, b) => {
    let va = a[key];
    let vb = b[key];
    if (key === 'NotaNum' || key === 'FechaTimestamp') {
      va = va ?? -1;
      vb = vb ?? -1;
      return asc ? va - vb : vb - va;
    }
    return asc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  });
}

function updateKPIs() {
  const graded = filteredRecords.filter((r) => r.NotaNum !== null);
  const approved = filteredRecords.filter((r) => r.Estado === 'APPROVED').length;
  const pending = filteredRecords.filter((r) => r.NotaNum === null).length;

  $('kpiTotal').textContent = filteredRecords.length;
  $('kpiApproved').textContent = `${approved} aprobadas`;
  $('kpiPending').textContent = pending;

  if (graded.length > 0) {
    const sum = graded.reduce((acc, r) => acc + r.NotaNum, 0);
    $('kpiAvg').textContent = (sum / graded.length).toFixed(2);$('kpiAvgSub').textContent = `Sobre ${graded.length} calificadas`;
    $('kpiMax').textContent = Math.max(...graded.map((r) => r.NotaNum)).toFixed(2);$('kpiMin').