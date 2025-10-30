const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const dayjs = require('dayjs');
const crypto = require('crypto');

const db = require('./db');
const config = require('./config');

const app = express();

// Middleware
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Static assets
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Multer setup for file uploads
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBase = path.basename(file.originalname, ext).replace(/[^a-z0-9_-]+/gi, '-').slice(0, 50);
    const name = `${dayjs().format('YYYYMMDD-HHmmss')}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}-${safeBase}${ext}`;
    cb(null, name);
  }
});
const allowedMimes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 6 },
  fileFilter: (req, file, cb) => {
    if (!allowedMimes.has(file.mimetype)) {
      return cb(new Error('Only image files (jpg, png, webp, gif) are allowed'));
    }
    cb(null, true);
  }
});

function toBool(value) {
  if (typeof value === 'boolean') return value;
  const v = String(value || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'on' || v === 'yes';
}

function computeDeadlines(immediateDanger, createdAtIso) {
  const created = dayjs(createdAtIso);
  const investigateBy = created.add(config.deadlines.investigateDays, 'day').toISOString();
  const startRepairsBy = created.add(config.deadlines.investigateDays + config.deadlines.startRepairsDays, 'day').toISOString();
  const emergencyBy = immediateDanger ? created.add(config.deadlines.emergencyHours, 'hour').toISOString() : null;
  return { investigateBy, startRepairsBy, emergencyBy };
}

// Routes
app.get('/api/config', (req, res) => {
  res.json({ deadlines: config.deadlines, disclaimers: config.disclaimers });
});

app.post('/api/reports', upload.array('photos', 6), (req, res) => {
  try {
    const now = dayjs().toISOString();
    const {
      residentName,
      contactEmail,
      contactPhone,
      addressLine1,
      addressLine2,
      postcode,
      landlordName,
      landlordEmail,
      category,
      severity,
      description,
      immediateDanger,
      vulnerablePersons,
      consentToShare
    } = req.body;

    if (!description || !postcode) {
      return res.status(400).json({ error: 'Please provide at least description and postcode.' });
    }

    const immediate = toBool(immediateDanger);
    const deadlines = computeDeadlines(immediate, now);

    const insertReport = db.prepare(`
      INSERT INTO reports (
        created_at, updated_at,
        resident_name, contact_email, contact_phone,
        address_line1, address_line2, postcode,
        landlord_name, landlord_email,
        category, severity, description,
        immediate_danger, vulnerable_persons, consent_to_share,
        status, deadline_investigate, deadline_start_repairs, deadline_emergency
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)
    `);

    const result = insertReport.run(
      now, now,
      residentName || null, contactEmail || null, contactPhone || null,
      addressLine1 || null, addressLine2 || null, postcode || null,
      landlordName || null, landlordEmail || null,
      category || null, severity || null, description,
      immediate ? 1 : 0, toBool(vulnerablePersons) ? 1 : 0, toBool(consentToShare) ? 1 : 0,
      deadlines.investigateBy, deadlines.startRepairsBy, deadlines.emergencyBy
    );

    const reportId = result.lastInsertRowid;

    if (req.files?.length) {
      const insertFile = db.prepare(`
        INSERT INTO report_files (report_id, stored_name, original_name, mime_type, file_size, url_path, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const file of req.files) {
        const urlPath = `/uploads/${file.filename}`;
        insertFile.run(reportId, file.filename, file.originalname, file.mimetype, file.size, urlPath, now);
      }
    }

    res.status(201).json({
      id: reportId,
      status: 'open',
      deadlines: {
        investigateBy: deadlines.investigateBy,
        startRepairsBy: deadlines.startRepairsBy,
        emergencyBy: deadlines.emergencyBy
      },
      message: 'Report submitted successfully.'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

app.get('/api/reports', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, created_at, updated_at, postcode, category, severity, status,
             deadline_investigate, deadline_start_repairs, deadline_emergency
      FROM reports
      ORDER BY created_at DESC
    `).all();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

app.get('/api/reports/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
    if (!report) return res.status(404).json({ error: 'Not found' });
    const files = db.prepare('SELECT id, original_name, url_path, mime_type, file_size, created_at FROM report_files WHERE report_id = ? ORDER BY id').all(id);
    const notes = db.prepare('SELECT id, author, content, created_at FROM notes WHERE report_id = ? ORDER BY created_at DESC').all(id);
    res.json({ ...report, files, notes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

app.patch('/api/reports/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body || {};
    const now = dayjs().toISOString();

    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
    if (!report) return res.status(404).json({ error: 'Not found' });

    const fields = [];
    const values = [];

    if (body.status) { fields.push('status = ?'); values.push(String(body.status)); }
    if (typeof body.immediate_danger !== 'undefined') { fields.push('immediate_danger = ?'); values.push(toBool(body.immediate_danger) ? 1 : 0); }

    // Optionally recompute deadlines if immediate danger changed
    if (typeof body.immediate_danger !== 'undefined') {
      const deadlines = computeDeadlines(toBool(body.immediate_danger), report.created_at);
      fields.push('deadline_emergency = ?');
      values.push(deadlines.emergencyBy);
    }

    if (!fields.length) return res.status(400).json({ error: 'No updatable fields provided' });

    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    const sql = `UPDATE reports SET ${fields.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...values);

    const updated = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

app.post('/api/reports/:id/notes', (req, res) => {
  try {
    const id = Number(req.params.id);
    const report = db.prepare('SELECT id FROM reports WHERE id = ?').get(id);
    if (!report) return res.status(404).json({ error: 'Not found' });
    const { content, author } = req.body || {};
    if (!content) return res.status(400).json({ error: 'Note content is required' });
    const now = dayjs().toISOString();
    const result = db.prepare('INSERT INTO notes (report_id, created_at, author, content) VALUES (?, ?, ?, ?)').run(id, now, author || null, content);
    res.status(201).json({ id: result.lastInsertRowid, report_id: id, created_at: now, author: author || null, content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

app.get('/api/reports/:id/letter', (req, res) => {
  try {
    const id = Number(req.params.id);
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
    if (!report) return res.status(404).send('Not found');

    const created = dayjs(report.created_at).format('D MMM YYYY');
    const investigateBy = report.deadline_investigate ? dayjs(report.deadline_investigate).format('D MMM YYYY') : 'N/A';
    const startRepairsBy = report.deadline_start_repairs ? dayjs(report.deadline_start_repairs).format('D MMM YYYY') : 'N/A';
    const emergencyBy = report.deadline_emergency ? dayjs(report.deadline_emergency).format('D MMM YYYY HH:mm') : null;

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Report Letter — Case #${report.id}</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 24px; line-height: 1.5; }
    h1 { font-size: 20px; }
    .meta { color: #555; margin-bottom: 16px; }
    .box { border: 1px solid #ddd; padding: 16px; border-radius: 8px; }
    ul { padding-left: 18px; }
    .muted { color: #777; font-size: 12px; margin-top: 24px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; background: #eef; color: #224; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Report of Damp and Mould — Case #${report.id}</h1>
  <div class="meta">Created ${created}${report.postcode ? ` • ${report.postcode}` : ''}${report.category ? ` • ${report.category}` : ''}</div>
  <div class="box">
    <p>Dear ${report.landlord_name || 'Housing Provider'},</p>
    <p>I am reporting damp and/or mould affecting my home at ${[report.address_line1, report.address_line2, report.postcode].filter(Boolean).join(', ')}.</p>
    <p><strong>Issue description:</strong> ${report.description.replace(/</g, '&lt;')}</p>
    <p><strong>Risk priority (Awaab's Law):</strong></p>
    <ul>
      <li>Investigate within ${config.deadlines.investigateDays} days (by ${investigateBy}).</li>
      <li>Start repairs within ${config.deadlines.startRepairsDays} days after investigation (by ${startRepairsBy}).</li>
      ${emergencyBy ? `<li><span class="badge">Emergency</span> Make safe within ${config.deadlines.emergencyHours} hours (by ${emergencyBy}).</li>` : ''}
    </ul>
    <p>Please confirm the investigation appointment and provide a schedule for remedial works.</p>
    <p>Yours faithfully,</p>
    <p>${report.resident_name || ''}${report.contact_email ? `<br/>${report.contact_email}` : ''}${report.contact_phone ? `<br/>${report.contact_phone}` : ''}</p>
  </div>
  <p class="muted">${config.disclaimers.awaabsLaw}</p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to generate letter');
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

// Generic error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

const port = config.app.port;
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
