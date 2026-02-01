/**
 * Vault/Encryption Helpers
 * Utilities for secure password storage using Supabase Vault or AES-256 fallback
 */

import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.CERT_PASSWORD_ENCRYPTION_KEY || '';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;

/**
 * Check if Supabase Vault is available
 * Note: Vault is typically available in Supabase projects, but we'll implement fallback
 */
export function isVaultAvailable(): boolean {
    // For now, we'll use the fallback encryption approach
    // If you have Vault enabled, you can implement the Vault API calls here
    return false;
}

/**
 * Encrypt password using AES-256-GCM (fallback when Vault is not available)
 */
export function encryptPassword(password: string): string {
    if (!ENCRYPTION_KEY) {
        throw new Error('CERT_PASSWORD_ENCRYPTION_KEY not configured in environment variables');
    }

    // Generate a random IV (Initialization Vector)
    const iv = crypto.randomBytes(IV_LENGTH);

    // Generate a random salt
    const salt = crypto.randomBytes(SALT_LENGTH);

    // Derive key from encryption key and salt
    const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 100000, 32, 'sha512');

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt the password
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get auth tag
    const authTag = cipher.getAuthTag();

    // Combine salt + iv + authTag + encrypted data
    // Format: salt(64) + iv(16) + authTag(16) + encrypted
    const combined = Buffer.concat([
        salt,
        iv,
        authTag,
        Buffer.from(encrypted, 'hex')
    ]);

    return combined.toString('base64');
}

/**
 * Decrypt password using AES-256-GCM
 */
export function decryptPassword(encryptedData: string): string {
    const key = process.env.CERT_PASSWORD_ENCRYPTION_KEY || ENCRYPTION_KEY;
    if (!key) {
        throw new Error('CERT_PASSWORD_ENCRYPTION_KEY not configured in environment variables');
    }

    try {
        // Decode from base64
        const combined = Buffer.from(encryptedData, 'base64');

        // Extract components
        const salt = combined.subarray(0, SALT_LENGTH);
        const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
        const authTag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
        const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

        // Derive key from encryption key and salt
        const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha512');

        // Create decipher
        const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
        decipher.setAuthTag(authTag);

        // Decrypt
        let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        throw new Error('Failed to decrypt password. Data may be corrupted.');
    }
}

/**
 * Store password securely
 * Returns the encrypted password string to be stored in DB
 */
export async function storePassword(password: string): Promise<string> {
    if (isVaultAvailable()) {
        // TODO: Implement Vault storage when available
        // const vaultSecret = await supabase.vault.createSecret(password);
        // return vaultSecret.id;
        throw new Error('Vault not implemented yet');
    } else {
        // Use encryption fallback
        return encryptPassword(password);
    }
}

/**
 * Retrieve password securely
 * Returns the decrypted password
 */
export async function retrievePassword(encryptedOrSecretId: string): Promise<string> {
    if (isVaultAvailable()) {
        // TODO: Implement Vault retrieval when available
        // const secret = await supabase.vault.getSecret(encryptedOrSecretId);
        // return secret.value;
        throw new Error('Vault not implemented yet');
    } else {
        // Use decryption fallback
        return decryptPassword(encryptedOrSecretId);
    }
}

/**
 * Delete password securely
 */
export async function deletePassword(_encryptedOrSecretId: string): Promise<void> {
    if (isVaultAvailable()) {
        // TODO: Implement Vault deletion when available
        // await supabase.vault.deleteSecret(encryptedOrSecretId);
    }
    // For encryption fallback, just return (DB will handle deletion)
    return;
}

/**
 * Generate a random encryption key (for initial setup)
 * Run this once and add to .env.local as CERT_PASSWORD_ENCRYPTION_KEY
 */
export function generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('base64');
}
