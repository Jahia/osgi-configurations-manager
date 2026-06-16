package org.jahia.modules.osgiconfigmanager.admin;

/*
  Created based on org.jahia.misc.CryptoEngine
 */

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.concurrent.atomic.AtomicBoolean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Reversible value encryption for {@code ENC(...)} configuration properties.
 *
 * <p>The encryption key is resolved from the {@value #KEY_PROPERTY} system property (or the
 * {@value #KEY_ENV} environment variable). When neither is set the engine can fall back to a
 * built-in default key (obfuscation only); callers should consult {@link #isUsingDefaultKey()} and
 * refuse to produce new {@code ENC(...)} values in that state unless the insecure default has been
 * explicitly opted into via {@value #ALLOW_DEFAULT_KEY_PROPERTY}. Decryption with the default key
 * always works so existing data and tests keep functioning.
 *
 * <p>New values are written in a versioned {@code v2} payload that embeds a random per-value salt
 * and the PBKDF2 iteration count, so iteration count and salt can evolve without breaking existing
 * data. Legacy payloads (produced before this hardening) are still decryptable through a dedicated
 * fallback, so upgrading does not invalidate already-stored secrets.
 */
public final class CryptoEngine {

    private static final Logger LOGGER = LoggerFactory.getLogger(CryptoEngine.class);

    static final String KEY_PROPERTY = "org.jahia.modules.osgiconfigmanager.encryption.key";
    static final String KEY_ENV = "OSGI_CONFIG_MANAGER_ENCRYPTION_KEY";
    static final String ITERATIONS_PROPERTY = "org.jahia.modules.osgiconfigmanager.encryption.iterations";
    // Opt back into the (insecure) built-in default key, e.g. for local development or tests.
    // Defaults to false so production fails closed instead of writing breakable ciphertext.
    static final String ALLOW_DEFAULT_KEY_PROPERTY = "org.jahia.modules.osgiconfigmanager.encryption.allowDefaultKey";

    private static final String VERSION_V2 = "v2";
    private static final String PAYLOAD_SEPARATOR = ":";
    private static final String KEY_DERIVATION_ALGORITHM = "PBKDF2WithHmacSHA512";
    private static final String CIPHER_TRANSFORMATION = "AES/GCM/NoPadding";
    private static final String SECRET_KEY_ALGORITHM = "AES";
    private static final int GCM_TAG_BITS = 128;
    private static final int IV_LENGTH = 12; // GCM recommended IV length
    private static final int V2_SALT_LENGTH = 16;
    private static final int V2_KEY_BITS = 256;
    private static final int V2_DEFAULT_ITERATIONS = 210_000; // OWASP 2023 floor for PBKDF2-HMAC-SHA512

    // Legacy parameters retained ONLY to decrypt values produced before the hardening.
    private static final byte[] LEGACY_SALT = "12345678".getBytes(StandardCharsets.UTF_8);
    private static final char[] LEGACY_PASSWORD = "hardcodedpassword".toCharArray();
    private static final int LEGACY_ITERATIONS = 10;
    private static final int LEGACY_KEY_BITS = 128;

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final AtomicBoolean DEFAULT_KEY_WARNING_EMITTED = new AtomicBoolean(false);
    private static final AtomicBoolean LEGACY_DECRYPT_WARNING_EMITTED = new AtomicBoolean(false);

    private CryptoEngine() {
        // Utility class
    }

    public static String encryptString(String string) {
        if (string == null) {
            return null;
        }
        try {
            byte[] salt = new byte[V2_SALT_LENGTH];
            RANDOM.nextBytes(salt);
            int iterations = configuredIterations();
            SecretKeySpec key = deriveKey(resolvePassword(), salt, iterations, V2_KEY_BITS);

            byte[] iv = new byte[IV_LENGTH];
            RANDOM.nextBytes(iv);
            Cipher cipher = Cipher.getInstance(CIPHER_TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] cipherText = cipher.doFinal(string.getBytes(StandardCharsets.UTF_8));

            return String.join(PAYLOAD_SEPARATOR,
                    VERSION_V2,
                    base64Encode(salt),
                    Integer.toString(iterations),
                    base64Encode(iv),
                    base64Encode(cipherText));
        } catch (GeneralSecurityException e) {
            LOGGER.error("Encryption failed", e);
            return string;
        }
    }

    public static String decryptString(String string) {
        if (string == null) {
            return null;
        }
        try {
            String[] parts = string.split(PAYLOAD_SEPARATOR);
            if (parts.length == 5 && VERSION_V2.equals(parts[0])) {
                return decryptV2(parts);
            }
            if (parts.length == 2) {
                return decryptLegacy(parts);
            }
            throw new GeneralSecurityException("Unrecognized encrypted payload format");
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            // Not a (valid) ciphertext we can decrypt: fall back to returning the input unchanged,
            // matching the historical behaviour relied upon by callers.
            LOGGER.error("Decryption failed", e);
            return string;
        }
    }

    private static String decryptV2(String[] parts) throws GeneralSecurityException {
        byte[] salt = base64Decode(parts[1]);
        int iterations = parsePositiveInt(parts[2]);
        byte[] iv = base64Decode(parts[3]);
        byte[] cipherText = base64Decode(parts[4]);
        SecretKeySpec key = deriveKey(resolvePassword(), salt, iterations, V2_KEY_BITS);
        return doDecrypt(key, iv, cipherText);
    }

    @SuppressWarnings("java:S5542")
    private static String decryptLegacy(String[] parts) throws GeneralSecurityException {
        warnLegacyDecryptOnce();
        byte[] iv = base64Decode(parts[0]);
        byte[] cipherText = base64Decode(parts[1]);
        SecretKeySpec key = deriveKey(LEGACY_PASSWORD, LEGACY_SALT, LEGACY_ITERATIONS, LEGACY_KEY_BITS);
        return doDecrypt(key, iv, cipherText);
    }

    @SuppressWarnings("java:S5542")
    private static String doDecrypt(SecretKeySpec key, byte[] iv, byte[] cipherText) throws GeneralSecurityException {
        if (iv.length != IV_LENGTH) {
            throw new GeneralSecurityException("Unsupported IV length for AES/GCM payload");
        }
        Cipher cipher = Cipher.getInstance(CIPHER_TRANSFORMATION);
        cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
        return new String(cipher.doFinal(cipherText), StandardCharsets.UTF_8);
    }

    private static SecretKeySpec deriveKey(char[] password, byte[] salt, int iterationCount, int keyBits)
            throws GeneralSecurityException {
        SecretKeyFactory keyFactory = SecretKeyFactory.getInstance(KEY_DERIVATION_ALGORITHM);
        PBEKeySpec keySpec = new PBEKeySpec(password, salt, iterationCount, keyBits);
        try {
            SecretKey derived = keyFactory.generateSecret(keySpec);
            return new SecretKeySpec(derived.getEncoded(), SECRET_KEY_ALGORITHM);
        } finally {
            keySpec.clearPassword();
        }
    }

    private static char[] resolvePassword() {
        String configured = configuredKey();
        if (configured != null) {
            return configured.toCharArray();
        }
        warnDefaultKeyOnce();
        return LEGACY_PASSWORD.clone();
    }

    /**
     * @return the operator-configured encryption key, or {@code null} when none is set.
     */
    private static String configuredKey() {
        String configured = System.getProperty(KEY_PROPERTY);
        if (configured == null || configured.isEmpty()) {
            configured = System.getenv(KEY_ENV);
        }
        return (configured != null && !configured.isEmpty()) ? configured : null;
    }

    /**
     * @return {@code true} when no encryption key is configured and the engine would fall back to
     *         the built-in default (obfuscation-only) key. Callers should refuse to produce new
     *         {@code ENC(...)} values in this state unless {@link #isDefaultKeyAllowed()} is set.
     */
    public static boolean isUsingDefaultKey() {
        return configuredKey() == null;
    }

    /**
     * @return {@code true} when the insecure built-in default key has been explicitly opted into via
     *         {@value #ALLOW_DEFAULT_KEY_PROPERTY} (intended for local development and tests only).
     */
    public static boolean isDefaultKeyAllowed() {
        return Boolean.parseBoolean(System.getProperty(ALLOW_DEFAULT_KEY_PROPERTY, "false"));
    }

    private static int configuredIterations() {
        String configured = System.getProperty(ITERATIONS_PROPERTY);
        if (configured != null && !configured.trim().isEmpty()) {
            try {
                int parsed = Integer.parseInt(configured.trim());
                if (parsed > 0) {
                    return parsed;
                }
                LOGGER.warn("Ignoring non-positive {} value '{}'", ITERATIONS_PROPERTY, configured);
            } catch (NumberFormatException e) {
                LOGGER.warn("Ignoring invalid {} value '{}'", ITERATIONS_PROPERTY, configured);
            }
        }
        return V2_DEFAULT_ITERATIONS;
    }

    private static int parsePositiveInt(String value) throws GeneralSecurityException {
        try {
            int parsed = Integer.parseInt(value);
            if (parsed <= 0) {
                throw new GeneralSecurityException("Non-positive iteration count in payload");
            }
            return parsed;
        } catch (NumberFormatException e) {
            throw new GeneralSecurityException("Invalid iteration count in payload", e);
        }
    }

    private static void warnDefaultKeyOnce() {
        if (DEFAULT_KEY_WARNING_EMITTED.compareAndSet(false, true)) {
            LOGGER.warn("OSGi Configurations Manager is using the built-in default encryption key. "
                    + "Encrypted values are NOT confidential in this mode. Set the '{}' system property "
                    + "(or the {} environment variable) to a strong secret to protect them.",
                    KEY_PROPERTY, KEY_ENV);
        }
    }

    private static void warnLegacyDecryptOnce() {
        if (LEGACY_DECRYPT_WARNING_EMITTED.compareAndSet(false, true)) {
            LOGGER.warn("OSGi Configurations Manager decrypted a value stored in the pre-v2 (legacy) "
                    + "format. Re-save the affected configuration(s) to migrate them to the hardened "
                    + "v2 format; the legacy fallback exists only for backward compatibility.");
        }
    }

    private static String base64Encode(byte[] bytes) {
        return Base64.getEncoder().encodeToString(bytes);
    }

    private static byte[] base64Decode(String value) {
        return Base64.getDecoder().decode(value);
    }
}
