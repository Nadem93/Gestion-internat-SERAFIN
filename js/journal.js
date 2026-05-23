let selectedEntryId = null;

function populateSelects() {
  const residents = (DB.get(DB.keys.residents) || []).filter(r => r.statut !== 'sorti');
  const cats = DB.get(DB.keys.categories) || [];
  const objs = DB.get(DB.keys.objectives) || [];

  const rSel = document.getElementById('eResident');
  const rFilter = document.getElementById('jFilterResident');
  residents.forEach(r => {
    const name = `${r.prenom || ''} ${r.nom || ''}`.trim();
    [rSel, rFilter].forEach(sel => { const o = document.createElement('option'); o.value = r.id; o.textContent = name; sel.appendChild(o); });
  });

  const cSel = document.getElementById('eCategorie');
  const cFilter = document.getElementById('jFilterCat');
  cats.forEach(c => {
    [cSel, cFilter].forEach(sel => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; sel.appendChild(o); });
  });

  const oSel = document.getElementById('eObjectif');
  objs.forEach(o => { const opt = document.createElement('option'); opt.value = o.id; opt.textContent = o.name; oSel.appendChild(opt); });
}

function getEntries() {
  const q = (document.getElementById('jSearch')?.value || '').toLowerCase();
  const res = document.getElementById('jFilterResident')?.value || '';
  const cat = document.getElementById('jFilterCat')?.value || '';
  const date = document.getElementById('jFilterDate')?.value || '';
  let list = (DB.get(DB.keys.journal) || []).slice().reverse();
  if (q) list = list.filter(e => (e.contenu || '').toLowerCase().includes(q) || (e.resident || '').toLowerCase().includes(q));
  if (res) list = list.filter(e => e.residentId === res);
  if (cat) list = list.filter(e => String(e.categorie) === String(cat));
  if (date) list = list.filter(e => e.date && e.date.startsWith(date));
  return list;
}

function renderEntries() {
  const list = getEntries();
  const el = document.getElementById('entriesList');
  const countEl = document.getElementById('journalCount');
  countEl.textContent = `${list.length} entrée${list.length > 1 ? 's' : ''}`;
  const cats = DB.get(DB.keys.categories) || [];
  if (!list.length) {
    el.innerHTML = `<div class="empty" style="padding:2rem"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></div><h3>Aucune entrée</h3><p>Commencez à documenter les événements.</p></div>`;
    return;
  }
  el.innerHTML = list.map(e => {
    const cat = cats.find(c => String(c.id) === String(e.categorie));
    return `<div class="entry-card ${e.id === selectedEntryId ? 'selected' : ''}" onclick="selectEntry('${e.id}')">
      <div class="entry-header">
        <div class="avatar sm" style="background:${e.residentColor||'var(--blue)'};flex-shrink:0">${(e.resident||'?')[0].toUpperCase()}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
            <span style="font-weight:700;font-size:.875rem">${e.resident||'—'}</span>
            ${cat ? `<span class="badge" style="background:${cat.color}22;color:${cat.color}">${cat.name}</span>` : ''}
            ${e.visibilite === 'confidentiel' ? '<span class="badge badge-red">Confidentiel</span>' : ''}
          </div>
          <div class="entry-meta">${formatDateTime(e.date)}</div>
        </div>
      </div>
      <div class="entry-preview">${e.contenu||''}</div>
    </div>`;
  }).join('');
}

function selectEntry(id) {
  selectedEntryId = id;
  const entries = DB.get(DB.keys.journal) || [];
  const e = entries.find(x => x.id === id);
  if (!e) return;
  const cats = DB.get(DB.keys.categories) || [];
  const objs = DB.get(DB.keys.objectives) || [];
  const cat = cats.find(c => String(c.id) === String(e.categorie));
  const obj = objs.find(o => String(o.id) === String(e.objectif));
  const vis = { equipe: 'Équipe uniquement', tous: 'Tous', confidentiel: 'Confidentiel' };

  document.getElementById('entryDetail').innerHTML = `
    <div class="entry-detail fade-in">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:1rem;gap:.5rem">
        <div>
          <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.3rem">
            <span style="font-weight:800;font-size:1rem">${e.resident||'—'}</span>
            ${cat ? `<span class="badge" style="background:${cat.color}22;color:${cat.color};border:1px solid ${cat.color}44">${cat.name}</span>` : ''}
          </div>
          <div style="font-size:.78rem;color:var(--muted)">${formatDateTime(e.date)} · ${vis[e.visibilite]||''}</div>
          ${obj ? `<div style="font-size:.78rem;color:var(--purple);margin-top:3px">Objectif : ${obj.name}</div>` : ''}
        </div>
        <div style="display:flex;gap:.4rem;flex-shrink:0">
          <button class="btn btn-ghost btn-sm" onclick="editEntry('${e.id}')">Modifier</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="deleteEntryById('${e.id}')">Supprimer</button>
        </div>
      </div>
      <div class="divider"></div>
      <p style="font-size:.9rem;line-height:1.8;white-space:pre-wrap;color:var(--text)">${e.contenu||''}</p>
    </div>`;
  renderEntries();
}

