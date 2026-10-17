-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN "label" TEXT;

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "invited_by_id" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "accepted_at" DATETIME,
    "revoked_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'in_app',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_connected_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "provider_config_id" TEXT,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "access_token_encrypted" TEXT,
    "refresh_token_encrypted" TEXT,
    "token_expires_at" DATETIME,
    "scopes" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "revoked_at" DATETIME,
    "last_error" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "connected_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "connected_accounts_provider_config_id_fkey" FOREIGN KEY ("provider_config_id") REFERENCES "provider_configs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_connected_accounts" ("access_token_encrypted", "avatar_url", "created_at", "display_name", "email", "id", "last_error", "provider", "provider_account_id", "provider_config_id", "refresh_token_encrypted", "scopes", "status", "token_expires_at", "updated_at", "user_id") SELECT "access_token_encrypted", "avatar_url", "created_at", "display_name", "email", "id", "last_error", "provider", "provider_account_id", "provider_config_id", "refresh_token_encrypted", "scopes", "status", "token_expires_at", "updated_at", "user_id" FROM "connected_accounts";
DROP TABLE "connected_accounts";
ALTER TABLE "new_connected_accounts" RENAME TO "connected_accounts";
CREATE INDEX "connected_accounts_user_id_idx" ON "connected_accounts"("user_id");
CREATE INDEX "connected_accounts_user_id_status_created_at_idx" ON "connected_accounts"("user_id", "status", "created_at");
CREATE UNIQUE INDEX "connected_accounts_user_id_provider_provider_account_id_key" ON "connected_accounts"("user_id", "provider", "provider_account_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");

-- CreateIndex
CREATE INDEX "invitations_email_idx" ON "invitations"("email");

-- CreateIndex
CREATE INDEX "invitations_invited_by_id_idx" ON "invitations"("invited_by_id");

-- CreateIndex
CREATE INDEX "notification_preferences_user_id_idx" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_event_type_channel_key" ON "notification_preferences"("user_id", "event_type", "channel");
