import {
  computeTerm,
  formatShortDate,
  normalizeRecord,
  parseCSV,
  exportToCSV
} from './parser.js';

const STORAGE_KEY = 'thepower_grades_data_v3';
const DATES_KEY = 'thepower_term_dates_v1';

let allRecords = [];
let filteredRecords = [];
let activeTerm = '';
let sortState = { key: 'FechaTimestamp', asc: false };

const $ = id => document.getElementById(id);

function getTermCutoffs() {
  return {
    t1: $('dateT1').value || '2026-11-23',
    t2: $('dateT2').value || '2027-02-19',
    t3: $('dateT3').value || '2027-06-18'
  };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadRecords(records, sourceName = 'Sesión guardada') {
  allRecords = records;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ records, sourceName, date: new Date().toLocaleString() })
  );

  $('dropzone').classList.add('hidden');
  $('dashboard').classList.remove('hidden');
  $('btnToggleDates').classList.remove('hidden');
  $('btnExport').classList.remove('hidden');
  $('btnClear').classList.remove('hidden');
  $('lastUpdate').textContent = `Archivo activo: ${sourceName} (${records.length} registros)`;

  populateSubjectSelect();
  updateTermCounters();
  applyFilters();
}

function recalculateAllTerms() {
  const cutoffs = getTermCutoffs();
  allRecords = allRecords.map(r => ({
    ...r,
    Trimestre: r.FechaEntrega ? computeTerm(r.FechaEntrega, cutoffs) : r.Trimestre
  }));
  updateTermCounters();
  applyFilters();
}

function updateTermCounters() {
  $('countAll').textContent = `(${allRecords.length})`;
  $('countT1').textContent = `(${allRecords.filter(r => r.Trimestre === '1º Trimestre').length})`;
  $('countT2').textContent = `(${allRecords.filter(r => r.Trimestre === '2º Trimestre').length})`;
  $('countT3').textContent = `(${allRecords.filter(r => r.Trimestre === '3º Trimestre').length})`;
}

function populateSubjectSelect() {
  const subjects = [...new Set(allRecords.map(r => r.Asignatura))].sort();
  const select = $('subjectSelect');
  select.innerHTML = '<option value="">Todas las asignaturas</option>';
  subjects.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    select.appendChild(opt);
  });
}

