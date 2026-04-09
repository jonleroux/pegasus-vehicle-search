import React, { useState, useEffect, useRef } from 'react';
import { LENDERS } from './lenders.js';

const SEARCH_SOURCES = [
  { id: 'campers4sale', label: 'Campers4Sale.co.uk' },
  { id: 'autotrader', label: 'AutoTrader' },
  { id: 'outandaboutlive', label: 'OutAndAboutLive.co.uk' },
];

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function DataManager({ stats, onStatsChange }) {
  const [uploading, setUploading] = useState({});
  const [uploadError, setUploadError] = useState({});
  const [uploadSuccess, setUploadSuccess] = useState({});
  const [open, setOpen] = useState(false);
  const fileRefs = useRef({});

  const handleUpload = async (sourceKey, file) => {
    setUploading(p => ({ ...p, [sourceKey]: true }));
    setUploadError(p => ({ ...p, [sourceKey]: null }));
    setUploadSuccess(p => ({ ...p, [sourceKey]: null }));
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/upload/${sourceKey}`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setUploadSuccess(p => ({ ...p, [sourceKey]: `${data.count} vehicles loaded` }));
      const newStats = await fetch('/api/stats').then(r => r.json());
      onStatsChange(newStats);
    } catch (err) {
      setUploadError(p => ({ ...p, [sourceKey]: err.message }));
    } finally {
      setUploading(p => ({ ...p, [sourceKey]: false }));
      if (fileRefs.current[sourceKey]) fileRefs.current[sourceKey].value = '';
    }
  };

  const total = stats?.total ?? 0;
  const sources = stats?.sources ?? [];

  return (
    <div className="data-manager">
      <div className="data-manager-header" onClick={() => setOpen(o => !o)}>
        <div className="data-manager-summary">
          <span className="data-total">{total} vehicles loaded</span>
          <div className="data-source-pills">
            {sources.map(s => (
              <span key={s.key} className={`data-source-pill ${s.count > 0 ? 'has-data' : 'no-data'}`}>
                {s.label}: {s.count}
              </span>
            ))}
          </div>
        </div>
        <span className="data-manager-toggle">{open ? '▲ Hide' : '▼ Manage Data'}</span>
      </div>

      {open && (
        <div className="data-manager-body">
          {sources.map(s => (
            <div key={s.key} className="source-upload-row">
              <div className="source-upload-info">
                <span className="source-upload-name">{s.label}</span>
                <span className="source-upload-count">{s.count} vehicles</span>
                {s.uploadedAt && (
                  <span className="source-upload-date">Updated {formatDate(s.uploadedAt)}</span>
                )}
                {s.filename && (
                  <span className="source-upload-filename">{s.filename}</span>
                )}
              </div>
              <div className="source-upload-action">
                {uploadSuccess[s.key] && (
                  <span className="upload-success">✓ {uploadSuccess[s.key]}</span>
                )}
                {uploadError[s.key] && (
                  <span className="upload-error">✗ {uploadError[s.key]}</span>
                )}
                <input
                  type="file"
                  accept=".xls,.xlsx,.csv"
                  style={{ display: 'none' }}
                  ref={el => fileRefs.current[s.key] = el}
                  onChange={e => e.target.files[0] && handleUpload(s.key, e.target.files[0])}
                />
                <button
                  className="upload-btn"
                  onClick={() => fileRefs.current[s.key]?.click()}
                  disabled={uploading[s.key]}
                >
                  {uploading[s.key] ? 'Uploading…' : s.count > 0 ? 'Replace File' : 'Upload File'}
                </button>
              </div>
            </div>
          ))}
          <p className="upload-hint">Accepts .xls, .xlsx, or .csv — uploading overwrites the previous file for that source.</p>
        </div>
      )}
    </div>
  );
}


function Pill({ label, value }) {
  if (!value) return null;
  return (
    <div className="pill">
      <span className="pill-label">{label}</span>
      <span className="pill-value">{value}</span>
    </div>
  );
}

function LenderPanel({ lender }) {
  const typeNames = Object.keys(lender.types);
  const [activeTab, setActiveTab] = useState(typeNames[0]);
  const params = lender.types[activeTab];

  return (
    <div className="lender-panel">
      <div className="lender-warning">
        <span>&#9888;</span> Verify all parameters against your current lender agreement
      </div>
      <p className="lender-restrictions">{lender.restrictions}</p>
      <div className="lender-tabs">
        {typeNames.map(t => (
          <button
            key={t}
            className={`lender-tab ${activeTab === t ? 'active' : ''}`}
            onClick={() => setActiveTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="pills-grid">
        <Pill label="Max Age" value={params.maxAge} />
        <Pill label="Max Mileage" value={params.maxMileage} />
        <Pill label="Min Loan" value={params.minLoan} />
        <Pill label="Max Loan" value={params.maxLoan} />
        <Pill label="Min Term" value={params.minTerm} />
        <Pill label="Max Term" value={params.maxTerm} />
        <Pill label="Min Deposit" value={params.minDeposit} />
        {params.notes && <Pill label="Notes" value={params.notes} />}
      </div>
      {params.approvedConverters && (
        <div className="approved-converters">
          <h4>Approved Converters Only</h4>
          <div className="converters-list">
            {params.approvedConverters.map(c => (
              <span key={c} className="converter-chip">{c}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VehicleCard({ vehicle, index, isDummy }) {
  return (
    <div className={`vehicle-card ${isDummy ? 'dummy' : ''}`}>
      <div className="card-header">
        <div className="card-title-row">
          {isDummy && <span className="dummy-badge">&#9733; Dummy Vehicle</span>}
          {!isDummy && <span className="card-number">#{index + 1}</span>}
          <h3 className="card-title">{vehicle.title}</h3>
        </div>
        <span className="card-price">{vehicle.price}</span>
      </div>
      <div className="card-grid">
        <div className="card-field"><span className="field-label">Year</span><span>{vehicle.year}</span></div>
        <div className="card-field"><span className="field-label">Mileage</span><span>{vehicle.mileage}</span></div>
        <div className="card-field"><span className="field-label">Fuel</span><span>{vehicle.fuel}</span></div>
        <div className="card-field"><span className="field-label">Transmission</span><span>{vehicle.transmission}</span></div>
        <div className="card-field"><span className="field-label">Colour</span><span>{vehicle.colour}</span></div>
        <div className="card-field"><span className="field-label">Berths</span><span>{vehicle.berths}</span></div>
        <div className="card-field"><span className="field-label">Source</span><span>{vehicle.source}</span></div>
      </div>
      <div className="card-url-row">
        <span className="field-label">URL</span>
        <a href={vehicle.url} target="_blank" rel="noopener noreferrer">{vehicle.url}</a>
      </div>
      <div className="card-why">
        <strong>Why it suits:</strong> {vehicle.why}
      </div>
      {vehicle.concerns && vehicle.concerns !== 'None' && (
        <div className="card-concerns">
          <strong>Concerns:</strong> {vehicle.concerns}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [selectedLender, setSelectedLender] = useState(null);
  const [activeLenderTab, setActiveLenderTab] = useState(null);
  const [criteria, setCriteria] = useState({
    make: '',
    model: '',
    budget: '',
    yearFrom: '',
    maxMileage: '',
    notes: '',
  });
  const [sources, setSources] = useState(
    SEARCH_SOURCES.reduce((acc, s) => ({ ...acc, [s.id]: true }), {})
  );
  const [searchMode, setSearchMode] = useState('live');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [excludeUrls, setExcludeUrls] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [dataStats, setDataStats] = useState(null);

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setDataStats).catch(() => {});
  }, []);

  const toggleSource = (id) => {
    setSources(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const updateCriteria = (field, value) => {
    setCriteria(prev => ({ ...prev, [field]: value }));
  };

  const getSelectedSources = () => {
    return SEARCH_SOURCES.filter(s => sources[s.id]).map(s => s.label);
  };

  const buildLenderPayload = () => {
    if (!selectedLender) return null;
    const lender = LENDERS.find(l => l.name === selectedLender);
    if (!lender) return null;

    // Determine which lender vehicle type to use
    const typeNames = Object.keys(lender.types);
    const lenderVehicleType = activeLenderTab || typeNames[0];
    const params = lender.types[lenderVehicleType];
    if (!params) return null;

    return {
      name: lender.name,
      vehicleType: lenderVehicleType,
      maxAge: params.maxAge,
      maxMileage: params.maxMileage,
      minLoan: params.minLoan,
      maxLoan: params.maxLoan,
      minTerm: params.minTerm,
      maxTerm: params.maxTerm,
      minDeposit: params.minDeposit,
      notes: params.notes,
      approvedConverters: params.approvedConverters ? params.approvedConverters.join(', ') : null,
    };
  };

  const handleSearch = async (isSearchAgain = false) => {
    const selectedSources = getSelectedSources();
    if (selectedSources.length === 0) {
      setError('Please select at least one search source.');
      return;
    }

    setLoading(true);
    setError(null);
    if (!isSearchAgain) {
      setVehicles([]);
      setExcludeUrls([]);
    }

    try {
      const currentExclude = isSearchAgain ? excludeUrls : [];
      const resp = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: searchMode,
          sources: selectedSources,
          criteria,
          lender: buildLenderPayload(),
          excludeUrls: currentExclude,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Search failed');

      const newVehicles = data.vehicles || [];
      if (isSearchAgain) {
        if (newVehicles.length === 0) {
          setError('No additional vehicles found. All matching listings have already been shown.');
        }
        setVehicles(prev => [...prev, ...newVehicles]);
      } else {
        setVehicles(newVehicles);
      }
      setExcludeUrls(prev => [
        ...prev,
        ...newVehicles.map(v => v.url).filter(Boolean),
      ]);
      setHasSearched(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <img src="/PEG_Logo_Whiteout_on_trans.png" alt="Pegasus Finance" className="logo" />
          <span className="header-label">Vehicle Search — Internal Tool</span>
        </div>
        <div className="header-accent"></div>
      </header>

      <main className="main">
        {/* Data Manager */}
        <DataManager stats={dataStats} onStatsChange={setDataStats} />

        {/* Step 1: Lender Selection */}
        <section className="section">
          <h2 className="section-title"><span className="step-badge">1</span> Lender Selection</h2>
          <div className="lender-grid">
            {LENDERS.map(l => (
              <button
                key={l.name}
                className={`lender-btn ${selectedLender === l.name ? 'active' : ''}`}
                onClick={() => {
                  setSelectedLender(selectedLender === l.name ? null : l.name);
                  setActiveLenderTab(null);
                }}
              >
                {l.name}
              </button>
            ))}
          </div>
          {selectedLender && (
            <LenderPanel
              lender={LENDERS.find(l => l.name === selectedLender)}
              onTabChange={setActiveLenderTab}
            />
          )}
        </section>

        {/* Step 2: Customer Criteria */}
        <section className="section">
          <h2 className="section-title"><span className="step-badge">2</span> Customer Criteria</h2>
          <div className="form-grid">
            <div className="form-field">
              <label>Make</label>
              <input type="text" placeholder="e.g. Swift" value={criteria.make} onChange={e => updateCriteria('make', e.target.value)} />
            </div>
            <div className="form-field">
              <label>Model</label>
              <input type="text" placeholder="e.g. Voyager 540" value={criteria.model} onChange={e => updateCriteria('model', e.target.value)} />
            </div>
            <div className="form-field">
              <label>Max Budget</label>
              <input type="text" placeholder="e.g. £55,000" value={criteria.budget} onChange={e => updateCriteria('budget', e.target.value)} />
            </div>
            <div className="form-field">
              <label>Year From</label>
              <input type="text" placeholder="e.g. 2018" value={criteria.yearFrom} onChange={e => updateCriteria('yearFrom', e.target.value)} />
            </div>
            <div className="form-field">
              <label>Max Mileage</label>
              <input type="text" placeholder="e.g. 50,000" value={criteria.maxMileage} onChange={e => updateCriteria('maxMileage', e.target.value)} />
            </div>
            <div className="form-field full-width">
              <label>Additional Notes</label>
              <textarea
                placeholder="e.g. towbar required, 4 berths, FSH preferred, colour preference..."
                value={criteria.notes}
                onChange={e => updateCriteria('notes', e.target.value)}
                rows={3}
              />
            </div>
          </div>
        </section>

        {/* Step 3: Search Sources */}
        <section className="section">
          <h2 className="section-title"><span className="step-badge">3</span> Search Sources</h2>
          <div className="sources-row">
            {SEARCH_SOURCES.map(s => (
              <button
                key={s.id}
                className={`source-chip ${sources[s.id] ? 'active' : ''}`}
                onClick={() => toggleSource(s.id)}
              >
                <span className={`chip-check ${sources[s.id] ? 'on' : ''}`}>
                  {sources[s.id] ? '\u2713' : ''}
                </span>
                {s.label}
              </button>
            ))}
          </div>
        </section>

        {/* Step 4: Search Mode */}
        <section className="section">
          <h2 className="section-title"><span className="step-badge">4</span> Search Mode</h2>
          <div className="mode-row">
            <button
              className={`mode-card ${searchMode === 'live' ? 'active' : ''}`}
              onClick={() => setSearchMode('live')}
            >
              <span className="mode-title">Live Listings</span>
              <span className="mode-badge">Up to 5 Results</span>
              <span className="mode-desc">Find multiple real vehicles for sale</span>
            </button>
            <button
              className={`mode-card ${searchMode === 'dummy' ? 'active' : ''}`}
              onClick={() => setSearchMode('dummy')}
            >
              <span className="mode-title">Dummy Vehicle</span>
              <span className="mode-badge dummy-mode-badge">1 Result</span>
              <span className="mode-desc">Find one representative vehicle for lender submission</span>
            </button>
          </div>

          <button
            className="search-btn"
            onClick={() => handleSearch(false)}
            disabled={loading}
          >
            {loading ? (
              <span className="loading-spinner">
                <span className="spinner"></span> Searching...
              </span>
            ) : 'Search'}
          </button>
        </section>

        {/* Error */}
        {error && (
          <div className="error-banner">{error}</div>
        )}

        {/* Results */}
        {hasSearched && !loading && (
          <section className="section results-section">
            <h2 className="section-title">Results</h2>
            {vehicles.length === 0 ? (
              <p className="no-results">No vehicles found matching your criteria. Try broadening your search.</p>
            ) : (
              <>
                {vehicles.map((v, i) => (
                  <VehicleCard
                    key={v.url || i}
                    vehicle={v}
                    index={i}
                    isDummy={searchMode === 'dummy'}
                  />
                ))}
                <div className="results-actions">
                  <button
                    className="search-again-btn"
                    onClick={() => handleSearch(true)}
                    disabled={loading}
                  >
                    {loading ? 'Searching...' : 'Search Again (Exclude Previous)'}
                  </button>
                  <button
                    className="clear-btn"
                    onClick={() => { setVehicles([]); setExcludeUrls([]); setHasSearched(false); setError(null); }}
                  >
                    Clear Results
                  </button>
                </div>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
