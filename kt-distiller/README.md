# KT Distiller

A 7-step Knowledge Translation tool that transforms research papers into audience-specific communication products.

## Local Development

**Requirements:** Node.js 18+ ([nodejs.org](https://nodejs.org))

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/kt-distiller
cd kt-distiller

# 2. Install dependencies
npm install

# 3. Add your Anthropic API key
echo "VITE_ANTHROPIC_API_KEY=sk-ant-your-key-here" > .env

# 4. Start the dev server
npm run dev
```

Open http://localhost:5173 in your browser.

## Deploy to GitHub Pages

### One-time setup

1. Go to your repo on GitHub → **Settings → Pages**
2. Under "Source", select **GitHub Actions**
3. Go to **Settings → Secrets and variables → Actions**
4. Click **New repository secret**
   - Name: `VITE_ANTHROPIC_API_KEY`
   - Value: your Anthropic API key (`sk-ant-...`)

### Deploy

Push to `main` — GitHub Actions will build and deploy automatically.

```bash
git add .
git commit -m "Update"
git push origin main
```

Your app will be live at: `https://YOUR_USERNAME.github.io/kt-distiller/`

Check the **Actions** tab in your repo to watch the deployment progress (~2 min).

## Project Structure

```
kt-distiller/
├── src/
│   ├── App.jsx          ← main app (rename kt-distiller-app.jsx to this)
│   └── main.jsx         ← entry point
├── .env                 ← local API key (never commit this)
├── .gitignore
├── vite.config.js
└── .github/
    └── workflows/
        └── deploy.yml   ← auto-deploy on push to main
```

## Getting an Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign in or create an account
3. Go to **API Keys** → **Create Key**
4. Copy the key — you'll only see it once

## Security Note

- Never commit your `.env` file or paste your API key into the code
- The `.gitignore` file already excludes `.env`
- For GitHub Pages, the key is stored as a GitHub Actions secret and injected at build time — it is never visible in the repo
