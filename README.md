# Resident Damp & Mould Reporting (Awaab’s Law aligned)

A lightweight Node/Express app to let residents report damp, mould, and related housing hazards, aligned with the intent of Awaab’s Law timelines. Submissions are stored locally in SQLite, with evidence uploads, an admin tracker, configurable deadlines, and a printable landlord letter generator.

> This tool is informational and not legal advice. Timelines are indicative and may change based on final regulations and local policy.

## Features
- Resident submission form with photos (up to 6 images)
- Stores reports in SQLite; saves images to `uploads/`
- Calculates indicative deadlines:
  - Investigate within N days
  - Start repairs within N days after investigation
  - Emergency make-safe within N hours (if immediate danger)
- Admin list and detail view to update status and add notes
- Printable letter generator referencing the applicable timelines

## Tech stack
- Express (API + static hosting)
- better-sqlite3 (zero-ORM, file-based DB)
- Multer (multipart uploads)
- Day.js (dates)
- Vanilla HTML/CSS/JS (no build step)

## Getting started
1. Prerequisites: Node.js 18+
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Open the app:
   - Resident form: http://localhost:3000/
   - Admin tracker: http://localhost:3000/admin

To auto-reload during development:
```bash
npm run dev
```

## Configuration
Timelines can be adjusted via environment variables (defaults in `app/config.js`):
- `AWAABS_LAW_INVESTIGATE_DAYS` (default: 14)
- `AWAABS_LAW_START_REPAIRS_DAYS` (default: 7)
- `AWAABS_LAW_EMERGENCY_HOURS` (default: 24)
- `PORT` (default: 3000)

Example:
```bash
AWAABS_LAW_INVESTIGATE_DAYS=14 AWAABS_LAW_START_REPAIRS_DAYS=7 AWAABS_LAW_EMERGENCY_HOURS=24 npm start
```

## Project structure
- `app/index.js` — Express server and REST API
- `app/db.js` — SQLite schema and connection
- `app/config.js` — Timelines, disclaimers, ports
- `public/` — Static frontend (resident and admin pages)
- `uploads/` — Stored evidence files
- `data/app.db` — SQLite database (created at runtime)

## API overview
- `POST /api/reports` — Create a report (multipart); field names:
  - `residentName`, `contactEmail`, `contactPhone`
  - `addressLine1`, `addressLine2`, `postcode` (required with `description`)
  - `landlordName`, `landlordEmail`
  - `category` (e.g., Damp, Mould, Leak…), `severity` (Low/Medium/High)
  - `description` (required)
  - `immediateDanger`, `vulnerablePersons`, `consentToShare` (checkbox/boolean)
  - `photos` (multiple files)
- `GET /api/reports` — List reports
- `GET /api/reports/:id` — Report details (files and notes)
- `PATCH /api/reports/:id` — Update status/flags
- `POST /api/reports/:id/notes` — Add an internal note
- `GET /api/reports/:id/letter` — Printable landlord letter
- `GET /api/config` — Timelines and disclaimers

## Data and privacy
- Reports and notes are saved to `data/app.db` (SQLite)
- Uploaded images are stored in `uploads/` and served at `/uploads/<file>`
- Do not deploy publicly without appropriate privacy, authentication, and data retention controls

## Roadmap ideas
- Authentication for admin
- Email integration (send letter directly)
- Council notifications and export
- PWA/offline form and multi-language support

## License
MIT
