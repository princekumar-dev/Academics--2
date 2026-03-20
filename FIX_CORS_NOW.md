# 🚨 URGENT: Redeploy Render Backend for CORS Fix

## The Problem
Your Vercel frontend cannot talk to your Render backend because the CORS headers are missing. This happened because the backend code was updated with CORS fixes but **NOT DEPLOYED** to Render.

## The Solution (2 Minutes)

### Step 1: Go to Render Dashboard
Open: https://render.com

### Step 2: Navigate to Your Service
1. Look for **"Academics"** service (likely `academics-5bf1.onrender.com`)
2. Click on it

### Step 3: Redeploy
1. Scroll down on the service page
2. Find the section that says **"Manual Deploy"** (or **"Deploy latest commit"**)
3. Click the **"Redeploy"** or **"Deploy"** button
4. **Wait 2-3 minutes** for deployment to complete

You'll see the status change:
```
Deploying... → Building... → Deployed ✓
```

### Step 4: Test
1. Go to https://msec-academics.vercel.app
2. Refresh the page (Ctrl+F5 or Cmd+Shift+R)
3. Marksheets should load now without CORS errors

## Why This Happened

Your changes are stored on GitHub:
- ✅ `server.js` has CORS configuration
- ✅ `api/marksheets.js` has batch endpoint
- ✅ `src/pages/Marksheets.jsx` uses batch endpoint

But the **Render server is still running the old code** because it hasn't been told to pull and run the latest changes.

## If It Still Doesn't Work

### Check Render Logs
1. Go to your Academics service on Render
2. Scroll to **"Logs"** tab
3. Look for errors with "CORS" or "origin"
4. Copy any errors and check them

### Clear Browser Cache
1. Press **F12** (Developer Tools)
2. Right-click the refresh button
3. Select **"Empty cache and hard refresh"**

### Try Health Check
Open this in your browser:
```
https://academics-5bf1.onrender.com/
```

Should show: `Backend API Server is running!`

If it shows an error, Render deployment failed.

## Recent Commits Waiting to Deploy

These are on GitHub but need Render deployment:
1. **d18e957a** - Enhanced CORS preflight handler ← LATEST
2. **da0ff66c** - Fixed batch endpoint dispatch
3. **564ce89c** - Added deployment guide

## After Deployment Works

Don't forget to test:
1. Load marksheets ✓
2. Click "Verify & Request Dispatch" ✓
3. All marksheets should verify and dispatch ✓

---

**Questions?** Check the browser console (F12) or Render logs for CORS-related error messages.