function editEntry(id) {
  const entries = DB.get(DB.keys.journal) || [];
  const e = entries.find(x => x.id === id);
  if (!e) return;
  document.getElementById('modalEntryTitle').textContent = 'Modifier l\'entrée';
  document.getElementById('entryId').value = id;
  document.getElementById('eResident').value = e.residentId || '';
  document.getElementById('eCategorie').value = e.categorie || '';
  document.getElementById('eDate').value = e.date ? e.date.slice(0,16) : '';
  document.getElementById('eObjectif').value = e.objectif || '';
  document.getElementById('eContenu').value = e.contenu || '';
  const vis = document.querySelector(`input[name="eVisibilite"][value="${e.visibilite||'equipe'}"]`);
  if (vis) vis.checked = true;
  document.getElementById('btnDeleteEntry').style.display = '';
  openModal('modalEntry');
}

function saveEntry() {
  const residentId = document.getElementById('eResident').value;
  const contenu = document.getElementById('eContenu').value.trim();
  if (!residentId) { toast('Sélectionnez un résident', 'error'); return; }
  if (!contenu) { toast('Le contenu est requis', 'error'); return; }

  const residents = DB.get(DB.keys.residents) || [];
  const res = residents.find(r => r.id === residentId);
  const visEl = document.querySelector('input[name="eVisibilite"]:checked');

  const data = {
    residentId,
    resident: res ? `${res.prenom||''} ${res.nom||''}`.trim() : '',
    residentColor: res?.color || 'var(--blue)',
    categorie: document.getElementById('eCategorie').value,
    date: document.getElementById('eDate').value || new Date().toISOString(),
    objectif: document.getElementById('eObjectif').value,
    contenu,
    visibilite: visEl?.value || 'equipe',
    updatedAt: new Date().toISOString()
  };

  let entries = DB.get(DB.keys.journal) || [];
  const id = document.getElementById('entryId').value;
  if (id) {
    entries = entries.map(e => e.id === id ? { ...e, ...data } : e);
    toast('Entrée mise à jour');
  } else {
    data.id = genId();
    data.createdAt = new Date().toISOString();
    entries.push(data);
    toast('Entrée ajoutée');
  }
  DB.set(DB.keys.journal, entries);
  closeAllModals();
  resetEntryForm();
  renderEntries();
  if (id) selectEntry(id);
}

function deleteEntry() { deleteEntryById(document.getElementById('entryId').value); }

function deleteEntryById(id) {
  confirmDialog('Supprimer cette entrée ?', () => {
    let entries = DB.get(DB.keys.journal) || [];
    entries = entries.filter(e => e.id !== id);
    DB.set(DB.keys.journal, entries);
    closeAllModals();
    selectedEntryId = null;
    document.getElementById('entryDetail').innerHTML = `<div class="entry-detail" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:300px;color:var(--muted)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;margin-bottom:1rem;opacity:.3"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg><p style="font-size:.875rem">Sélectionnez une entrée pour la lire</p></div>`;
    resetEntryForm();
    renderEntries();
    toast('Entrée supprimée', 'info');
  });
}

function resetEntryForm() {
  document.getElementById('entryId').value = '';
  document.getElementById('modalEntryTitle').textContent = 'Nouvelle entrée';
  document.getElementById('eResident').value = '';
  document.getElementById('eCategorie').value = '';
  document.getElementById('eDate').value = new Date().toISOString().slice(0,16);
  document.getElementById('eObjectif').value = '';
  document.getElementById('eContenu').value = '';
  document.querySelector('input[name="eVisibilite"][value="equipe"]').checked = true;
  document.getElementById('btnDeleteEntry').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('eDate').value = new Date().toISOString().slice(0,16);
  populateSelects();
  renderEntries();
  ['jSearch','jFilterResident','jFilterCat','jFilterDate'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', renderEntries);
    document.getElementById(id)?.addEventListener('change', renderEntries);
  });
});