function renderSubjectCards(baseRecords) {
  const bySubject = {};
  baseRecords.forEach(r => {
    if (!bySubject[r.Asignatura]) bySubject[r.Asignatura] = [];
    bySubject[r.Asignatura].push(r);
  });

  const grid = $('subjectsGrid');
  grid.innerHTML = '';

  Object.entries(bySubject)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([subject, items]) => {
      const graded = items.filter(i => i.NotaNum !== null);
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
          <span>${items.filter(i => i.Estado === 'APPROVED').length} aprobadas</span>
        </div>
      `;

      card.addEventListener('click', () => {
        $('subjectSelect').value = $('subjectSelect').value === subject ? '' : subject;
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
    ? allRecords.filter(r => r.Trimestre === activeTerm)
    : allRecords;

  filteredRecords = termRecords.filter(r => {
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
  const graded = filteredRecords.filter(r => r.NotaNum !== null);
  const approved = filteredRecords.filter(r => r.Estado === 'APPROVED').length;
  const pending = filteredRecords.filter(r => r.NotaNum === null).length;

  $('kpiTotal').textContent = filteredRecords.length;
  $('kpiApproved').textContent = `${approved} aprobadas`;
  $('kpiPending').textContent = pending;

  if (graded.length > 0) {
    const sum = graded.reduce((acc, r) => acc + r.NotaNum, 0);
    $('kpiAvg').textContent = (sum / graded.length).toFixed(2);
    $('kpiAvgSub').textContent = `Sobre ${graded.length} calificadas`;
    $('kpiMax').textContent = Math.max(...graded.map(r => r.NotaNum)).toFixed(2);
    $('kpiMin').textContent = `Mínima: ${Math.min(...graded.map(r => r.NotaNum)).toFixed(2)}`;
  } else {
    $('kpiAvg').textContent = '-';
    $('kpiAvgSub').textContent = '0 entregas calificadas';
    $('kpiMax').textContent = '-';
    $('kpiMin').textContent = 'Mínima: -';
  }
}

function renderTable() {
  const tbody = $('tableBody');
  tbody.innerHTML = '';

  if (filteredRecords.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No hay entregas que coincidan con los filtros actuales.</td></tr>';
    return;
  }

  filteredRecords.forEach(r => {
    const tr = document.createElement('tr');

    let badgeClass = 'badge-other';
    if (r.Estado === 'APPROVED') badgeClass = 'badge-approved';
    else if (r.NotaNum === null) badgeClass = 'badge-pending';

    let gradeHtml = '<span class="grade-none">Sin calificar</span>';
    if (r.NotaNum !== null) {
      let cls = 'grade-mid';
      if (r.NotaNum >= 8.5) cls = 'grade-high';
      else if (r.NotaNum < 5) cls = 'grade-low';
      gradeHtml = `<span class="grade-pill ${cls}">${r.NotaNum.toFixed(2)}</span>`;
    }

    const hasDetails = r.Criterios.length > 0 || r.Feedback;
    const rubricTag = hasDetails ? '<span class="tag-rubric">Ver rúbrica</span>' : '';

    tr.innerHTML = `
      <td><span class="badge badge-term">${escapeHtml(r.Trimestre)}</span></td>
      <td class="date-cell">${formatShortDate(r.FechaEntrega)}</td>
      <td><strong>${escapeHtml(r.Asignatura)}</strong></td>
      <td>${escapeHtml(r.Modulo)}</td>
      <td>${escapeHtml(r.Tarea)}${rubricTag}</td>
      <td><span class="badge ${badgeClass}">${escapeHtml(r.Estado)}</span></td>
      <td>${gradeHtml}</td>
    `;

    tr.addEventListener('click', () => openModal(r));
    tbody.appendChild(tr);
  });
}

function openModal(record) {
  $('modalSubject').textContent = `${record.Asignatura} • ${record.Trimestre}`;
  $('modalTitle').textContent = record.Tarea;
  $('modalModule').textContent = `Módulo: ${record.Modulo} | Fecha: ${formatShortDate(record.FechaEntrega)}`;
  $('modalScore').textContent = record.NotaNum !== null ? record.NotaNum.toFixed(2) : 'S/C';

  const badgeClass = record.Estado === 'APPROVED' ? 'badge-approved' : 'badge-pending';
  $('modalStatusBadge').innerHTML = `<span class="badge ${badgeClass}">${escapeHtml(record.Estado)}</span>`;

  const criteriaContainer = $('modalCriteria');
  if (record.Criterios.length === 0) {
    criteriaContainer.innerHTML = '<p class="feedback-empty">Esta entrega no tiene criterios de evaluación registrados.</p>';
  } else {
    criteriaContainer.innerHTML = record.Criterios.map(c => {
      const obt = c.obtenido !== null && c.obtenido !== undefined ? Number(c.obtenido) : null;
      const max = Number(c.maximo) || 0;
      const pct = obt !== null && max > 0 ? Math.min(100, Math.max(0, (obt / max) * 100)) : 0;
      const scoreLabel = obt !== null ? `${obt} / ${max}` : `Pendiente (máx. ${max})`;

      return `
        <div class="criterion-item">
          <div class="criterion-top">
            <span class="criterion-name">${escapeHtml(c.criterio)}</span>
            <span class="criterion-score">${scoreLabel}</span>
          </div>
          <div class="progress-bar progress-bar-compact">
            <div class="progress-fill" style="width:${pct}%"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  const feedbackContainer = $('modalFeedback');
  if (record.Feedback && String(record.Feedback).trim() !== '') {
    const temp = document.createElement('div');
    temp.innerHTML = record.Feedback;
    feedbackContainer.innerHTML = `<div class="feedback-box">${escapeHtml(temp.textContent || record.Feedback)}</div>`;
  } else {
    feedbackContainer.innerHTML = '<p class="feedback-empty">El profesor no dejó comentarios escritos en esta entrega.</p>';
  }

  $('detailModal').classList.remove('hidden');
}

function closeModal() {
  $('detailModal').classList.add('hidden');
}

function handleFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target.result;
    const cutoffs = getTermCutoffs();
    let records = [];

    if (file.name.toLowerCase().endsWith('.json')) {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) records = parsed.map(r => normalizeRecord(r, cutoffs));
      } catch {
        alert('El archivo JSON no tiene un formato válido.');
        return;
      }
    } else {
      records = parseCSV(content, cutoffs);
    }

    if (records.length === 0) {
      alert('No se encontraron registros válidos en el archivo.');
      return;
    }
    loadRecords(records, file.name);
  };
  reader.readAsText(file, 'UTF-8');
}

