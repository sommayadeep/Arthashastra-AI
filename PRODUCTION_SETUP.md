# ASHSTRASHASTRA AI - Production Deployment Guide

## ✅ Files Created/Updated

1. **app.py** - Flask backend server (NEW)
2. **requirements.txt** - Python dependencies (UPDATED)
3. **runtime.txt** - Python version for Render (NEW)
4. **render.yaml** - Render deployment config (NEW)
5. **vercel.json** - Vercel config (UPDATED)

---

## 🚀 Step-by-Step Deployment

### Step 1: Push Code to GitHub

Run these commands in your project folder:

```bash
cd /Users/sommayadeepsaha/Desktop/ASHSTRASHASTRA_AI

# Add all files
git add .

# Commit
git commit -m "Add Flask backend for Render deployment"

# Push to GitHub
git push origin main
```

---

### Step 2: Deploy Backend on Render

1. Go to: https://dashboard.render.com
2. Sign up/Login with GitHub
3. Click **"New +"** → **"Web Service"**
4. Select your GitHub repository: `sommayadeep/Arthashastra-AI`
5. Configure:
   - **Name:** `ashstrashastra-ai-backend`
   - **Environment:** `Python`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `python app.py`
6. Click **"Create Web Service"**
7. Wait 2-3 minutes for deployment
8. Copy your backend URL (e.g., `https://ashstrashastra-ai-backend.onrender.com`)

---

### Step 3: Deploy Frontend on Vercel

1. Go to: https://vercel.com
2. Sign up/Login with GitHub
3. Click **"Add New..."** → **"Project"**
4. Import your GitHub repository: `sommayadeep/Arthashastra-AI`
5. Configure:
   - **Framework Preset:** `Other` or `Static`
   - **Build Command:** (leave empty)
   - **Output Directory:** (leave as `.`)
6. Click **"Deploy"**
7. Wait 1-2 minutes
8. Copy your frontend URL (e.g., `https://portfolio.vercel.app`)

---

### Step 4: Connect Frontend to Backend

After getting both URLs:

1. **Backend URL:** `https://ashstrashastra-ai-backend.onrender.com`
2. **Frontend URL:** `https://portfolio.vercel.app`

Your frontend already uses external APIs (Google News, RSS), so it should work automatically!

If you need to update any API calls, the backend endpoints are:
- Health: `https://your-backend.onrender.com/api/health`
- News: `https://your-backend.onrender.com/api/news`

---

## 📋 Quick Commands

### To push updates later:
```bash
git add .
git commit -m "Your message"
git push origin main
```

Both Render and Vercel will auto-deploy on push!

---

## 🔗 Expected Live Links

- **Backend (Render):** `https://ashstrashastra-ai-backend.onrender.com`
- **Frontend (Vercel):** `https://portfolio.vercel.app`

---

## ❓ Troubleshooting

**Render issues?**
- Check Build Logs in Render dashboard
- Make sure requirements.txt is correct

**Vercel issues?**
- Check Deploy Logs in Vercel dashboard
- Ensure vercel.json is valid

**CORS errors?**
- Flask-CORS is enabled in app.py
- Should work automatically

