<<<<<<< HEAD
# OMAR STORE — Full Stack E-commerce

Sports supplements store built with vanilla HTML/CSS/JS, Vercel Serverless Functions, Supabase (PostgreSQL), and Cloudinary.

---

## 📁 Project Structure

```
omar-store/
├── index.html               # Storefront (unchanged design)
├── admin.html               # Admin panel (independent)
├── api/
│   ├── products.js          # GET all / POST new product
│   ├── products/
│   │   └── [id].js          # GET / PUT / DELETE by ID
│   └── upload.js            # Cloudinary image upload
├── supabase_schema.sql      # Run once in Supabase SQL editor
├── vercel.json              # Vercel routing + CORS headers
├── package.json
├── .gitignore
└── README.md
```

---

## ⚙️ Environment Variables

Create these in **Vercel Dashboard → Project → Settings → Environment Variables**:

| Variable | Where to find |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role key |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary → Dashboard → Cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary → Dashboard → API Key |
| `CLOUDINARY_API_SECRET` | Cloudinary → Dashboard → API Secret |

> ⚠️ Never commit these to Git. They are already in `.gitignore`.

---

## 🗄️ Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a free project.
2. In the dashboard go to **SQL Editor**.
3. Paste and run the contents of `supabase_schema.sql`.
4. Confirm the `products` table was created under **Table Editor**.

---

## ☁️ Cloudinary Setup

1. Create a free account at [cloudinary.com](https://cloudinary.com).
2. Note your **Cloud Name**, **API Key**, and **API Secret** from the dashboard.
3. Images are automatically uploaded to the `omar-store` folder.

---

## 🚀 Deploy to GitHub + Vercel

### Step 1 — Push to GitHub

```bash
cd omar-store
git init
git add .
git commit -m "Initial commit — Omar Store"
```

Create a new repo on GitHub (no README, no .gitignore — you already have those), then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/omar-store.git
git branch -M main
git push -u origin main
```

### Step 2 — Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and log in with your GitHub account.
2. Click **"Add New → Project"**.
3. Find and import your `omar-store` repository.
4. **Framework Preset**: leave as **"Other"** (not Node.js, not Next.js).
5. **Root Directory**: leave as `.` (root).
6. **Build Command**: leave empty.
7. **Output Directory**: leave empty.
8. Click **"Add Environment Variables"** and add all 5 variables from the table above.
9. Click **"Deploy"**.

Vercel will detect the `api/` folder automatically and deploy each file as a serverless function.

---

## 🔧 Local Development

```bash
npm install
npx vercel dev
```

Create a `.env` file (never commit this):

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789
CLOUDINARY_API_SECRET=abc123xyz
```

Then open `http://localhost:3000`.

---

## ⚠️ Common Vercel Issues & Solutions

### 1. API routes return 404
**Cause**: Vercel doesn't find the functions.  
**Fix**: Make sure `api/` is at the root level (same folder as `vercel.json`). Each `.js` file in `api/` becomes a route automatically.

### 2. Dynamic route `[id].js` not working
**Cause**: File must be inside a subfolder matching the route.  
**Fix**: The file must be at `api/products/[id].js` — exactly as in this repo.

### 3. Environment variables undefined at runtime
**Cause**: Variables added after deployment, or wrong environment selected.  
**Fix**: In Vercel dashboard add them for **Production**, **Preview**, and **Development**. Then **redeploy** (Deployments → ⋯ → Redeploy).

### 4. Cloudinary upload fails with 401
**Cause**: Wrong API secret in environment variables.  
**Fix**: Double-check `CLOUDINARY_API_SECRET` — it's different from the API key.

### 5. Supabase returns 0 rows even though data exists
**Cause**: Row Level Security is blocking anonymous reads.  
**Fix**: The schema already creates a public read policy. If you recreated the table, re-run the SQL from `supabase_schema.sql`.

### 6. CORS errors in browser console
**Cause**: Missing CORS headers on API responses.  
**Fix**: The `vercel.json` adds CORS headers globally. Each API route also sets `Access-Control-Allow-Origin: *` manually and handles `OPTIONS` preflight.

### 7. Image uploads work locally but fail on Vercel
**Cause**: Vercel's default body size limit is 4.5 MB for serverless functions.  
**Fix**: The `upload.js` sets `export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }` to increase it.

### 8. "Cannot find module @supabase/supabase-js"
**Cause**: `node_modules` not installed or `package.json` missing.  
**Fix**: Vercel installs dependencies automatically from `package.json`. Make sure `package.json` is committed to Git.

### 9. Products not updating on storefront after admin changes
**Cause**: Browser cache.  
**Fix**: The storefront calls `/api/products` on every load — hard-refresh with Ctrl+Shift+R. For production, consider adding `Cache-Control: no-store` to the API route headers in `vercel.json`.

### 10. Admin panel accessible to everyone
**Cause**: No authentication added yet.  
**Fix**: Add a simple password check in `admin.html` using `localStorage`, or protect the route with [Vercel's built-in password protection](https://vercel.com/docs/security/deployment-protection) (Pro plan), or implement Supabase Auth.

---

## 📌 API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/products` | List all products |
| GET | `/api/products?type=creatine` | Filter by type |
| POST | `/api/products` | Add new product |
| GET | `/api/products/:id` | Get single product |
| PUT | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product |
| POST | `/api/upload` | Upload image to Cloudinary |

---

## 🏗️ Tech Stack

- **Frontend**: Vanilla HTML, Tailwind CSS (CDN), Cairo font
- **Admin**: Standalone HTML/CSS/JS — no framework
- **API**: Vercel Serverless Functions (Node.js)
- **Database**: Supabase (PostgreSQL)
- **Images**: Cloudinary
- **Deployment**: Vercel + GitHub

---

*Dev: Yassin ElSeba3e*
=======
# omar-store
>>>>>>> 80d2387bcbae526e3fabeae37fd90b3b296cc1e3
