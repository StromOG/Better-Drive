-- CreateTable
CREATE TABLE "sftp_access_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "allow_read" BOOLEAN NOT NULL DEFAULT true,
    "allow_write" BOOLEAN NOT NULL DEFAULT false,
    "allow_delete" BOOLEAN NOT NULL DEFAULT false,
    "allowed_roots" TEXT NOT NULL,
    "max_upload_bytes" BIGINT,
    "ip_allowlist" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "sftp_access_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sftp_authorized_keys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profile_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "public_key" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "last_used_at" DATETIME,
    "revoked_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sftp_authorized_keys_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "sftp_access_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sftp_session_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key_id" TEXT,
    "user_id" TEXT,
    "remote_ip" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "path" TEXT,
    "bytes" BIGINT,
    "outcome" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sftp_session_logs_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "sftp_authorized_keys" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "sftp_access_profiles_user_id_idx" ON "sftp_access_profiles"("user_id");

-- CreateIndex
CREATE INDEX "sftp_access_profiles_user_id_enabled_idx" ON "sftp_access_profiles"("user_id", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "sftp_authorized_keys_fingerprint_key" ON "sftp_authorized_keys"("fingerprint");

-- CreateIndex
CREATE INDEX "sftp_authorized_keys_profile_id_idx" ON "sftp_authorized_keys"("profile_id");

-- CreateIndex
CREATE INDEX "sftp_authorized_keys_fingerprint_idx" ON "sftp_authorized_keys"("fingerprint");

-- CreateIndex
CREATE INDEX "sftp_session_logs_created_at_idx" ON "sftp_session_logs"("created_at");

-- CreateIndex
CREATE INDEX "sftp_session_logs_key_id_idx" ON "sftp_session_logs"("key_id");

-- CreateIndex
CREATE INDEX "sftp_session_logs_user_id_idx" ON "sftp_session_logs"("user_id");
