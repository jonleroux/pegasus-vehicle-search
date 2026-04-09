const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const XLSX = require('xlsx');

const app = express();
app.use(cors());
app.use(express.json());

// ── Data directory — uses env var for Railway volume, falls back to ./data ──
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const METADATA_FILE = path.join(DATA_DIR, 'metadata.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── Source config ──
const SOURCES = {
  campers4sale:   { label: 'Campers4Sale.co.uk',    file: 'campers4sale.xls' },
  autotrader:     { label: 'AutoTrader',             file: 'autotrader.xls'  },
  outandaboutlive:{ label: 'OutAndAboutLive.co.uk',  file: 'outandaboutlive.xls' },
};

// ── Metadata helpers ──
function readMetadata() {
  try {
    if (fs.existsSync(METADATA_FILE)) return JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
  } catch {}
  return {};
}

function writeMetadata(meta) {
  fs.writeFileSync(METADATA_FILE, JSON.stringify(meta, null, 2));
}

// ── Spreadsheet parsing ──
function parseFeatures(featuresStr) {
  if (!featuresStr || typeof featuresStr !== 'string') return {};
  const parts = featuresStr.split(',').map(s => s.trim());
  const result = {};
  for (let i = 0; i < parts.length - 1; i += 2) {
    const key = parts[i].toLowerCase();
    const value = parts[i + 1];
    if (key === 'make')         result.make = value;
    else if (key === 'transmission') result.transmission = value;
    else if (key === 'year')    result.year = value;
    else if (key === 'mileage') result.mileage = value;
    else if (key === 'fuel type') result.fuel = value;
    else if (key === 'berth')   result.berths = value;
    else if (key === 'exterior') result.colour = value;
    else if (key === 'condition') result.condition = value;
  }
  return result;
}

function cleanPrice(priceStr) {
  if (!priceStr && priceStr !== 0) return null;
  const s = String(priceStr).replace(/[¬Â£$€,\s]/g, '').replace(/[^\d.]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? null : Math.round(n);
}

function extractYearFromTitle(title) {
  const m = title && title.match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : null;
}

function parseMileage(str) {
  if (!str) return null;
  const m = String(str).replace(/,/g, '').match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function detectSource(url) {
  if (!url) return null;
  if (url.includes('campers4sale'))      return 'Campers4Sale.co.uk';
  if (url.includes('autotrader'))        return 'AutoTrader';
  if (url.includes('outandaboutlive'))   return 'OutAndAboutLive.co.uk';
  return null;
}

function parseSpreadsheet(filePath, fallbackSource) {
  const workbook = XLSX.readFile(filePath);
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
  return rows.map(row => {
    const title = String(row['Vehicle Title'] || '');
    const features = parseFeatures(row['Features'] || '');
    const url = String(row['Vehicle link'] || '');
    const priceRaw = row['Price'];
    const priceNum = cleanPrice(priceRaw);
    const year = features.year || extractYearFromTitle(title);
    const mileage = features.mileage || null;
    const mileageNum = parseMileage(mileage);
    const source = detectSource(url) || fallbackSource;
    return {
      title,
      price: priceNum ? `£${priceNum.toLocaleString('en-GB')}` : String(priceRaw || '').replace(/[¬Â]/g, ''),
      priceNum,
      year: year || 'N/A',
      mileage: mileage || 'N/A',
      mileageNum,
      fuel: features.fuel || 'N/A',
      transmission: features.transmission || 'N/A',
      colour: features.colour || 'N/A',
      berths: features.berths || 'N/A',
      source,
      url,
      make: features.make || '',
      _searchText: [title, row['Description'] || '', row['Features'] || ''].join(' ').toLowerCase(),
    };
  });
}

// ── Load all spreadsheets ──
let vehicleData = {}; // { campers4sale: [...], autotrader: [...], ... }

function loadAll() {
  vehicleData = {};
  for (const [key, cfg] of Object.entries(SOURCES)) {
    const filePath = path.join(DATA_DIR, cfg.file);
    if (fs.existsSync(filePath)) {
      try {
        vehicleData[key] = parseSpreadsheet(filePath, cfg.label);
        console.log(`Loaded ${vehicleData[key].length} vehicles from ${cfg.file}`);
      } catch (err) {
        console.error(`Error loading ${cfg.file}:`, err.message);
        vehicleData[key] = [];
      }
    } else {
      vehicleData[key] = [];
    }
  }
  const total = Object.values(vehicleData).reduce((s, a) => s + a.length, 0);
  console.log(`Total vehicles loaded: ${total}`);
}

loadAll();

// ── Search / filter logic ──
function getAllVehicles() {
  return Object.values(vehicleData).flat();
}

function filterVehicles({ mode, sources, criteria, excludeUrls }) {
  // Map display names to keys
  const sourceKeys = Object.entries(SOURCES)
    .filter(([, cfg]) => sources.includes(cfg.label))
    .map(([key]) => key);

  let results = sourceKeys.length > 0
    ? sourceKeys.flatMap(k => vehicleData[k] || [])
    : getAllVehicles();

  console.log(`Starting with ${results.length} vehicles from sources: ${sourceKeys.join(', ')}`);

  if (excludeUrls?.length) {
    const ex = new Set(excludeUrls);
    results = results.filter(v => !ex.has(v.url));
  }

  if (criteria.make) {
    const make = criteria.make.toLowerCase();
    results = results.filter(v =>
      v.make.toLowerCase().includes(make) || v.title.toLowerCase().includes(make)
    );
    console.log(`After make (${make}): ${results.length}`);
  }

  if (criteria.model) {
    const model = criteria.model.toLowerCase();
    results = results.filter(v =>
      v.title.toLowerCase().includes(model) || v._searchText.includes(model)
    );
    console.log(`After model (${model}): ${results.length}`);
  }

  if (criteria.budget) {
    const budget = cleanPrice(criteria.budget);
    if (budget) {
      results = results.filter(v => !v.priceNum || v.priceNum <= budget * 1.1);
      console.log(`After budget (£${budget}): ${results.length}`);
    }
  }

  if (criteria.yearFrom) {
    const yr = parseInt(criteria.yearFrom, 10);
    if (!isNaN(yr)) {
      results = results.filter(v => { const vy = parseInt(v.year, 10); return isNaN(vy) || vy >= yr; });
      console.log(`After yearFrom (${yr}): ${results.length}`);
    }
  }

  if (criteria.maxMileage) {
    const max = parseInt(String(criteria.maxMileage).replace(/,/g, ''), 10);
    if (!isNaN(max)) {
      results = results.filter(v => !v.mileageNum || v.mileageNum <= max);
      console.log(`After maxMileage (${max}): ${results.length}`);
    }
  }

  if (criteria.notes) {
    const keywords = criteria.notes.toLowerCase().split(/[\s,]+/).filter(w => w.length > 2);
    if (keywords.length) {
      results = results.filter(v => keywords.some(kw => v._searchText.includes(kw)));
      console.log(`After notes keywords: ${results.length}`);
    }
  }

  // Add concerns / why
  const budget = criteria.budget ? cleanPrice(criteria.budget) : null;
  results = results.map(v => ({
    ...v,
    why: `Matches search criteria${v.make ? ` — ${v.make}` : ''}`,
    concerns: budget && v.priceNum && v.priceNum > budget
      ? `Price (${v.price}) is £${(v.priceNum - budget).toLocaleString('en-GB')} over budget`
      : 'None',
  }));

  const limit = mode === 'live' ? 5 : 1;
  results = results.slice(0, limit);

  // Strip internal fields
  return results.map(({ _searchText, priceNum, mileageNum, make, ...v }) => v);
}

// ── Multer — store uploads temporarily then move ──
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const ok = /\.(xls|xlsx|csv)$/i.test(file.originalname);
    cb(ok ? null : new Error('Only .xls, .xlsx, or .csv files accepted'), ok);
  },
});

