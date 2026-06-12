const PE_SERVICE_LABELS = { Matin:'Matin', 'Apres-midi':'Après-midi', Nuit:'Nuit', Journee:'Journée' };
const PE_SERVICE_COLORS = { Matin:'#f59e0b', 'Apres-midi':'#3b82f6', Nuit:'#312e81', Journee:'#10b981' };

let peWeekStart = peGetMonday(new Date());
let _peCtx = null;
let peViewMode = 'week';

function initPlanningEquipe() {
  const _s = Auth.requireAuth();
  if (!_s) return;
  if (!requireModule('access_planning_equipe')) return;
  peWeekStart = peGetMonday(new Date());
  renderPlanningEquipe();
}

function peGetMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0,0,0,0);
  return date;
}

function peISO(d) {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function peFormatShort(d) {
  return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0');
}

function peFormatLong(d) {
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

function peDuration(debut, fin) {
  const [h1,m1] = debut.split(':').map(Number);
  const [h2,m2] = fin.split(':').map(Number);
  let mins = (h2*60+m2) - (h1*60+m1);
  if (mins <= 0) mins += 24*60;
  return mins;
}

function peFormatDuration(mins) {
  const h = Math.floor(mins/60), m = Math.round(mins%60);
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2,'0')}`;
}

function peFormatSigned(mins) {
  const sign = mins < 0 ? '-' : (mins > 0 ? '+' : '');
  return sign + peFormatDuration(Math.abs(mins));
}

// ── NAVIGATION ──
function pePrevWeek() {
  if (peViewMode === 'week') peWeekStart.setDate(peWeekStart.getDate()-7);
  else peWeekStart.setMonth(peWeekStart.getMonth()-1);
  renderPlanningEquipe();
}
function peNextWeek() {
  if (peViewMode === 'week') peWeekStart.setDate(peWeekStart.getDate()+7);
  else peWeekStart.setMonth(peWeekStart.getMonth()+1);
  renderPlanningEquipe();
}
function peToday() {
  const now = new Date();
  peWeekStart = peViewMode === 'week' ? peGetMonday(now) : new Date(now.getFullYear(), now.getMonth(), 1);
  renderPlanningEquipe();
}
function peSetViewMode(mode) {
  peViewMode = mode;
  if (mode === 'month') peWeekStart = new Date(peWeekStart.getFullYear(), peWeekStart.getMonth(), 1);
  document.getElementById('peViewWeekBtn').style.color = mode === 'week' ? 'var(--primary)' : '';
  document.getElementById('peViewWeekBtn').style.fontWeight = mode === 'week' ? '700' : '';
  document.getElementById('peViewMonthBtn').style.color = mode === 'month' ? 'var(--primary)' : '';
  document.getElementById('peViewMonthBtn').style.fontWeight = mode === 'month' ? '700' : '';
  renderPlanningEquipe();
}

// ── DONNÉES ──
function getPeShifts() { return DB.get(DB.keys.planningEquipe) || []; }
function setPeShifts(shifts) { DB.set(DB.keys.planningEquipe, shifts); }
function peCanEditPlanning() {
  const _s = Auth.getSession();
  return !!(_s && (Auth.isAdmin() || hasPermission(_s.userId, 'edit_planning_equipe')));
}
function getPeConges() {
  const conges = DB.get(DB.keys.conges) || [];
  const now = new Date();
  const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);
  return conges.filter(c => c.statut === 'accepte' && new Date(c.dateFin || c.dateDebut) >= debutMois);
}

// ── IMPORT CSV ──
function openImportPlanning() {
  const html = `<div class="modal-overlay" id="modalImportPe" style="display:flex" onclick="closeModal('modalImportPe')">
    <div class="modal" style="max-width:480px" onclick="event.stopPropagation()">
      <div class="modal-header"><span class="modal-title">📥 Importer le planning</span><button class="modal-close" onclick="closeModal('modalImportPe')">&times;</button></div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:.85rem">
        <div style="font-size:.78rem;color:var(--muted);line-height:1.5">
          Le fichier CSV doit contenir les colonnes : <strong>employé, date, début, fin</strong> (séparateur virgule ou point-virgule).
          Une ligne d'en-tête est ignorée. Les créneaux importés sont ajoutés au planning existant.<br/>
          <span style="display:block;margin-top:.5rem;padding:.5rem .75rem;background:#f1f5f9;border-radius:6px;font-family:monospace;font-size:.72rem">
            employé,date,début,fin<br/>
            Jean Martin,2026-06-10,08:00,16:00<br/>
            Sophie Dubois,2026-06-10,13:00,21:00
          </span>
        </div>
        <div class="photo-upload-zone" onclick="document.getElementById('peFileInput').click()" style="padding:1.5rem;text-align:center;cursor:pointer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:32px;height:32px;margin:0 auto .5rem;color:var(--muted)"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <div style="font-size:.82rem;color:var(--muted)">Cliquez pour sélectionner un fichier CSV</div>
        </div>
        <input type="file" id="peFileInput" accept=".csv,.tsv,.txt" style="display:none" onchange="handlePeImport(event)"/>
      </div>
    </div>
  </div>`;
  const old = document.getElementById('modalImportPe');
  if (old) old.remove();
  const div = document.createElement('div');
  div.innerHTML = html;
  document.body.appendChild(div);
  requestAnimationFrame(() => document.getElementById('modalImportPe')?.classList.add('open'));
}

function handlePeImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const text = ev.target.result;
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) { toast('Fichier vide ou invalide', 'error'); return; }
    const header = lines[0].split(/[;,]/).map(h => h.trim().toLowerCase().replace(/['"]/g,''));
    const empIdx = header.findIndex(h => h.includes('employ') || h.includes('nom') || h.includes('prenom'));
    const dateIdx = header.findIndex(h => h === 'date');
    const debutIdx = header.findIndex(h => h.includes('début') || h.includes('debut') || h.includes('start'));
    const finIdx = header.findIndex(h => h.includes('fin') || h.includes('end'));
    if (empIdx === -1 || dateIdx === -1 || debutIdx === -1 || finIdx === -1) {
      toast('Format CSV incorrect. Colonnes attendues : employé, date, début, fin', 'error'); return;
    }
    const imported = [];
    const employes = DB.get(DB.keys.employes) || [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(/[;,]/).map(c => c.trim().replace(/['"]/g,''));
      const nom = cols[empIdx], date = cols[dateIdx], debut = cols[debutIdx], fin = cols[finIdx];
      if (!nom || !date || !debut || !fin) continue;
      const emp = employes.find(e => (e.prenom+' '+e.nom).toLowerCase() === nom.toLowerCase() || e.nom.toLowerCase() === nom.toLowerCase());
      imported.push({ id:'pe-'+genId(), employeId:emp?emp.id:null, employeNom:emp?emp.prenom+' '+emp.nom:nom, date, debut, fin });
    }
    if (!imported.length) { toast('Aucune ligne valide trouvée', 'error'); return; }
    setPeShifts(getPeShifts().concat(imported));
    if (typeof auditLog === 'function') auditLog('import', 'Planning équipe — ' + imported.length + ' lignes depuis ' + file.name);
    closeModal('modalImportPe');
    toast('Planning importé : ' + imported.length + ' lignes ✓', 'success');
    renderPlanningEquipe();
  };
  reader.readAsText(file);
}

// ── MODALE CRÉNEAU ──
function openPeShiftModal(employeId, date, shiftId) {
  if (!peCanEditPlanning()) return;
  const shifts = getPeShifts();
  const employes = DB.get(DB.keys.employes) || [];
  const shift = shiftId ? shifts.find(s => s.id === shiftId) : null;
  let finalEmployeId, finalDate, empNom;
  if (shift) {
    finalEmployeId = shift.employeId;
    finalDate = shift.date;
    const emp = employes.find(e => e.id === shift.employeId);
    empNom = emp ? (emp.prenom+' '+emp.nom) : (shift.employeNom || 'Non assigné');
  } else {
    finalEmployeId = employeId;
    finalDate = date;
    const emp = employes.find(e => e.id === employeId);
    empNom = emp ? (emp.prenom+' '+emp.nom) : 'Non assigné';
  }
  _peCtx = { employeId: finalEmployeId, date: finalDate, shiftId: shift ? shift.id : null, employeNom: empNom };
  document.getElementById('psTitle').textContent = shift ? 'Modifier le créneau' : 'Nouveau créneau';
  document.getElementById('psEmploye').textContent = empNom;
  document.getElementById('psDate').textContent = peFormatLong(new Date(finalDate + 'T00:00:00'));
  document.getElementById('psDebut').value = shift ? shift.debut : '08:00';
  document.getElementById('psFin').value = shift ? shift.fin : '16:00';
  document.getElementById('psService').value = shift ? (shift.service || '') : '';
  document.getElementById('psNotes').value = shift ? (shift.notes || '') : '';
  document.getElementById('psDeleteBtn').style.display = shift ? '' : 'none';
  document.getElementById('psRecurrenceWrap').style.display = shift ? 'none' : '';
  document.getElementById('psRecurrenceEnabled').checked = false;
  document.getElementById('psRecurrenceWeeks').disabled = true;
  document.getElementById('psRecurrenceWeeks').value = 4;
  openModal('modalPeShift');
}

function savePeShift() {
  const debut = document.getElementById('psDebut').value;
  const fin = document.getElementById('psFin').value;
  if (!debut || !fin) { toast('Veuillez renseigner les heures de début et de fin', 'error'); return; }
  const service = document.getElementById('psService').value;
  const notes = document.getElementById('psNotes').value.trim();
  const shifts = getPeShifts();
  if (_peCtx.shiftId) {
    const s = shifts.find(x => x.id === _peCtx.shiftId);
    if (s) { s.debut = debut; s.fin = fin; s.service = service; s.notes = notes; }
    auditLog('modification', `Planning équipe — créneau ${_peCtx.employeNom} le ${_peCtx.date}`);
  } else {
    const recEnabled = document.getElementById('psRecurrenceEnabled').checked;
    const recWeeks = parseInt(document.getElementById('psRecurrenceWeeks').value) || 1;
    const base = { employeId: _peCtx.employeId, employeNom: _peCtx.employeNom, debut, fin, service, notes };
    if (recEnabled && recWeeks > 1) {
      for (let w = 0; w < recWeeks; w++) {
        const d = new Date(_peCtx.date + 'T00:00:00');
        d.setDate(d.getDate() + w * 7);
        shifts.push({ id:'pe-'+genId(), ...base, date: peISO(d) });
      }
    } else {
      shifts.push({ id:'pe-'+genId(), ...base, date: _peCtx.date });
    }
    auditLog('création', `Planning équipe — créneau ${_peCtx.employeNom} le ${_peCtx.date}`);
  }
  setPeShifts(shifts);
  closeModal('modalPeShift');
  toast('Créneau enregistré ✓');
  renderPlanningEquipe();
}

function deletePeShift() {
  if (!_peCtx || !_peCtx.shiftId) return;
  if (!confirm('Supprimer ce créneau ?')) return;
  setPeShifts(getPeShifts().filter(s => s.id !== _peCtx.shiftId));
  auditLog('suppression', `Planning équipe — créneau ${_peCtx.employeNom} le ${_peCtx.date} supprimé`);
  closeModal('modalPeShift');
  toast('Créneau supprimé', 'success');
  renderPlanningEquipe();
}

// ── DUPLIQUER UNE SEMAINE ──
function peDuplicateWeek() {
  const weekDays = [];
  for (let i = 0; i < 7; i++) { const d = new Date(peWeekStart); d.setDate(d.getDate() + i); weekDays.push(d); }
  const weekDayStrs = weekDays.map(peISO);
  const shifts = getPeShifts();
  const weekShifts = shifts.filter(s => weekDayStrs.includes(s.date));
  if (!weekShifts.length) { toast('Aucun créneau cette semaine à dupliquer', 'error'); return; }
  const target = prompt('Dupliquer vers la semaine du (JJ/MM/AAAA) :', peFormatShort(new Date(peWeekStart.getTime() + 7*86400000)));
  if (!target) return;
  const parts = target.split('/');
  if (parts.length !== 3) { toast('Format invalide. Utilisez JJ/MM/AAAA', 'error'); return; }
  const targetDate = new Date(parseInt(parts[2]), parseInt(parts[1])-1, parseInt(parts[0]));
  if (isNaN(targetDate.getTime())) { toast('Date invalide', 'error'); return; }
  const targetMonday = peGetMonday(targetDate);
  const existingStrs = [];
  for (let i = 0; i < 7; i++) { const d = new Date(targetMonday); d.setDate(d.getDate() + i); existingStrs.push(peISO(d)); }
  const existing = shifts.filter(s => existingStrs.includes(s.date));
  if (existing.length && !confirm(existing.length + ' créneaux existent déjà sur la semaine cible. Ajouter quand même ?')) return;
  weekShifts.forEach(s => {
    const oldDate = new Date(s.date + 'T00:00:00');
    const dayOffset = Math.round((oldDate - peWeekStart) / 86400000);
    const newDate = new Date(targetMonday);
    newDate.setDate(newDate.getDate() + dayOffset);
    shifts.push({ ...s, id: 'pe-'+genId(), date: peISO(newDate) });
  });
  setPeShifts(shifts);
  toast('Semaine dupliquée : ' + weekShifts.length + ' créneaux copiés ✓', 'success');
  auditLog('duplication', `Planning équipe — semaine du ${peFormatShort(weekDays[0])} dupliquée vers ${peFormatShort(targetMonday)}`);
}

// ── EXPORT PDF ──
function peExportPDF() {
  window.print();
}

// ── RENDU GRILLE ──
function renderPlanningEquipe() {
  const DAYS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  let weekDays, weekDayStrs, displayLabel;

  if (peViewMode === 'week') {
    weekDays = [];
    for (let i = 0; i < 7; i++) { const d = new Date(peWeekStart); d.setDate(d.getDate() + i); weekDays.push(d); }
    weekDayStrs = weekDays.map(peISO);
    displayLabel = `Semaine du ${peFormatShort(weekDays[0])} au ${peFormatShort(weekDays[6])}/${weekDays[6].getFullYear()}`;
  } else {
    const y = peWeekStart.getFullYear(), m = peWeekStart.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    weekDays = [];
    for (let d = 1; d <= daysInMonth; d++) weekDays.push(new Date(y, m, d));
    weekDayStrs = weekDays.map(peISO);
    displayLabel = `${MONTHS[m]} ${y}`;
  }

  const todayStr = today();
  const canEdit = peCanEditPlanning();

  document.getElementById('peWeekLabel').textContent = displayLabel;
  document.getElementById('peHint').textContent = canEdit ? 'Cliquez sur une case pour ajouter ou modifier un créneau' : '';

  const employes = (DB.get(DB.keys.employes) || []).filter(e => e.statut !== 'inactif');
  const shifts = getPeShifts();
  const shiftsFilt = shifts.filter(s => weekDayStrs.includes(s.date));
  const conges = getPeConges();

  // Stats
  const totalMinsAll = shiftsFilt.reduce((sum,s) => sum + peDuration(s.debut, s.fin), 0);
  const empPlanifies = new Set(shiftsFilt.map(s => s.employeId)).size;
  const nbJoursAvec = weekDayStrs.filter(d => shiftsFilt.some(s => s.date === d)).length;
  const pctCouverture = weekDays.length > 0 ? Math.round((nbJoursAvec / weekDays.length) * 100) : 0;
  document.getElementById('peStats').innerHTML = `
    <div class="stat-mini" style="text-align:center;padding:.5rem;background:var(--g50);border-radius:var(--r-sm)"><div style="font-size:1.1rem;font-weight:800">${peFormatDuration(totalMinsAll)}</div><div style="font-size:.65rem;color:var(--muted)">Total heures</div></div>
    <div class="stat-mini" style="text-align:center;padding:.5rem;background:var(--g50);border-radius:var(--r-sm)"><div style="font-size:1.1rem;font-weight:800">${empPlanifies}</div><div style="font-size:.65rem;color:var(--muted)">Employés planifiés</div></div>
    <div class="stat-mini" style="text-align:center;padding:.5rem;background:var(--g50);border-radius:var(--r-sm)"><div style="font-size:1.1rem;font-weight:800">${nbJoursAvec}/${weekDays.length}</div><div style="font-size:.65rem;color:var(--muted)">Jours couverts</div></div>
    <div class="stat-mini" style="text-align:center;padding:.5rem;background:var(--g50);border-radius:var(--r-sm)"><div style="font-size:1.1rem;font-weight:800;color:${pctCouverture >= 80 ? 'var(--green)' : pctCouverture >= 50 ? 'var(--amber)' : 'var(--red)'}">${pctCouverture}%</div><div style="font-size:.65rem;color:var(--muted)">Couverture</div></div>
  `;

  const byEmp = {};
  shiftsFilt.forEach(s => {
    const key = s.employeId || 'NA';
    (byEmp[key] = byEmp[key] || []).push(s);
  });

  const body = document.getElementById('peGrid').querySelector('.card-body');

  if (!employes.length) {
    body.innerHTML = '<div class="empty" style="padding:3rem;text-align:center"><p>Aucun employé enregistré.</p></div>';
    return;
  }

  const dayHeader = weekDays.map((d,i) => {
    const isToday = weekDayStrs[i] === todayStr;
    const numStyle = isToday ? 'display:inline-block;width:22px;height:22px;line-height:22px;border-radius:50%;background:var(--primary);color:#fff;font-weight:700;margin-top:2px' : 'display:inline-block;margin-top:2px;font-weight:400';
    const dayLabel = peViewMode === 'week' ? DAYS[i] : DAYS[new Date(d).getDay()];
    return `<th style="padding:.6rem .35rem;text-align:center;font-size:.67rem;font-weight:700;color:var(--muted);text-transform:uppercase;min-width:${peViewMode==='week'?'90':'72'}px">${dayLabel}<br/><span style="${numStyle}">${d.getDate()}</span></th>`;
  }).join('');

  const naShifts = byEmp['NA'] || [];
  const naRow = naShifts.length ? `<tr style="border-top:1px solid var(--border);background:var(--g50)">
    <td style="padding:.5rem .75rem;white-space:nowrap">
      <div style="display:flex;align-items:center;gap:.5rem">
        <div style="width:32px;height:32px;border-radius:50%;background:var(--g200);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.65rem;color:var(--muted);flex-shrink:0">NA</div>
        <div style="font-weight:600;font-size:.8rem;color:var(--muted)">Non assignés</div>
      </div>
    </td>
    ${weekDays.map(d => {
      const dateStr = peISO(d);
      const dayShifts = naShifts.filter(s => s.date === dateStr);
      const content = dayShifts.map(s => peShiftBlock(null, dateStr, s, true)).join('');
      return `<td style="padding:.35rem;vertical-align:top">${content || '<span style="color:var(--g300)">—</span>'}</td>`;
    }).join('')}
    <td></td>
  </tr>` : '';

  const empRows = employes.map(emp => {
    const empShifts = byEmp[emp.id] || [];
    const color = emp.color || 'var(--primary)';
    const totalMins = empShifts.reduce((sum,s) => sum + peDuration(s.debut, s.fin), 0);
    const nbJours = weekDays.filter(d => empShifts.some(s => s.date === peISO(d))).length;
    const contractLabel = peViewMode === 'week' ? `${emp.heuresContrat ?? 35}h/sem` : `${nbJours}j présents`;

    // Congés de l'employé
    const empConges = conges.filter(c => {
      if (String(c.employeId) !== String(emp.id)) return false;
      const dDebut = new Date(c.dateDebut + 'T00:00:00');
      const dFin = new Date((c.dateFin || c.dateDebut) + 'T00:00:00');
      return weekDays.some(wd => wd >= dDebut && wd <= dFin);
    });

    const cells = weekDays.map(d => {
      const dateStr = peISO(d);
      const dayShifts = empShifts.filter(s => s.date === dateStr);
      const blocks = dayShifts.map(s => peShiftBlock(emp.id, dateStr, s)).join('');
      const congeDuJour = empConges.filter(c => {
        const dDebut = new Date(c.dateDebut + 'T00:00:00');
        const dFin = new Date((c.dateFin || c.dateDebut) + 'T00:00:00');
        return d >= dDebut && d <= dFin;
      });
      const congeBadge = congeDuJour.length ? `<div style="font-size:.6rem;padding:1px 4px;background:#f59e0b20;color:#f59e0b;border-radius:4px;text-align:center;margin-top:2px">🔶 ${congeDuJour[0].type === 'cp' ? 'Congé' : congeDuJour[0].type || 'Absent'}</div>` : '';
      const addBtn = (canEdit && !dayShifts.length && !congeDuJour.length) ? '<div style="text-align:center;color:var(--g300);font-size:.9rem;line-height:1.4">+</div>' : '';
      return `<td style="padding:.35rem;vertical-align:top"${canEdit ? ` onclick="openPeShiftModal('${emp.id}','${dateStr}')" style="cursor:pointer"` : ''}>${blocks}${congeBadge}${addBtn}</td>`;
    }).join('');

    return `<tr style="border-top:1px solid var(--border)">
      <td style="padding:.5rem .75rem;white-space:nowrap">
        <div style="display:flex;align-items:center;gap:.5rem">
          ${residentPhoto(emp, 32)}
          <div>
            <div style="font-weight:600;font-size:.8rem">${escHtml((emp.prenom||'')+' '+(emp.nom||''))}</div>
            <div style="font-size:.68rem;color:var(--muted)">${contractLabel}</div>
          </div>
        </div>
      </td>
      ${cells}
      <td style="padding:.5rem .75rem;text-align:center;white-space:nowrap">
        <div style="font-weight:700;font-size:.78rem">${peFormatDuration(totalMins)}</div>
        ${peViewMode === 'week' ? `<div style="font-size:.68rem;font-weight:600;color:${totalMins >= (emp.heuresContrat??35)*60 ? 'var(--green)' : 'var(--red)'}">${peFormatSigned(totalMins - (emp.heuresContrat??35)*60)}</div>` : ''}
      </td>
    </tr>`;
  }).join('');

  let grandTotal = 0;
  const footerCells = weekDays.map(d => {
    const dateStr = peISO(d);
    const dayTotal = shiftsFilt.filter(s => s.date === dateStr).reduce((sum,s) => sum + peDuration(s.debut,s.fin), 0);
    grandTotal += dayTotal;
    return `<td style="padding:.5rem .35rem;text-align:center;font-weight:700;font-size:.78rem">${peFormatDuration(dayTotal)}</td>`;
  }).join('');

  body.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:.82rem">
    <thead style="background:var(--g50)">
      <tr>
        <th style="padding:.6rem .75rem;text-align:left;font-size:.67rem;font-weight:700;color:var(--muted);text-transform:uppercase">Employé</th>
        ${dayHeader}
        <th style="padding:.6rem .75rem;text-align:center;font-size:.67rem;font-weight:700;color:var(--muted);text-transform:uppercase">Total</th>
      </tr>
    </thead>
    <tbody>
      ${naRow}
      ${empRows}
      <tr style="border-top:2px solid var(--border);background:var(--g50)">
        <td style="padding:.5rem .75rem;font-weight:700;font-size:.78rem">Heures travaillées</td>
        ${footerCells}
        <td style="padding:.5rem .75rem;text-align:center;font-weight:800;font-size:.8rem">${peFormatDuration(grandTotal)}</td>
      </tr>
    </tbody>
  </table>`;
}

