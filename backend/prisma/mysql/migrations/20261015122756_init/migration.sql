-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` VARCHAR(32) NOT NULL DEFAULT 'member',
    `status` VARCHAR(32) NOT NULL DEFAULT 'active',
    `gravatar_enabled` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_role_idx`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `api_keys` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `key_prefix` VARCHAR(32) NOT NULL,
    `key_hash` VARCHAR(255) NOT NULL,
    `scopes` TEXT NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'active',
    `last_used_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `api_keys_key_hash_key`(`key_hash`),
    INDEX `api_keys_user_id_idx`(`user_id`),
    INDEX `api_keys_user_id_status_created_at_idx`(`user_id`, `status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `upload_routing_policies` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `mode` VARCHAR(32) NOT NULL DEFAULT 'most_available',
    `priority_account_ids` TEXT NOT NULL,
    `round_robin_cursor` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `upload_routing_policies_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_sessions` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `refresh_token_hash` VARCHAR(255) NOT NULL,
    `user_agent` TEXT NULL,
    `ip_address` VARCHAR(64) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `user_sessions_user_id_idx`(`user_id`),
    INDEX `user_sessions_refresh_token_hash_idx`(`refresh_token_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auth_handoffs` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `auth_handoffs_token_hash_key`(`token_hash`),
    INDEX `auth_handoffs_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `provider_configs` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NULL,
    `provider` VARCHAR(32) NOT NULL,
    `client_id_encrypted` TEXT NOT NULL,
    `client_secret_encrypted` TEXT NOT NULL,
    `redirect_uri` TEXT NOT NULL,
    `scopes` TEXT NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `provider_configs_user_id_idx`(`user_id`),
    INDEX `provider_configs_provider_idx`(`provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `oauth_states` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NULL,
    `provider_config_id` CHAR(36) NOT NULL,
    `flow` VARCHAR(32) NOT NULL DEFAULT 'connect',
    `state_hash` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `oauth_states_state_hash_key`(`state_hash`),
    INDEX `oauth_states_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `connected_accounts` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `provider_config_id` CHAR(36) NULL,
    `provider` VARCHAR(32) NOT NULL,
    `provider_account_id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `display_name` VARCHAR(191) NULL,
    `avatar_url` TEXT NULL,
    `access_token_encrypted` TEXT NULL,
    `refresh_token_encrypted` TEXT NULL,
    `token_expires_at` DATETIME(3) NULL,
    `scopes` TEXT NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'connected',
    `last_error` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `connected_accounts_user_id_idx`(`user_id`),
    INDEX `connected_accounts_user_id_status_created_at_idx`(`user_id`, `status`, `created_at`),
    UNIQUE INDEX `connected_accounts_user_id_provider_provider_account_id_key`(`user_id`, `provider`, `provider_account_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `s3_storage_configs` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `connected_account_id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `bucket` VARCHAR(191) NOT NULL,
    `region` VARCHAR(191) NOT NULL,
    `endpoint` TEXT NULL,
    `access_key_id_encrypted` TEXT NOT NULL,
    `secret_access_key_encrypted` TEXT NOT NULL,
    `force_path_style` BOOLEAN NOT NULL DEFAULT false,
    `prefix` VARCHAR(191) NOT NULL DEFAULT 'better-drive',
    `quota_bytes` BIGINT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `s3_storage_configs_connected_account_id_key`(`connected_account_id`),
    INDEX `s3_storage_configs_user_id_idx`(`user_id`),
    INDEX `s3_storage_configs_user_id_status_idx`(`user_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `storage_accounts` (
    `id` CHAR(36) NOT NULL,
    `connected_account_id` CHAR(36) NOT NULL,
    `total_bytes` BIGINT NULL,
    `used_bytes` BIGINT NOT NULL DEFAULT 0,
    `available_bytes` BIGINT NULL,
    `trash_bytes` BIGINT NULL,
    `last_synced_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `storage_accounts_connected_account_id_key`(`connected_account_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `files` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `connected_account_id` CHAR(36) NOT NULL,
    `folder_id` CHAR(36) NULL,
    `provider` VARCHAR(32) NOT NULL,
    `provider_file_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(191) NOT NULL,
    `size_bytes` BIGINT NOT NULL,
    `checksum` VARCHAR(191) NULL,
    `starred` BOOLEAN NOT NULL DEFAULT false,
    `starred_at` DATETIME(3) NULL,
    `last_viewed_at` DATETIME(3) NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `files_user_id_idx`(`user_id`),
    INDEX `files_user_id_status_created_at_idx`(`user_id`, `status`, `created_at`),
    INDEX `files_user_id_status_folder_id_created_at_idx`(`user_id`, `status`, `folder_id`, `created_at`),
    INDEX `files_user_id_status_starred_starred_at_idx`(`user_id`, `status`, `starred`, `starred_at`),
    INDEX `files_user_id_status_updated_at_idx`(`user_id`, `status`, `updated_at`),
    INDEX `files_user_id_checksum_idx`(`user_id`, `checksum`),
    INDEX `files_connected_account_id_idx`(`connected_account_id`),
    INDEX `files_folder_id_idx`(`folder_id`),
    INDEX `files_provider_file_id_idx`(`provider_file_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `file_shares` (
    `id` CHAR(36) NOT NULL,
    `file_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `token_encrypted` TEXT NULL,
    `token_hash` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `download_count` INTEGER NOT NULL DEFAULT 0,
    `last_accessed_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `file_shares_token_hash_key`(`token_hash`),
    INDEX `file_shares_file_id_idx`(`file_id`),
    INDEX `file_shares_user_id_idx`(`user_id`),
    INDEX `file_shares_user_id_enabled_created_at_idx`(`user_id`, `enabled`, `created_at`),
    INDEX `file_shares_file_id_user_id_enabled_created_at_idx`(`file_id`, `user_id`, `enabled`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `file_preview_tokens` (
    `id` CHAR(36) NOT NULL,
    `file_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `file_preview_tokens_token_hash_key`(`token_hash`),
    INDEX `file_preview_tokens_file_id_idx`(`file_id`),
    INDEX `file_preview_tokens_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `folders` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `parent_id` CHAR(36) NULL,
    `connected_account_id` CHAR(36) NULL,
    `provider` VARCHAR(32) NOT NULL DEFAULT 'google_drive',
    `provider_folder_id` VARCHAR(191) NULL,
    `name` VARCHAR(255) NOT NULL,
    `color` VARCHAR(64) NOT NULL DEFAULT 'blue',
    `icon_url` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `folders_user_id_idx`(`user_id`),
    INDEX `folders_user_id_deleted_at_updated_at_idx`(`user_id`, `deleted_at`, `updated_at`),
    INDEX `folders_user_id_deleted_at_parent_id_updated_at_idx`(`user_id`, `deleted_at`, `parent_id`, `updated_at`),
    INDEX `folders_parent_id_idx`(`parent_id`),
    INDEX `folders_connected_account_id_idx`(`connected_account_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `saved_views` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `query` TEXT NOT NULL,
    `icon` VARCHAR(64) NULL,
    `pinned` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `saved_views_user_id_pinned_sort_order_idx`(`user_id`, `pinned`, `sort_order`),
    UNIQUE INDEX `saved_views_user_id_name_key`(`user_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `upload_sessions` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `target_connected_account_id` CHAR(36) NULL,
    `folder_id` CHAR(36) NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(191) NOT NULL,
    `size_bytes` BIGINT NOT NULL,
    `status` VARCHAR(32) NOT NULL,
    `google_session_uri` TEXT NULL,
    `error_message` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,

    INDEX `upload_sessions_user_id_idx`(`user_id`),
    INDEX `upload_sessions_folder_id_idx`(`folder_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity_type` VARCHAR(191) NOT NULL,
    `entity_id` CHAR(36) NULL,
    `metadata` TEXT NULL,
    `ip_address` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_user_id_idx`(`user_id`),
    INDEX `audit_logs_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `audit_logs_action_idx`(`action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workspace_invites` (
    `id` CHAR(36) NOT NULL,
    `inviter_id` CHAR(36) NOT NULL,
    `invitee_email` VARCHAR(191) NOT NULL,
    `target_type` VARCHAR(32) NOT NULL DEFAULT 'file',
    `target_id` CHAR(36) NOT NULL DEFAULT '',
    `role` VARCHAR(32) NOT NULL DEFAULT 'viewer',
    `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
    `revoked_at` DATETIME(3) NULL,
    `accepted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `workspace_invites_invitee_email_idx`(`invitee_email`),
    INDEX `workspace_invites_target_type_target_id_idx`(`target_type`, `target_id`),
    UNIQUE INDEX `workspace_invites_target_unique`(`inviter_id`, `invitee_email`, `target_type`, `target_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `api_keys` ADD CONSTRAINT `api_keys_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `upload_routing_policies` ADD CONSTRAINT `upload_routing_policies_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_sessions` ADD CONSTRAINT `user_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auth_handoffs` ADD CONSTRAINT `auth_handoffs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `provider_configs` ADD CONSTRAINT `provider_configs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oauth_states` ADD CONSTRAINT `oauth_states_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oauth_states` ADD CONSTRAINT `oauth_states_provider_config_id_fkey` FOREIGN KEY (`provider_config_id`) REFERENCES `provider_configs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `connected_accounts` ADD CONSTRAINT `connected_accounts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `connected_accounts` ADD CONSTRAINT `connected_accounts_provider_config_id_fkey` FOREIGN KEY (`provider_config_id`) REFERENCES `provider_configs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `s3_storage_configs` ADD CONSTRAINT `s3_storage_configs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `s3_storage_configs` ADD CONSTRAINT `s3_storage_configs_connected_account_id_fkey` FOREIGN KEY (`connected_account_id`) REFERENCES `connected_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `storage_accounts` ADD CONSTRAINT `storage_accounts_connected_account_id_fkey` FOREIGN KEY (`connected_account_id`) REFERENCES `connected_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `files` ADD CONSTRAINT `files_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `files` ADD CONSTRAINT `files_connected_account_id_fkey` FOREIGN KEY (`connected_account_id`) REFERENCES `connected_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `files` ADD CONSTRAINT `files_folder_id_fkey` FOREIGN KEY (`folder_id`) REFERENCES `folders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file_shares` ADD CONSTRAINT `file_shares_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file_shares` ADD CONSTRAINT `file_shares_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file_preview_tokens` ADD CONSTRAINT `file_preview_tokens_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file_preview_tokens` ADD CONSTRAINT `file_preview_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `folders` ADD CONSTRAINT `folders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `folders` ADD CONSTRAINT `folders_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `folders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `folders` ADD CONSTRAINT `folders_connected_account_id_fkey` FOREIGN KEY (`connected_account_id`) REFERENCES `connected_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `saved_views` ADD CONSTRAINT `saved_views_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `upload_sessions` ADD CONSTRAINT `upload_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `upload_sessions` ADD CONSTRAINT `upload_sessions_target_connected_account_id_fkey` FOREIGN KEY (`target_connected_account_id`) REFERENCES `connected_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `upload_sessions` ADD CONSTRAINT `upload_sessions_folder_id_fkey` FOREIGN KEY (`folder_id`) REFERENCES `folders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workspace_invites` ADD CONSTRAINT `workspace_invites_inviter_id_fkey` FOREIGN KEY (`inviter_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