// ── API Routes ──

app.post('/api/search', (req, res) => {
  try {
    const { mode, sources, criteria, excludeUrls } = req.body;
    if (!sources?.length) return res.status(400).json({ error: 'Select at least one source' });
    console.log('--- Search ---', { mode, sources, criteria });
    const vehicles = filterVehicles({ mode, sources, criteria, excludeUrls });
    console.log(`Returning ${vehicles.length} vehicles`);
    res.json({ vehicles });
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/upload/:source', upload.single('file'), (req, res) => {
  const { source } = req.params;
  if (!SOURCES[source]) return res.status(400).json({ error: 'Unknown source' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    const destFile = path.join(DATA_DIR, source + ext);

    // Remove old files for this source (any extension)
    for (const oldExt of ['.xls', '.xlsx', '.csv']) {
      const old = path.join(DATA_DIR, source + oldExt);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }

    fs.writeFileSync(destFile, req.file.buffer);

    // Parse and reload just this source
    const parsed = parseSpreadsheet(destFile, SOURCES[source].label);
    vehicleData[source] = parsed;

    // Update metadata
    const meta = readMetadata();
    meta[source] = { uploadedAt: new Date().toISOString(), count: parsed.length, filename: req.file.originalname };
    writeMetadata(meta);

    console.log(`Uploaded ${parsed.length} vehicles for ${source}`);
    res.json({ count: parsed.length, source: SOURCES[source].label });
  } catch (err) {
    console.error('Upload error:', err.message);
    res.status(500).json({ error: 'Failed to process file: ' + err.message });
  }
});

app.get('/api/stats', (req, res) => {
  const meta = readMetadata();
  const sources = Object.entries(SOURCES).map(([key, cfg]) => ({
    key,
    label: cfg.label,
    count: (vehicleData[key] || []).length,
    uploadedAt: meta[key]?.uploadedAt || null,
    filename: meta[key]?.filename || null,
  }));
  const total = sources.reduce((s, x) => s + x.count, 0);
  res.json({ total, sources });
});

app.post('/api/reload', (req, res) => {
  loadAll();
  const total = getAllVehicles().length;
  res.json({ count: total, message: `Reloaded ${total} vehicles` });
});

// ── Serve built React frontend in production ──
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

const PORT = process.env.SERVER_PORT || process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Pegasus Vehicle Search API running on port ${PORT}`));
