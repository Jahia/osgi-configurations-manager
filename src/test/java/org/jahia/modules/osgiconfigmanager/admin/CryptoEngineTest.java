package org.jahia.modules.osgiconfigmanager.admin;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Characterization tests for the encryption layer.
 *
 * <p>These intentionally assert the encrypt/decrypt <em>contract</em> (symmetry, IV randomness,
 * graceful fallback) rather than any concrete ciphertext, so they survive a future hardening of
 * the key derivation (random salt / higher iteration count / externalized key).
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
    @DisplayName("encryptString uses a random IV so the same input yields different ciphertext")
    void encryptString_sameInputTwice_producesDifferentCipherButSamePlaintext() {
        String plaintext = "repeatable-input";

        String cipherA = CryptoEngine.encryptString(plaintext);
        String cipherB = CryptoEngine.encryptString(plaintext);

        assertNotEquals(cipherA, cipherB, "Random IV should make ciphertext non-deterministic");
        assertEquals(plaintext, CryptoEngine.decryptString(cipherA));
        assertEquals(plaintext, CryptoEngine.decryptString(cipherB));
    }

    @Test
    @DisplayName("encrypted payload carries the iv:ciphertext separator")
    void encryptString_output_containsIvSeparator() {
        String cipher = CryptoEngine.encryptString("anything");

        assertTrue(cipher.contains(":"), "Expected base64(iv):base64(ciphertext) format");
    }

    @Test
    @DisplayName("decryptString returns the input unchanged when the payload has no iv separator")
    void decryptString_malformedPayloadWithoutSeparator_returnsInput() {
        // decrypt() throws GeneralSecurityException for a payload lacking the ':' separator,
        // which decryptString swallows and falls back to returning the original string.
        String notEncrypted = "plaintextWithoutSeparator";

        assertEquals(notEncrypted, CryptoEngine.decryptString(notEncrypted));
    }

    @Test
    @DisplayName("service encrypt wraps in ENC(...) and decrypt unwraps it")
    void serviceEncryptDecrypt_roundTrip_wrapsWithEncMarker() {
        OsgiConfigService service = new OsgiConfigService();
        String plaintext = "db.password.value";

        String encrypted = service.encrypt(plaintext);
        assertTrue(encrypted.startsWith("ENC(") && encrypted.endsWith(")"),
                "Service-level encrypt must wrap with the ENC(...) marker");

        assertEquals(plaintext, service.decrypt(encrypted));
    }

    @Test
    @DisplayName("service decrypt leaves non-ENC values untouched")
    void serviceDecrypt_plainValue_returnedUnchanged() {
        OsgiConfigService service = new OsgiConfigService();

        assertEquals("not-encrypted", service.decrypt("not-encrypted"));
    }

    @Test
    @DisplayName("service encrypt/decrypt tolerate null")
    void serviceEncryptDecrypt_null_returnsNull() {
        OsgiConfigService service = new OsgiConfigService();

        assertNull(service.encrypt(null));
        assertNull(service.decrypt(null));
    }
}
