# Google Drive Integration Guide

BetterDrive integrates multiple Google Drive accounts into a unified virtual storage pool. Each connected account adds 15 GB of free cloud capacity (or its paid quota) to your pooled storage.

---

## 1. Google Cloud Console Setup

Connecting Google Drive requires an OAuth 2.0 Client ID with PKCE support from the Google Cloud Console.

### Step 1: Create a Google Cloud Project
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown in the top bar and select **New Project**.
3. Name the project (e.g. `BetterDrive Storage`) and click **Create**.

### Step 2: Enable the Google Drive API
1. Open the navigation menu and go to **APIs & Services → Library**.
2. Search for **Google Drive API**.
3. Click on **Google Drive API** and select **Enable**.

### Step 3: Configure the OAuth Consent Screen
1. Go to **APIs & Services → OAuth consent screen**.
2. Select User Type: **External** (or **Internal** if using a Google Workspace domain) and click **Create**.
3. Fill in the required fields:
   - **App name**: `BetterDrive`
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
4. Click **Save and Continue** through Scopes (the necessary `drive.file` scope will be requested at runtime).
5. Under **Test users**, click **Add Users** and enter the Gmail addresses you plan to connect.
6. Click **Save and Continue**.

### Step 4: Generate OAuth 2.0 Credentials
1. Go to **APIs & Services → Credentials**.
2. Click **Create Credentials → OAuth client ID**.
3. Set Application type to **Web application**.
4. Set Name to `BetterDrive Web Client`.
5. Under **Authorized redirect URIs**, add both of the following:
   ```text
   http://localhost:4000/connected-accounts/google/callback
   http://localhost:4000/auth/google/callback
   ```
   *Note: If hosting on a remote domain or reverse proxy, replace `http://localhost:4000` with your canonical public URL (e.g. `https://drive.example.com/connected-accounts/google/callback`).*
6. Click **Create**. A dialog will display your **Client ID** and **Client Secret**.

---

## 2. Connecting Accounts in BetterDrive

### Method A: Web Interface
1. Sign in to the BetterDrive dashboard as an `owner` or `admin`.
2. Navigate to **Settings → Connected Accounts** (`/settings/accounts`).
3. Click **Connect Google Drive**.
4. Enter your **Client ID** and **Client Secret** if not already configured in your environment.
5. Click **Authorize** to redirect to Google's consent screen.
6. Grant permissions and return to BetterDrive. The account will appear in your storage pool with real-time quota telemetry.

### Method B: Environment Variables (`backend/.env`)
For automated or headless deployments, specify credentials in `backend/.env`:
```env
GOOGLE_CLIENT_ID="1234567890-abcdef.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx"
GOOGLE_REDIRECT_URI="http://localhost:4000/connected-accounts/google/callback"
```

---

## 3. Storage Pooling & Quota Telemetry

- **Multi-Account Aggregation**: Connecting 3 personal Google accounts provides 45 GB of aggregate capacity under a single virtual directory tree.
- **Dynamic Routing**: BetterDrive routes file uploads to the account with the largest available quota at transfer time.
- **Quota Polling**: Quota statistics are refreshed periodically via the Google Drive API `about.get` endpoint and updated during file mutation events.
- **Account Disconnect**: Disconnecting an account via `DELETE /system/connected-accounts/:id` marks the account as `revoked`. File records remain visible in read-only mode to prevent accidental data loss.

---

## 4. Troubleshooting & Gotchas

| Symptom | Cause | Solution |
|---|---|---|
| `redirect_uri_mismatch` | Redirect URI in console does not match BetterDrive URL | Ensure `http://localhost:4000/connected-accounts/google/callback` is explicitly listed under **Authorized redirect URIs**. |
| `access_denied` / App not verified | Using an unverified External app without test user enrollment | Add the target Google email to the **Test Users** list in the OAuth consent screen. |
| Token expired / Disconnected | Refresh token revoked or inactive for > 6 months | Click **Reauth** on the account card in `/settings/accounts` to complete a fast re-consent flow. |
