const tableBody = document.querySelector('#reportsTable tbody');
const detail = document.getElementById('detail');
const search = document.getElementById('search');

function fmt(iso) { try { return new Date(iso).toLocaleString(); } catch { return iso || ''; } }

async function loadReports() {
  const resp = await fetch('/api/reports');
  const rows = await resp.json();
  renderRows(rows);
}

function renderRows(rows) {
  const q = (search.value || '').trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (!q) return true;
    return (r.postcode || '').toLowerCase().includes(q) || (r.category || '').toLowerCase().includes(q);
  });
  tableBody.innerHTML = filtered.map(r => `
    <tr data-id="${r.id}">
      <td>#${r.id}</td>
      <td>${fmt(r.created_at)}</td>
      <td>${r.postcode || ''}</td>
      <td>${r.category || ''}</td>
      <td>${r.severity || ''}</td>
      <td><span class="badge">${r.status}</span></td>
      <td>${fmt(r.deadline_investigate)}</td>
      <td>${fmt(r.deadline_start_repairs)}</td>
      <td>${r.deadline_emergency ? fmt(r.deadline_emergency) : '—'}</td>
    </tr>
  `).join('');
}

async function loadDetail(id) {
  const resp = await fetch(`/api/reports/${id}`);
  if (!resp.ok) { detail.classList.add('hidden'); return; }
  const r = await resp.json();
  detail.classList.remove('hidden');
  detail.innerHTML = `
    <h2>Case #${r.id}</h2>
    <div class="grid">
      <div><strong>Status:</strong> <span class="badge">${r.status}</span></div>
      <div><strong>Postcode:</strong> ${r.postcode || ''}</div>
      <div><strong>Category:</strong> ${r.category || ''}</div>
      <div><strong>Severity:</strong> ${r.severity || ''}</div>
      <div><strong>Created:</strong> ${fmt(r.created_at)}</div>
      <div><strong>Updated:</strong> ${fmt(r.updated_at)}</div>
    </div>
    <p><strong>Description:</strong><br/>${(r.description || '').replace(/</g, '&lt;')}</p>
    <div class="grid">
      <div><strong>Investigate by:</strong> ${fmt(r.deadline_investigate)}</div>
      <div><strong>Start repairs by:</strong> ${fmt(r.deadline_start_repairs)}</div>
      <div><strong>Emergency by:</strong> ${r.deadline_emergency ? fmt(r.deadline_emergency) : '—'}</div>
    </div>

    <h3>Resident</h3>
    <div class="grid">
      <div>${r.resident_name || ''}</div>
      <div>${r.contact_email || ''}</div>
      <div>${r.contact_phone || ''}</div>
    </div>

    <h3>Files</h3>
    <div class="files">${(r.files || []).length ? r.files.map(f => `<a href="${f.url_path}" target="_blank" rel="noopener">${f.original_name || f.url_path}</a>`).join(' ') : '<em>No files uploaded</em>'}</div>

    <h3>Update status</h3>
    <form id="statusForm" class="grid">
      <label>
        <span>New status</span>
        <select name="status">
          ${['open','investigating','in_progress','resolved','closed'].map(s => `<option value="${s}" ${s===r.status?'selected':''}>${s}</option>`).join('')}
        </select>
      </label>
      <button type="submit">Save</button>
      <a class="button secondary" href="/api/reports/${r.id}/letter" target="_blank" rel="noopener">Open letter</a>
    </form>

    <h3>Add note</h3>
    <form id="noteForm">
      <div class="grid">
        <label>
          <span>Author</span>
          <input name="author" type="text" />
        </label>
      </div>
      <label>
        <span>Note</span>
        <textarea name="content" rows="3" required></textarea>
      </label>
      <div class="actions"><button type="submit">Add note</button></div>
    </form>

    <h3>Notes</h3>
    <div class="notes">
      ${ (r.notes || []).length ? r.notes.map(n => `
        <div class="note">
          <div class="meta">${fmt(n.created_at)}${n.author ? ` • ${n.author}` : ''}</div>
          <div>${(n.content || '').replace(/</g, '&lt;')}</div>
        </div>
      `).join('') : '<em>No notes</em>'}
    </div>
  `;

  const statusForm = document.getElementById('statusForm');
  statusForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(statusForm);
    const status = fd.get('status');
    const btn = statusForm.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const resp = await fetch(`/api/reports/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      if (!resp.ok) throw new Error((await resp.json()).error || 'Failed');
      await loadDetail(r.id);
      await loadReports();
    } catch (err) { alert(err.message || 'Failed'); } finally { btn.disabled = false; btn.textContent = 'Save'; }
  });

  const noteForm = document.getElementById('noteForm');
  noteForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(noteForm);
    const content = fd.get('content');
    const author = fd.get('author');
    const btn = noteForm.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Adding…';
    try {
      const resp = await fetch(`/api/reports/${r.id}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, author }) });
      if (!resp.ok) throw new Error((await resp.json()).error || 'Failed');
      noteForm.reset();
      await loadDetail(r.id);
    } catch (err) { alert(err.message || 'Failed'); } finally { btn.disabled = false; btn.textContent = 'Add note'; }
  });
}

// Row click -> load detail
document.addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-id]');
  if (tr) loadDetail(tr.dataset.id);
});

search?.addEventListener('input', async () => {
  const resp = await fetch('/api/reports');
  const rows = await resp.json();
  renderRows(rows);
});

loadReports();
