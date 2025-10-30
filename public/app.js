const form = document.getElementById('reportForm');
const resultEl = document.getElementById('result');

function fmtDate(iso) {
  if (!iso) return 'N/A';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function renderResult(payload) {
  const { id, deadlines } = payload;
  resultEl.classList.remove('hidden');
  resultEl.innerHTML = `
    <h2>Report submitted</h2>
    <p>Your case reference is <strong>#${id}</strong>.</p>
    <div class="grid-3">
      <div class="stat">
        <div class="label">Investigate by</div>
        <div class="value">${fmtDate(deadlines?.investigateBy)}</div>
      </div>
      <div class="stat">
        <div class="label">Start repairs by</div>
        <div class="value">${fmtDate(deadlines?.startRepairsBy)}</div>
      </div>
      <div class="stat">
        <div class="label">Emergency make-safe by</div>
        <div class="value">${deadlines?.emergencyBy ? fmtDate(deadlines.emergencyBy) : '—'}</div>
      </div>
    </div>
    <div class="actions">
      <a class="button" href="/api/reports/${id}/letter" target="_blank" rel="noopener">Open letter to landlord</a>
      <a class="button secondary" href="/admin" target="_blank" rel="noopener">Open admin tracker</a>
    </div>
  `;
  resultEl.scrollIntoView({ behavior: 'smooth' });
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting…';

  try {
    const resp = await fetch('/api/reports', { method: 'POST', body: fd });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.error || 'Failed to submit');
    renderResult(data);
    form.reset();
  } catch (err) {
    alert(err.message || 'Failed to submit');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit report';
  }
});
