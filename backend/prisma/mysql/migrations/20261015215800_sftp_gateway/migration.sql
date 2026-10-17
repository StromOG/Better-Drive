-- CreateTable
CREATE TABLE `sftp_access_profiles` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `allow_read` BOOLEAN NOT NULL DEFAULT true,
    `allow_write` BOOLEAN NOT NULL DEFAULT false,
    `allow_delete` BOOLEAN NOT NULL DEFAULT false,
    `allowed_roots` TEXT NOT NULL,
    `max_upload_bytes` BIGINT NULL,
    `ip_allowlist` TEXT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `sftp_access_profiles_user_id_idx`(`user_id`),
    INDEX `sftp_access_profiles_user_id_enabled_idx`(`user_id`, `enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sftp_authorized_keys` (
    `id` CHAR(36) NOT NULL,
    `profile_id` CHAR(36) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `public_key` TEXT NOT NULL,
    `fingerprint` VARCHAR(191) NOT NULL,
    `last_used_at` DATETIME(3) NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `sftp_authorized_keys_fingerprint_key`(`fingerprint`),
    INDEX `sftp_authorized_keys_profile_id_idx`(`profile_id`),
    INDEX `sftp_authorized_keys_fingerprint_idx`(`fingerprint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sftp_session_logs` (
    `id` CHAR(36) NOT NULL,
    `key_id` CHAR(36) NULL,
    `user_id` CHAR(36) NULL,
    `remote_ip` VARCHAR(64) NOT NULL,
    `event` VARCHAR(32) NOT NULL,
    `path` TEXT NULL,
    `bytes` BIGINT NULL,
    `outcome` VARCHAR(32) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sftp_session_logs_created_at_idx`(`created_at`),
    INDEX `sftp_session_logs_key_id_idx`(`key_id`),
    INDEX `sftp_session_logs_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sftp_access_profiles` ADD CONSTRAINT `sftp_access_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sftp_authorized_keys` ADD CONSTRAINT `sftp_authorized_keys_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `sftp_access_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sftp_session_logs` ADD CONSTRAINT `sftp_session_logs_key_id_fkey` FOREIGN KEY (`key_id`) REFERENCES `sftp_authorized_keys`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
