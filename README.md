# Pegasus Finance — Vehicle Search (Internal Tool)

An internal staff tool for searching vehicle listings from uploaded spreadsheets (Campers4Sale, AutoTrader, OutAndAboutLive). Results are instant — no AI search, no API costs.

## Local Development

### Prerequisites
- Node.js 18+ (installed via [nvm](https://github.com/nvm-sh/nvm))

### Setup

```bash
# Install all dependencies
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..

# Start dev server (runs both API on :3001 and React on :5173)
npm run dev
```

Open **http://localhost:5173**

---

## Deploying to Railway

### 1. Push to GitHub

```bash
cd ~/Claude\ Code/pegasus-vehicle-search
git init
git add .
git commit -m "Initial commit"
# Create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/pegasus-vehicle-search.git
git push -u origin main
```

### 2. Create Railway project

1. Go to [railway.app](https://railway.app) and sign in
2. Click **New Project → Deploy from GitHub repo**
3. Select your `pegasus-vehicle-search` repo
4. Railway will auto-detect the `railway.toml` and deploy

### 3. Add a Volume (for persistent data files)

This is important — without a volume, uploaded spreadsheets are lost when Railway restarts the app.

1. In your Railway project, click **+ Add → Volume**
2. Set the **Mount Path** to `/app/server/data`
3. Click **Add**

### 4. Set environment variables (optional)

In Railway → Variables, you can set:
- `DATA_DIR` — override the data directory path (defaults to `/app/server/data`)

### 5. Get your URL

Railway gives you a public URL like `https://pegasus-vehicle-search.up.railway.app`. Share this with your team.

---

## Updating Spreadsheet Data

Staff can upload new spreadsheets directly in the app:

1. Open the app
2. Click **▼ Manage Data** at the top
3. Click **Upload File** / **Replace File** next to the relevant source
4. Select the new `.xls`, `.xlsx`, or `.csv` file

Uploading overwrites the previous file for that source. Data is available immediately — no restart needed.

**Recommended export columns** (the app reads these column names):
- `Vehicle Title`
- `Price`
- `Description`
- `Features` (comma-separated key-value pairs: `Make, Swift, Year, 2022, Mileage, 12000 miles, Fuel type, Diesel, Transmission, Automatic, Berth, 4, Exterior, Silver`)
- `Vehicle link`

---

## Project Structure

```
pegasus-vehicle-search/
├── client/               # React frontend (Vite)
│   ├── public/           # Static assets (logo)
│   └── src/
│       ├── App.jsx       # Main UI
│       ├── lenders.js    # Lender criteria data
│       └── styles.css
├── server/
│   ├── data/             # Uploaded spreadsheet files (managed via app)
│   └── index.js          # Express API server
├── railway.toml          # Railway deployment config
└── package.json
```