function init() {
  // Restaurar fechas de corte guardadas
  const savedDates = localStorage.getItem(DATES_KEY);
  if (savedDates) {
    try {
      const d = JSON.parse(savedDates);
      if (d.t1) $('dateT1').value = d.t1;
      if (d.t2) $('dateT2').value = d.t2;
      if (d.t3) $('dateT3').value = d.t3;
    } catch {}
  }

  // Pestañas de trimestre
  document.querySelectorAll('.term-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.term-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTerm = btn.dataset.term;

      const { t1, t2, t3 } = getTermCutoffs();
      const labels = {
        '': 'Curso completo',
        '1º Trimestre': `Hasta el ${formatShortDate(t1)}`,
        '2º Trimestre': `Del ${formatShortDate(t1)} al ${formatShortDate(t2)}`,
        '3º Trimestre': `Del ${formatShortDate(t2)} al ${formatShortDate(t3)}`
      };
      $('termRangeLabel').textContent = labels[activeTerm] || '';
      applyFilters();
    });
  });

  $('btnToggleDates').addEventListener('click', () => $('datesPanel').classList.toggle('hidden'));

  $('btnApplyDates').addEventListener('click', () => {
    localStorage.setItem(DATES_KEY, JSON.stringify(getTermCutoffs()));
    recalculateAllTerms();
    $('datesPanel').classList.add('hidden');
  });

  // Carga de archivos y Drag & Drop
  $('fileInput').addEventListener('change', e => handleFile(e.target.files[0]));
  const dropzone = $('dropzone');
  dropzone.addEventListener('click', () => $('fileInput').click());
  dropzone.addEventListener('dragover', e => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    handleFile(e.dataTransfer.files[0]);
  });

  // Filtros y ordenación
  ['searchInput', 'subjectSelect', 'statusSelect', 'minGrade', 'maxGrade'].forEach(id => {
    $(id).addEventListener('input', applyFilters);
  });

  $('btnResetFilters').addEventListener('click', () => {
    $('searchInput').value = '';
    $('subjectSelect').value = '';
    $('statusSelect').value = '';
    $('minGrade').value = '';
    $('maxGrade').value = '';
    applyFilters();
  });

  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (sortState.key === key) sortState.asc = !sortState.asc;
      else {
        sortState.key = key;
        sortState.asc = true;
      }
      applyFilters();
    });
  });

  $('btnExport').addEventListener('click', () => {
    const filename = `notas_${activeTerm || 'curso'}_${new Date().toISOString().slice(0, 10)}.csv`;
    exportToCSV(filteredRecords, filename);
  });

  $('btnClear').addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });

  $('btnCloseModal').addEventListener('click', closeModal);
  $('detailModal').addEventListener('click', e => {
    if (e.target === $('detailModal')) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  // Restaurar sesión previa
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.records?.length) {
        const cutoffs = getTermCutoffs();
        const normalized = parsed.records.map(r => normalizeRecord(r, cutoffs));
        loadRecords(normalized, `${parsed.sourceName} (${parsed.date})`);
      }
    } catch {}
  }
}

init();