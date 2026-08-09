# PDFStation

A full-stack PDF tools website: merge, split, rotate, compress, and convert
PDFs, with user accounts and a file history dashboard.

This is an **original** build — its own name, design, and code. It is not
affiliated with, and does not use any code or assets from, any other PDF
tools site.

## What's inside

```
pdftools/
├── server/              Node.js + Express API (auth, PDF processing, DB)
│   └── src/
│       ├── index.js         App entry point
│       ├── db.js            SQLite schema + connection
│       ├── middleware/auth.js
│       ├── routes/auth.js   Register / login / me
│       ├── routes/tools.js  Merge / split / rotate / compress / convert
│       ├── routes/files.js  Download + job history
│       └── utils/           Upload handling, storage, cleanup
└── public/               Static frontend (plain HTML/CSS/JS, no build step)
    ├── index.html            Home page with all tools
    ├── tool.html             Generic tool workspace (?tool=merge etc.)
    ├── login.html / register.html
    ├── dashboard.html        File history
    └── js/, css/
```

**Tools included:** Merge, Split, Rotate, Compress, Images→PDF, PDF→Images.

## How it works

- **Frontend**: plain HTML/CSS/JS. No framework, no build step — open the
  files directly or serve them with any static file server.
- **Backend**: Node/Express API. Handles user accounts (JWT + bcrypt) and
  does the actual PDF work using [pdf-lib](https://pdf-lib.js.org/).
- **Database**: SQLite (via `better-sqlite3`) — a single file on disk, no
  separate database server to install. Swap it for Postgres later if you
  outgrow it (see "Scaling up" below).
- **File storage**: processed files are written to `server/storage/outputs`
  and automatically deleted 24 hours after creation (see `utils/storage.js`).
  Uploaded files themselves are never written to disk — they're processed
  in memory and discarded immediately.

## Running it locally

You'll need [Node.js](https://nodejs.org) version 18 or later installed.

### 1. Backend

```bash
cd server
npm install
cp .env.example .env
# open .env and set JWT_SECRET to any long random string
npm start
```

The API now runs at `http://localhost:4000`. You should see
`PDFStation API running on http://localhost:4000` in your terminal.

### 2. Frontend

The frontend is static files — no build step. The simplest way to serve it:

```bash
cd public
npx serve .
```

This opens the site at `http://localhost:3000` (or similar — the terminal
will tell you the exact address). `public/js/config.js` already points at
`http://localhost:4000` for the backend, so it'll work immediately.

Alternatively, just open `public/index.html` directly in your browser —
it works the same way, since everything talks to the API over HTTP.

### 3. Try it

1. Open the site, click **Sign up free**, create an account.
2. Go to any tool (e.g. Merge), drop in a couple of PDFs, click the action
   button.
3. Download the result. Check **Dashboard** to see your file history.

## One PDF-to-Image dependency

The **PDF → Images** tool uses a package called `pdf-poppler`, which relies
on a system tool called **poppler**. Install it once on the machine running
your backend:

- **macOS**: `brew install poppler`
- **Ubuntu/Debian**: `sudo apt install poppler-utils`
- **Windows**: download poppler binaries and add them to your PATH (see
  the [pdf-poppler README](https://www.npmjs.com/package/pdf-poppler) for
  the current link)

Every other tool works with no extra system dependencies.

## Deploying it for real (making it a live website)

I can't host this for you directly, but here's the fastest path — about
10–15 minutes, free tier is enough to start:

### Backend → Render (or Railway)

1. Push the `server/` folder to a GitHub repo.
2. Create a new **Web Service** on [render.com](https://render.com), point
   it at that repo.
3. Build command: `npm install` — Start command: `npm start`
4. Add environment variables from your `.env` file (especially `JWT_SECRET`).
   Set `CORS_ORIGIN` to your frontend's URL once you have it (step below).
5. If you're using PDF → Images, add poppler: Render's default Node image
   doesn't include it, so either add a `render.yaml` build step
   (`apt-get install -y poppler-utils`) or skip that one tool for now.
6. Render gives you a URL like `https://pdfstation-api.onrender.com`.

### Frontend → Netlify, Vercel, or GitHub Pages

1. Push the `public/` folder to a GitHub repo (or the same one).
2. On [netlify.com](https://netlify.com), "Add new site" → point at the repo,
   no build command needed, publish directory is `public` (or root, if
   that's the whole repo).
3. Open `public/js/config.js` and change the line to your Render URL:
   ```js
   window.PDFSTATION_API_BASE = "https://pdfstation-api.onrender.com";
   ```
4. Deploy. You now have a real, working URL you can share.

### A note on the database in production

SQLite writes to a local file, which works fine on Render's persistent
disk (add a paid disk, or accept that free-tier services can lose the file
on redeploy). For a database that isn't tied to one server's disk, later
you'd swap `better-sqlite3` for `pg` (Postgres) — Render and Railway both
offer a free Postgres instance you can point at instead.

## Scaling up later

Ideas if you want to keep growing this:

- **True heavy compression**: current compression is modest (pdf-lib
  re-encoding). For real size reduction (like the big sites do), install
  [Ghostscript](https://www.ghostscript.com/) on the server and shell out
  to it — happy to add that route when you're ready.
- **Office conversions** (PDF → Word/Excel, and back): needs LibreOffice
  installed on the server (`soffice --headless --convert-to`). More setup,
  but doable the same way as the poppler dependency above.
- **Rate limiting** on the API to stop abuse — the `express-rate-limit`
  package is a five-minute add.
- **Email verification / password reset** — needs an email-sending service
  (Resend, SendGrid, etc.); ask and I'll wire it in.
- **Payments / paid tiers** — Stripe integration if you want to charge for
  higher limits.

## Security notes

- Passwords are hashed with bcrypt — never stored in plain text.
- Sessions use JWTs, expiring after 7 days by default (`JWT_EXPIRES_IN`).
- File downloads require the owner's login token — no one else can fetch
  your files by guessing a URL.
- Uploaded PDFs are processed in memory and never written to disk;
  only the finished result is stored, and only briefly (24h).