function peShiftBlock(empId, dateStr, s, isNa) {
  const serviceColor = s.service ? (PE_SERVICE_COLORS[s.service] || '') : '';
  const baseColor = serviceColor || s.color || 'var(--primary)';
  const txtColor = isNa ? 'var(--muted)' : baseColor;
  const bgAlpha = serviceColor ? '20' : '12';
  const borderColor = isNa ? 'var(--border)' : (serviceColor ? serviceColor + '55' : (s.color || 'var(--primary)') + '30');
  const label = s.service ? PE_SERVICE_LABELS[s.service] || s.service : (s.debut + '-' + s.fin);
  const bgStyle = isNa ? 'var(--g100)' : (serviceColor ? serviceColor + bgAlpha : `color-mix(in srgb, ${baseColor} 8%, transparent)`);
  return `<div draggable="true" ondragstart="peDragStart(event,'${s.id}')" ondrop="peDrop(event,'${s.id}')" ondragover="event.preventDefault()"
    onclick="event.stopPropagation();${empId ? `openPeShiftModal('${empId}','${dateStr}','${s.id}')` : `openPeShiftModal(null,'${dateStr}','${s.id}')`}"
    style="cursor:pointer;background:${bgStyle};border:1px solid ${borderColor};border-radius:6px;padding:.3rem .4rem;margin-bottom:2px" title="${escHtml(s.notes||'')}">
    <div style="font-size:.7rem;font-weight:700;color:${txtColor}">${escHtml(label)}${s.service ? `<span style="font-weight:400;margin-left:.2rem">${s.debut}-${s.fin}</span>` : ''}</div>
    <div style="font-size:.62rem;font-weight:500;color:${txtColor};opacity:.85">${peFormatDuration(peDuration(s.debut,s.fin))}</div>
    ${s.notes ? `<div style="font-size:.6rem;color:${txtColor};opacity:.7;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(s.notes)}</div>` : ''}
  </div>`;
}

// ── DRAG & DROP ──
let _peDragId = null;
function peDragStart(e, id) { _peDragId = id; e.dataTransfer.effectAllowed = 'move'; }
function peDrop(e, targetId) {
  e.preventDefault();
  if (!_peDragId || _peDragId === targetId) return;
  const shifts = getPeShifts();
  const srcIdx = shifts.findIndex(s => s.id === _peDragId);
  const tgtIdx = shifts.findIndex(s => s.id === targetId);
  if (srcIdx === -1 || tgtIdx === -1) return;
  const temp = shifts[srcIdx];
  shifts[srcIdx] = { ...shifts[tgtIdx], id: shifts[srcIdx].id };
  shifts[tgtIdx] = { ...temp, id: shifts[tgtIdx].id };
  setPeShifts(shifts);
  _peDragId = null;
  renderPlanningEquipe();
}

document.addEventListener('DOMContentLoaded', initPlanningEquipe);
if (typeof registerPageInit === 'function') registerPageInit('planning-equipe', initPlanningEquipe);
