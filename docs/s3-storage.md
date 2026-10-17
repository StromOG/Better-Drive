# S3 & Object Storage Integration Guide

BetterDrive integrates standard S3-compatible object storage backends into its virtual filesystem. Supported providers include AWS S3, Cloudflare R2, MinIO, Backblaze B2, and Wasabi.

---

## 1. Provider Configurations

| Provider | Endpoint URL | Region | Force Path Style |
|---|---|---|:---:|
| **Cloudflare R2** | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` | `auto` | `false` |
| **Amazon S3** | *(Leave blank — uses AWS standard resolver)* | Target AWS region (e.g. `us-east-1`, `eu-central-1`) | `false` |
| **MinIO (Self-Hosted)** | `http://localhost:9000` or LAN IP | `us-east-1` | `true` |
| **Backblaze B2** | `https://s3.<region>.backblazeb2.com` (e.g. `s3.us-west-004.backblazeb2.com`) | `us-west-004` | `false` |
| **Wasabi** | `https://s3.wasabisys.com` (or region-specific endpoint) | `us-east-1` | `false` |

---

## 2. Provider Setup Walkthroughs

### 1. Cloudflare R2 (Recommended for Free Tier & Zero Egress)
Cloudflare R2 provides 10 GB of free storage with zero egress fees:
1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/) and navigate to **R2**.
2. Click **Create bucket** and name your bucket (e.g. `betterdrive-vault`).
3. Click **Manage R2 API Tokens** in the sidebar.
4. Click **Create API Token**:
   - Permission: **Object Read & Write**
   - Bucket: Select your BetterDrive bucket (or all buckets)
   - TTL: Permanent (or your retention preference)
5. Copy the **Access Key ID**, **Secret Access Key**, and **Endpoint URL** (`https://<account-id>.r2.cloudflarestorage.com`).
6. In BetterDrive, go to **Settings → Connected Accounts → Connect S3 Bucket**, enter the credentials, set Region to `auto`, and leave Force Path Style unchecked.

### 2. MinIO (Local / Self-Hosted Home Server)
For local private storage on a NAS or server:
```bash
docker run -d \
  -p 9000:9000 \
  -p 9001:9001 \
  --name minio-betterdrive \
  -v /opt/minio/data:/data \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minio-strong-password-2026" \
  quay.io/minio/minio server /data --console-address ":9001"
```
1. Access the web console at `http://localhost:9001`.
2. Create a bucket named `betterdrive-vault`.
3. In BetterDrive, set Endpoint to `http://localhost:9000` (or host IP), Region to `us-east-1`, check **Force Path Style**, and enter the root credentials.

### 3. Backblaze B2
1. In the Backblaze B2 console, navigate to **Buckets → Create a Bucket** (set Files in Bucket to **Private**).
2. Go to **Application Keys → Add a New Application Key**:
   - Allow access to Bucket: Select your bucket
   - Type of Access: **Read and Write**
3. Record the `keyID` (Access Key ID), `applicationKey` (Secret Access Key), and the S3 Endpoint URL from bucket details.

---

## 3. Minimal IAM Security Policy

For AWS S3 or compatible enterprise providers, attach this least-privilege policy to the dedicated BetterDrive IAM user:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BetterDriveBucketOperations",
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetBucketLocation"
      ],
      "Resource": "arn:aws:s3:::betterdrive-vault"
    },
    {
      "Sid": "BetterDriveObjectOperations",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:AbortMultipartUpload",
        "s3:ListMultipartUploadParts"
      ],
      "Resource": "arn:aws:s3:::betterdrive-vault/*"
    }
  ]
}
```

---

## 4. Bucket CORS & Access Policy Configuration

When configuring AWS S3, Cloudflare R2, MinIO, Wasabi, or Backblaze B2 for browser-based direct uploads or external integrations, configure CORS:

### S3 Bucket CORS Rules:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": [
      "ETag",
      "Content-Length",
      "Content-Type",
      "x-amz-server-side-encryption"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

---

## 5. Encryption & Credential Safety

All S3 secret keys (`secretAccessKey`) are encrypted with `AES-256-GCM` before database persistence using the host's `TOKEN_ENCRYPTION_KEY`. Raw secret keys are never returned across API endpoints or rendered in client HTML.

