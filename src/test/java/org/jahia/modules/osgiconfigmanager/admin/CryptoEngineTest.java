package org.jahia.modules.osgiconfigmanager.admin;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.crypto.Cipher;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Characterization + hardening tests for the encryption layer.
 *
 * <p>These assert the encrypt/decrypt <em>contract</em> (symmetry, IV randomness, graceful
 * fallback, backward compatibility with legacy payloads, configurable key) rather than any
 * concrete ciphertext, so they remain valid as the key derivation evolves.
 */
class CryptoEngineTest {

    @Test
    @DisplayName("decryptString reverses encryptString (round-trip)")
    void encryptString_thenDecryptString_returnsOriginal() {
        String plaintext = "Sup3r-S3cret/Value:with=symbols";

        String cipher = CryptoEngine.encryptString(plaintext);
        String roundTripped = CryptoEngine.decryptString(cipher);

        assertEquals(plaintext, roundTripped);
    }

    @Test
    @DisplayName("encryptString uses a random salt/IV so the same input yields different ciphertext")
    void encryptString_sameInputTwice_producesDifferentCipherButSamePlaintext() {
        String plaintext = "repeatable-input";

        String cipherA = CryptoEngine.encryptString(plaintext);
        String cipherB = CryptoEngine.encryptString(plaintext);

        assertNotEquals(cipherA, cipherB, "Random salt/IV should make ciphertext non-deterministic");
        assertEquals(plaintext, CryptoEngine.decryptString(cipherA));
        assertEquals(plaintext, CryptoEngine.decryptString(cipherB));
    }

    @Test
    @DisplayName("new ciphertext uses the versioned v2 payload format")
    void encryptString_output_usesV2Format() {
        String cipher = CryptoEngine.encryptString("anything");

        String[] parts = cipher.split(":");
        assertEquals(5, parts.length, "Expected v2:salt:iterations:iv:ciphertext");
        assertEquals("v2", parts[0]);
    }

    @Test
    @DisplayName("decryptString returns the input unchanged when the payload is not recognised")
    void decryptString_unrecognisedPayload_returnsInput() {
        String notEncrypted = "plaintextWithoutSeparator";

        assertEquals(notEncrypted, CryptoEngine.decryptString(notEncrypted));
    }

    @Test
    @DisplayName("legacy (pre-hardening) payloads remain decryptable")
    void decryptString_legacyPayload_stillDecrypts() throws Exception {
        String plaintext = "value-stored-before-upgrade";

        String legacyCipher = legacyEncrypt(plaintext);

        assertEquals(plaintext, CryptoEngine.decryptString(legacyCipher));
    }

    @Test
    @DisplayName("a configured key round-trips and a different key cannot recover the plaintext")
    void configuredKey_roundTripsAndIsolatesPlaintext() {
        String plaintext = "topsecret";
        String cipherWithCustomKey;
        try {
            System.setProperty(CryptoEngine.KEY_PROPERTY, "a-strong-operator-key");
            cipherWithCustomKey = CryptoEngine.encryptString(plaintext);
            assertEquals(plaintext, CryptoEngine.decryptString(cipherWithCustomKey));
        } finally {
            System.clearProperty(CryptoEngine.KEY_PROPERTY);
        }

        // With the custom key gone, the value must NOT decrypt back to the plaintext.
        assertNotEquals(plaintext, CryptoEngine.decryptString(cipherWithCustomKey));
    }

    @Test
    @DisplayName("service encrypt wraps in ENC(...) and decrypt unwraps it")
    void serviceEncryptDecrypt_roundTrip_wrapsWithEncMarker() throws Exception {
        OsgiConfigService service = new OsgiConfigService();
        String plaintext = "db.password.value";

        try {
            System.setProperty(CryptoEngine.KEY_PROPERTY, "a-strong-operator-key");
            String encrypted = service.encrypt(plaintext);
            assertTrue(encrypted.startsWith("ENC(") && encrypted.endsWith(")"),
                    "Service-level encrypt must wrap with the ENC(...) marker");

            assertEquals(plaintext, service.decrypt(encrypted));
        } finally {
            System.clearProperty(CryptoEngine.KEY_PROPERTY);
        }
    }

    @Test
    @DisplayName("service encrypt fails closed when no key is configured and the default is not allowed")
    void serviceEncrypt_defaultKeyNotAllowed_failsClosed() {
        OsgiConfigService service = new OsgiConfigService();

        // No key configured and the insecure default not opted into → must refuse to produce ENC(...).
        java.io.IOException ex = org.junit.jupiter.api.Assertions.assertThrows(
                java.io.IOException.class, () -> service.encrypt("should-not-be-encrypted"));
        assertTrue(ex.getMessage().contains("Encryption key is not configured"),
                "Unexpected message: " + ex.getMessage());
    }

    @Test
    @DisplayName("service encrypt is permitted when the default key is explicitly opted into")
    void serviceEncrypt_defaultKeyAllowed_roundTrips() throws Exception {
        OsgiConfigService service = new OsgiConfigService();
        try {
            System.setProperty(CryptoEngine.ALLOW_DEFAULT_KEY_PROPERTY, "true");
            String encrypted = service.encrypt("dev-value");
            assertTrue(encrypted.startsWith("ENC(") && encrypted.endsWith(")"));
            assertEquals("dev-value", service.decrypt(encrypted));
        } finally {
            System.clearProperty(CryptoEngine.ALLOW_DEFAULT_KEY_PROPERTY);
        }
    }

    @Test
    @DisplayName("service decrypt leaves non-ENC values untouched")
    void serviceDecrypt_plainValue_returnedUnchanged() {
        OsgiConfigService service = new OsgiConfigService();

        assertEquals("not-encrypted", service.decrypt("not-encrypted"));
    }

    @Test
    @DisplayName("service encrypt/decrypt tolerate null")
    void serviceEncryptDecrypt_null_returnsNull() throws Exception {
        OsgiConfigService service = new OsgiConfigService();

        assertNull(service.encrypt(null));
        assertNull(service.decrypt(null));
    }

    /**
     * Reproduces the pre-hardening payload format ({@code base64(iv):base64(ciphertext)} derived
     * with the legacy password/salt/iteration parameters) so the fallback path can be verified.
     */
    private static String legacyEncrypt(String plaintext) throws Exception {
        SecretKeyFactory keyFactory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA512");
        PBEKeySpec keySpec = new PBEKeySpec("hardcodedpassword".toCharArray(),
                "12345678".getBytes(StandardCharsets.UTF_8), 10, 128);
        SecretKeySpec key = new SecretKeySpec(keyFactory.generateSecret(keySpec).getEncoded(), "AES");

        byte[] iv = new byte[12];
        new SecureRandom().nextBytes(iv);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
        byte[] cipherText = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

        Base64.Encoder encoder = Base64.getEncoder();
        return encoder.encodeToString(iv) + ":" + encoder.encodeToString(cipherText);
    }
}
