package org.jahia.modules.osgiconfigmanager.admin;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Post-fix (SUPPORT-646) verification of {@link CryptoEngine}.
 *
 * <p>The pre-fix characterizations have been INVERTED:
 * <ul>
 *   <li>S1 (inverted): a NEW-scheme value is NOT recoverable from the public hardcoded constants.</li>
 *   <li>Backward-compat: a value written under the OLD hardcoded-key scheme STILL decrypts, so no
 *       already-encrypted secret becomes unreadable after upgrade.</li>
 *   <li>S2 (inverted): a crypto failure now FAILS LOUDLY (throws) instead of silently returning the
 *       input unchanged.</li>
 *   <li>S2b (inverted): malformed base64 is handled (thrown as a controlled IllegalStateException),
 *       not an uncaught IllegalArgumentException.</li>
 *   <li>S3 (invariant): encrypt/decrypt still round-trips; the (new, versioned) envelope is stable;
 *       the IV/salt are random.</li>
 * </ul>
 */
class CryptoEngineTest {

    // Public constants from the OLD scheme — an attacker holding the MIT source knows all of these.
    private static final byte[] LEGACY_SALT = "12345678".getBytes(StandardCharsets.UTF_8);
    private static final String LEGACY_PASSWORD = "hardcodedpassword";
    private static final int LEGACY_ITERATIONS = 10;
    private static final int LEGACY_KEY_LENGTH = 128;

    private static final String OPERATOR_SECRET = "unit-test-operator-secret";

    @BeforeEach
    void useKnownSecret() {
        // Deterministic operator secret so the tests do not depend on the persisted-secret file.
        CryptoEngine.configureSecret(OPERATOR_SECRET.toCharArray());
    }

    @AfterEach
    void clearSecret() {
        CryptoEngine.configureSecret(null);
    }

    private static SecretKeySpec deriveKey(char[] password, byte[] salt, int iterations, int keyLength) throws Exception {
        SecretKeyFactory keyFactory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA512");
        SecretKey keyTmp = keyFactory.generateSecret(new PBEKeySpec(password, salt, iterations, keyLength));
        return new SecretKeySpec(keyTmp.getEncoded(), "AES");
    }

    /** Produce a value in the OLD (pre-fix) envelope: "<b64iv>:<b64ct>" using the hardcoded key. */
    private static String legacyEncrypt(String plaintext) throws Exception {
        SecretKeySpec key = deriveKey(LEGACY_PASSWORD.toCharArray(), LEGACY_SALT, LEGACY_ITERATIONS, LEGACY_KEY_LENGTH);
        byte[] iv = new byte[12];
        new SecureRandom().nextBytes(iv);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
        byte[] ct = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
        return Base64.getEncoder().encodeToString(iv) + ":" + Base64.getEncoder().encodeToString(ct);
    }

    @Test
    @DisplayName("S1 (inverted): a NEW value is NOT decryptable with the public hardcoded constants")
    void newValueNotRecoverableFromPublicConstants() throws Exception {
        // Arrange
        String secret = "s3cr3t-db-password";

        // Act: encrypt with the hardened engine, then TRY to recover it the way an attacker with
        // only the public source (old password) would — even given the visible per-value salt.
        String enc = CryptoEngine.encryptString(secret);
        assertTrue(enc.startsWith("v2:"), "new envelope must be versioned: " + enc);
        String[] parts = enc.substring("v2:".length()).split(":");
        byte[] salt = Base64.getDecoder().decode(parts[0]);
        byte[] iv = Base64.getDecoder().decode(parts[1]);
        byte[] cipherText = Base64.getDecoder().decode(parts[2]);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        // Attacker uses the only password present in public source; the real key derives from a
        // non-public per-instance secret, so the GCM tag must not verify.
        cipher.init(Cipher.DECRYPT_MODE,
                deriveKey(LEGACY_PASSWORD.toCharArray(), salt, LEGACY_ITERATIONS, LEGACY_KEY_LENGTH),
                new GCMParameterSpec(128, iv));

        // Assert: reconstruction from public constants FAILS
        assertThrows(GeneralSecurityException.class, () -> cipher.doFinal(cipherText),
                "a NEW value must not be recoverable with the public hardcoded key");
    }

