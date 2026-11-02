# Host the site on GitHub Pages with an AWS Lambda API

```
Browser (https://<you>.github.io/<repo>/)
   ├─ GET/DELETE /files, POST /upload-url ──► Lambda "file-api" (Function URL)
   └─ PUT file (signed link) ───────────────► S3 bucket ──► Lambda "on-file-uploaded" ──► DynamoDB
```

Region for everything: **US East (Ohio) us-east-2**.
The existing `on-file-uploaded` Lambda and `UploadedFiles` table stay exactly as they are.
`server.js` and your `.env` are **no longer needed** for the hosted site.

> ⚠️ The site has no login. Anyone with the URL can upload and delete files in the bucket.

---

## Part A: Build the API Lambda (`file-api`)

### A1. Package the code (on your PC)
In Command Prompt:
```
cd C:\Project\api
npm install
powershell Compress-Archive -Path * -DestinationPath ..\file-api.zip -Force
```
This creates `C:\Project\file-api.zip` (code + libraries).

### A2. Create the function
1. **Lambda** → **Create function** → Author from scratch
   - Name: `file-api` · Runtime: **Node.js 20.x** (or newer) → **Create function**
2. **Code** tab → **Upload from** → **.zip file** → choose `file-api.zip` → **Save**.
3. **Configuration** → **Environment variables** → add
   - `S3_BUCKET` = `business-insurance-prep-worksheet-2026`
   - `TABLE_NAME` = `UploadedFiles`
4. **Configuration** → **General configuration** → Timeout **15 sec** → Save.

### A3. Permissions
**Configuration** → **Permissions** → click the role → **Add permissions** → **Create inline policy** → JSON:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::business-insurance-prep-worksheet-2026/*"
    },
    {
      "Effect": "Allow",
      "Action": ["dynamodb:Scan", "dynamodb:DeleteItem"],
      "Resource": "arn:aws:dynamodb:us-east-2:410729353310:table/UploadedFiles"
    }
  ]
}
```
Name it `file-api-policy` → **Create policy**.

### A4. Give it a public URL
1. **Configuration** → **Function URL** → **Create function URL**
2. Auth type: **NONE**
3. Expand **Additional settings** → tick **Configure cross-origin resource sharing (CORS)**
   - Allow origin: `*`
   - Allow headers: `content-type`
   - Allow methods: `GET`, `POST`, `DELETE`
4. **Save**. Copy the **Function URL** (like `https://abc123.lambda-url.us-east-2.on.aws/`).

Test: open `<Function URL>files` in your browser → you should see a JSON list.

---

## Part B: Allow the browser to upload to S3 (bucket CORS)
**S3** → `business-insurance-prep-worksheet-2026` → **Permissions** → **Cross-origin resource sharing (CORS)** → **Edit**:
```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }
]
```
**Save changes**. (Keep "Block all public access" ON — signed links still work.)

---

## Part C: Publish the page on GitHub Pages

### C1. Set the API URL in the page
Open `docs/index.html` and replace
```
const API_URL = 'https://PASTE-YOUR-FUNCTION-URL.lambda-url.us-east-2.on.aws';
```
with your Function URL, **without** the slash at the end.

### C2. Create the repository
1. Sign in at https://github.com → **+** (top right) → **New repository**
2. Name: e.g. `file-upload` · **Public** → **Create repository**
3. Click **uploading an existing file**, and drag in:
   - the `docs` folder (with `index.html`)
   - the `api` folder (**without** `node_modules`)
   - the `lambda` folder, `.gitignore`, `README.md`, `HOSTING_SETUP.md`
   **Never upload `.env`.**
4. **Commit changes**.

### C3. Turn on Pages
1. Repo → **Settings** → **Pages**
2. Source: **Deploy from a branch** · Branch: **main** · Folder: **/docs** → **Save**
3. After 1–2 minutes the page shows your site URL:
   `https://<your-username>.github.io/file-upload/`

Share that URL — anyone can open it.

---

## Troubleshooting
| Symptom | Fix |
|---|---|
| "Failed to fetch" when the table loads | API_URL wrong, or Function URL CORS not set (A4) |
| "S3 upload failed: 403" | Bucket CORS missing (Part B) or `s3:PutObject` missing (A3) |
| Upload works but row never appears | `on-file-uploaded` trigger — check its CloudWatch logs |
| `Cannot find package '@aws-sdk/s3-request-presigner'` | The zip was made without `npm install` (A1) |
| Page shows the old version | Wait a minute, then Ctrl+F5 |
