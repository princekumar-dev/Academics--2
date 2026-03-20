# Deployment Instructions - Render Backend

## Issue Fixed
The batch verification endpoint has been implemented to fix the timeout issue where only 18 of 98 marksheets were verifying. Old approach used 6 concurrent individual requests, new approach uses a single batch request.

## Changes Deployed to GitHub
1. ✅ **CORS Fix** (`server.js`) - Added explicit allowance for `https://msec-academics.vercel.app`
2. ✅ **Batch Endpoint** (`api/marksheets.js`) - New `batch-verify-and-dispatch` action
3. ✅ **Frontend Update** (`src/pages/Marksheets.jsx`) - Uses batch endpoint instead of concurrent requests

## How to Deploy to Render

### Option 1: Auto-Deploy (If Enabled)
If you have GitHub auto-deploy connected:
1. Go to https://render.com
2. Select "Academics" service
3. Check if it auto-deployed the latest commit
4. If not deployed in 2 minutes, proceed to Option 2

### Option 2: Manual Deploy (Recommended)
1. Go to https://render.com
2. Log in with your account
3. Click on your "Academics" service (academics-5bf1.onrender.com or similar)
4. Scroll down to find **"Manual Deploy"** button
5. Click **"Redeploy latest commit"** or **"Deploy commit"**
6. Wait 2-3 minutes for deployment to complete
7. Once complete, test in your Vercel frontend

### What Gets Updated
- ✅ CORS headers will be properly sent
- ✅ Batch endpoint will be available at `/api/marksheets?action=batch-verify-and-dispatch`
- ✅ Better error handling for bulk operations

## Testing the Fix

1. Go to https://msec-academics.vercel.app (your Vercel frontend)
2. Log in as a staff member
3. Load marksheets (you should see all loaded, not just 50)
4. Click **"Verify & Request Dispatch"** button
5. Watch the progress - should see all marksheets being processed (not just 18 of 98)
6. Success message should show: "✓ Verified & Requested: X marksheets verified, Y dispatch requested"

## If Still Getting Timeouts

**These are temporary (cold-start) issues on Render free tier:**

1. **Wait 30 seconds** after redeploy before testing
2. **Test individual marksheet verify** first (not batch)
3. **Check Render logs:**
   - Go to Render dashboard
   - Click "Academics" service
   - Scroll to "Logs" tab
   - Look for any error messages

4. **Consider upgrading Render plan:**
   - Free tier sleeps after 15 min inactivity
   - Paid plans ($7+/month) have no cold-start delays
   - Much faster verification/dispatch operations

## Backend URL Check

Current backend: `https://academics-5bf1.onrender.com`

If this URL ever changes, update `.env.production`:
```env
VITE_API_URL=https://your-new-render-url.onrender.com
```

Then rebuild and redeploy Vercel frontend.

## Commit History
- **ff5ce0af**: CORS fix (Enhanced CORS configuration)
- **New commit**: Batch endpoint (Add batch-verify-and-dispatch)

---

**Questions?** Check Render logs or browser DevTools Console (F12) for error details.