    @Test
    @DisplayName("Backward-compat (MANDATORY): a value encrypted under the OLD scheme still decrypts")
    void legacyValueStillDecrypts() throws Exception {
        // Arrange: a value that already exists on disk, written by the OLD hardcoded-key code.
        String legacy = legacyEncrypt("legacy-db-password");

        // Act + Assert: the hardened engine still recovers it (no deployment loses its secrets).
        assertEquals("legacy-db-password", CryptoEngine.decryptString(legacy));
    }

    @Test
    @DisplayName("S2 (inverted): a corrupted payload FAILS LOUDLY instead of returning plaintext")
    void corruptedPayloadThrows() {
        // A well-formed new envelope whose ciphertext fails the GCM auth tag must throw.
        String enc = CryptoEngine.encryptString("real-value");
        String[] parts = enc.substring("v2:".length()).split(":");
        byte[] ct = Base64.getDecoder().decode(parts[2]);
        ct[ct.length - 1] ^= 0x01; // corrupt one byte
        String corrupted = "v2:" + parts[0] + ":" + parts[1] + ":" + Base64.getEncoder().encodeToString(ct);

        assertThrows(IllegalStateException.class, () -> CryptoEngine.decryptString(corrupted),
                "a corrupted payload must raise an error, never be returned verbatim");
    }

    @Test
    @DisplayName("S2b (inverted): malformed base64 is handled as a controlled IllegalStateException")
    void malformedBase64IsHandled() {
        // Previously this escaped the catch as an uncaught IllegalArgumentException.
        assertThrows(IllegalStateException.class,
                () -> CryptoEngine.decryptString("not-base64:@@@"));
    }

    @Test
    @DisplayName("S3 (invariant): round-trips; versioned envelope is stable; salt+IV are random")
    void roundTripAndEnvelopeInvariant() {
        String[] inputs = {"", "unicode-éà中文", "line1\nline2\nline3", "value with spaces"};
        for (String input : inputs) {
            String enc = CryptoEngine.encryptString(input);
            assertTrue(enc.matches("^v2:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$"),
                    "Envelope must be v2:<b64salt>:<b64iv>:<b64ct> but was: " + enc);
            assertEquals(input, CryptoEngine.decryptString(enc));
        }

        // Two encryptions of the same input differ (random per-value salt + IV)
        String a = CryptoEngine.encryptString("same-input");
        String b = CryptoEngine.encryptString("same-input");
        assertNotEquals(a, b, "Two encryptions must differ due to random salt/IV");
    }

    @Test
    @DisplayName("Auto-generated per-instance secret round-trips and is persisted (no hardcoded fallback)")
    void persistedSecretRoundTrips(@TempDir Path etc) throws Exception {
        String previous = System.getProperty("karaf.etc");
        try {
            System.setProperty("karaf.etc", etc.toString());
            CryptoEngine.configureSecret(null); // force use of the persisted per-instance secret

            String enc = CryptoEngine.encryptString("persisted-value");
            assertTrue(enc.startsWith("v2:"));
            assertEquals("persisted-value", CryptoEngine.decryptString(enc));

            Path secretFile = etc.resolve(".osgi-config-manager.secret");
            assertTrue(Files.exists(secretFile), "a per-instance secret must be persisted");
            String persisted = new String(Files.readAllBytes(secretFile), StandardCharsets.UTF_8).trim();
            assertNotEquals(LEGACY_PASSWORD, persisted, "the persisted secret must not be the hardcoded literal");
        } finally {
            CryptoEngine.configureSecret(null);
            if (previous == null) {
                System.clearProperty("karaf.etc");
            } else {
                System.setProperty("karaf.etc", previous);
            }
        }
    }
}
