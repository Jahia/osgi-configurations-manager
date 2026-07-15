package org.jahia.modules.osgiconfigmanager.admin;

/*
  Created based on org.jahia.misc.CryptoEngine

  SUPPORT-646 hardening:
   - NEW encryptions use a per-instance secret (operator-provided via OSGi config, or an
     auto-generated random secret persisted outside the public source) with a strong KDF
     (PBKDF2WithHmacSHA512, high iteration count) and a random per-value salt carried in a
     versioned envelope ("v2:<b64salt>:<b64iv>:<b64ct>").
   - LEGACY values (the old hardcoded-key scheme "<b64iv>:<b64ct>") STILL decrypt, so no
     already-encrypted secret becomes unreadable after upgrade.
   - Crypto failures now FAIL LOUDLY (throw + [AUDIT] log) instead of silently returning the
     input unchanged, which previously masked failures and could persist/expose plaintext.
 */

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.PosixFilePermission;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.EnumSet;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class CryptoEngine {
    private static final Logger LOGGER = LoggerFactory.getLogger(CryptoEngine.class);

    // ---- LEGACY scheme (pre-SUPPORT-646). DECRYPT-ONLY, kept for backward compatibility. ----
    private static final byte[] LEGACY_SALT = "12345678".getBytes(StandardCharsets.UTF_8);
    private static final String LEGACY_PASSWORD = "hardcodedpassword";
    private static final int LEGACY_ITERATION_COUNT = 10;
    private static final int LEGACY_KEY_LENGTH = 128;

    // ---- NEW scheme (SUPPORT-646). ----
    static final String V2_PREFIX = "v2:";
    private static final int V2_ITERATION_COUNT = 210_000; // OWASP 2023 floor for PBKDF2-HMAC-SHA512
    private static final int V2_KEY_LENGTH = 256;
    private static final int V2_SALT_BYTES = 16;
    private static final int GCM_IV_BYTES = 12; // GCM recommended IV length
    private static final int GCM_TAG_BITS = 128;
    private static final String KDF_ALGORITHM = "PBKDF2WithHmacSHA512";
    private static final String CIPHER_ALGORITHM = "AES/GCM/NoPadding";
    private static final String SECRET_FILE_NAME = ".osgi-config-manager.secret";

    // Operator-provided secret (from OSGi config). When null, a persisted per-instance random
    // secret is used. The hardcoded literal is NEVER used to derive a NEW encryption key.
    private static volatile char[] configuredSecret;
    private static volatile char[] resolvedSecret;

    private CryptoEngine() {
        // utility class
    }

    /**
     * Configure the operator-provided secret (called from OSGi config). Passing null/empty clears
     * it, so the auto-generated per-instance persisted secret is used instead.
     */
    static synchronized void configureSecret(char[] secret) {
        configuredSecret = (secret == null || secret.length == 0) ? null : secret.clone();
        resolvedSecret = null; // force re-resolution on next use
    }

    private static synchronized char[] activeSecret() {
        if (configuredSecret != null) {
            return configuredSecret;
        }
        if (resolvedSecret == null) {
            resolvedSecret = loadOrCreatePersistentSecret();
        }
        return resolvedSecret;
    }

    private static char[] loadOrCreatePersistentSecret() {
        Path secretFile = secretFilePath();
        try {
            if (Files.exists(secretFile)) {
                String existing = new String(Files.readAllBytes(secretFile), StandardCharsets.UTF_8).trim();
                if (!existing.isEmpty()) {
                    return existing.toCharArray();
                }
            }
        } catch (IOException e) {
            LOGGER.error("[AUDIT] Failed to read crypto secret file {}", secretFile, e);
            throw new IllegalStateException("Unable to read encryption secret", e);
        }
        byte[] raw = new byte[32];
        new SecureRandom().nextBytes(raw);
        String encoded = Base64.getEncoder().encodeToString(raw);
        try {
            Files.createDirectories(secretFile.getParent());
            Path tmp = Files.createTempFile(secretFile.getParent(), ".ocm-secret", ".tmp");
            Files.write(tmp, encoded.getBytes(StandardCharsets.UTF_8));
            restrictPermissions(tmp);
            Files.move(tmp, secretFile, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            restrictPermissions(secretFile);
            LOGGER.info("[AUDIT] Generated a new per-instance crypto secret at {}", secretFile);
        } catch (IOException e) {
            LOGGER.error("[AUDIT] Could not persist crypto secret at {}", secretFile, e);
            throw new IllegalStateException("Unable to initialise encryption secret", e);
        }
        return encoded.toCharArray();
    }

    private static Path secretFilePath() {
        String etc = System.getProperty("karaf.etc");
        Path base = (etc != null && !etc.isEmpty())
                ? Paths.get(etc)
                : Paths.get(System.getProperty("java.io.tmpdir"), "osgi-config-manager");
        return base.resolve(SECRET_FILE_NAME);
    }

    private static void restrictPermissions(Path path) {
        try {
            Set<PosixFilePermission> perms = EnumSet.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE);
            Files.setPosixFilePermissions(path, perms);
        } catch (UnsupportedOperationException | IOException e) {
            LOGGER.debug("Could not restrict permissions on {} (non-POSIX filesystem?)", path);
        }
    }

    public static String encryptString(String string) {
        if (string == null) {
            throw new IllegalStateException("Cannot encrypt a null value");
        }
        try {
            byte[] salt = new byte[V2_SALT_BYTES];
            new SecureRandom().nextBytes(salt);
            SecretKeySpec key = createSecretKey(activeSecret(), salt, V2_ITERATION_COUNT, V2_KEY_LENGTH);
            byte[] iv = new byte[GCM_IV_BYTES];
            new SecureRandom().nextBytes(iv);
            Cipher cipher = Cipher.getInstance(CIPHER_ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] cipherText = cipher.doFinal(string.getBytes(StandardCharsets.UTF_8));
            return V2_PREFIX + base64Encode(salt) + ":" + base64Encode(iv) + ":" + base64Encode(cipherText);
        } catch (GeneralSecurityException e) {
            // FAIL LOUDLY — never silently return plaintext
            LOGGER.error("[AUDIT] Encryption failed", e);
            throw new IllegalStateException("Encryption failed", e);
        }
    }

    public static String decryptString(String string) {
        if (string == null) {
            throw new IllegalStateException("Cannot decrypt a null value");
        }
        try {
            if (string.startsWith(V2_PREFIX)) {
                return decryptV2(string);
            }
            return decryptLegacy(string);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            // FAIL LOUDLY — never silently return the (possibly plaintext/corrupt) input, and
            // handle the previously-uncaught IllegalArgumentException from malformed base64.
            LOGGER.error("[AUDIT] Decryption failed for a stored value", e);
            throw new IllegalStateException("Decryption failed", e);
        }
    }

    private static String decryptV2(String string) throws GeneralSecurityException {
        String[] parts = string.substring(V2_PREFIX.length()).split(":");
        if (parts.length != 3) {
            throw new GeneralSecurityException("Invalid v2 encrypted payload format");
        }
        byte[] salt = base64Decode(parts[0]);
        byte[] iv = base64Decode(parts[1]);
        byte[] cipherText = base64Decode(parts[2]);
        if (iv.length != GCM_IV_BYTES) {
            throw new GeneralSecurityException("Unsupported IV length for AES/GCM payload");
        }
        SecretKeySpec key = createSecretKey(activeSecret(), salt, V2_ITERATION_COUNT, V2_KEY_LENGTH);
        return doDecrypt(key, iv, cipherText);
    }

    @SuppressWarnings("java:S5542")
    private static String decryptLegacy(String string) throws GeneralSecurityException {
        String[] parts = string.split(":", 2);
        if (parts.length != 2) {
            throw new GeneralSecurityException("Invalid encrypted payload format");
        }
        byte[] iv = base64Decode(parts[0]);
        byte[] cipherText = base64Decode(parts[1]);
        if (iv.length != GCM_IV_BYTES) {
            throw new GeneralSecurityException("Unsupported IV length for AES/GCM payload");
        }
        SecretKeySpec key = createSecretKey(LEGACY_PASSWORD.toCharArray(), LEGACY_SALT,
                LEGACY_ITERATION_COUNT, LEGACY_KEY_LENGTH);
        return doDecrypt(key, iv, cipherText);
    }

    private static String doDecrypt(SecretKeySpec key, byte[] iv, byte[] cipherText) throws GeneralSecurityException {
        Cipher cipher = Cipher.getInstance(CIPHER_ALGORITHM);
        cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
        return new String(cipher.doFinal(cipherText), StandardCharsets.UTF_8);
    }

    private static SecretKeySpec createSecretKey(char[] password, byte[] salt, int iterationCount, int keyLength)
            throws GeneralSecurityException {
        SecretKeyFactory keyFactory = SecretKeyFactory.getInstance(KDF_ALGORITHM);
        PBEKeySpec keySpec = new PBEKeySpec(password, salt, iterationCount, keyLength);
        SecretKey keyTmp = keyFactory.generateSecret(keySpec);
        return new SecretKeySpec(keyTmp.getEncoded(), "AES");
    }

    private static String base64Encode(byte[] bytes) {
        return Base64.getEncoder().encodeToString(bytes);
    }

    private static byte[] base64Decode(String property) {
        return Base64.getDecoder().decode(property);
    }
}
