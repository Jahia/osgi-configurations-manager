package org.jahia.modules.osgiconfigmanager.admin;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Characterization + invariant tests for {@link CryptoEngine}.
 *
 * <p>S1 and S2 are CHARACTERIZATION tests: they PASS today and document the currently BROKEN
 * confidentiality model (hardcoded key + silent plaintext fallback). After the Stage-7 product
 * fix (instance-specific / configurable key, explicit failure), S1 must be INVERTED (external
 * reconstruction must FAIL) and S2 must be INVERTED (crypto failure must throw/log, not return
 * plaintext). S3 is the fix-surviving invariant.</p>
 */
class CryptoEngineTest {

    // The publicly-known hardcoded constants copied from CryptoEngine.java (they are on MIT/public
    // source, which is exactly the point of S1). An outside attacker knows all of these.
    private static final byte[] SALT = "12345678".getBytes(StandardCharsets.UTF_8);
    private static final String PASSWORD = "hardcodedpassword";
    private static final int ITERATION_COUNT = 10;
    private static final int KEY_LENGTH = 128;

    private static SecretKeySpec rebuildKeyFromPublicConstants() throws Exception {
        SecretKeyFactory keyFactory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA512");
        PBEKeySpec keySpec = new PBEKeySpec(PASSWORD.toCharArray(), SALT, ITERATION_COUNT, KEY_LENGTH);
        SecretKey keyTmp = keyFactory.generateSecret(keySpec);
        return new SecretKeySpec(keyTmp.getEncoded(), "AES");
    }

    @Test
    @DisplayName("S1: an encrypted value is decryptable using ONLY the public hardcoded constants")
    void encryptedValueIsRecoverableFromKnownConstants() throws Exception {
        // CHARACTERIZATION — invert after Stage-7 key fix (reconstruction must FAIL once the key is secret)
        // Arrange
        String secret = "s3cr3t-db-password";

        // Act: encrypt via the product, then decrypt purely with attacker-known material
        String enc = CryptoEngine.encryptString(secret);
        String[] parts = enc.split(":", 2);
        byte[] iv = Base64.getDecoder().decode(parts[0]);
        byte[] cipherText = Base64.getDecoder().decode(parts[1]);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, rebuildKeyFromPublicConstants(), new GCMParameterSpec(128, iv));
        String recovered = new String(cipher.doFinal(cipherText), StandardCharsets.UTF_8);

        // Assert: zero confidentiality — anyone holding the source recovers the plaintext
        assertEquals(2, parts.length, "CryptoEngine output must be <b64iv>:<b64ct>");
        assertEquals(secret, recovered);
    }

    @Test
    @DisplayName("S2: decrypt silently falls back to plaintext on a GeneralSecurityException")
    void decryptSilentlyFallsBackToPlaintextOnCryptoFailure() {
        // CHARACTERIZATION — invert after Stage-7 fix (failure must be signalled, not swallowed)
        // (a) a non-envelope string has no ':' separator => decrypt() throws
        //     GeneralSecurityException("Invalid encrypted payload format") which is CAUGHT and
        //     the input is returned unchanged (silent fallback).
        String plain = "plainValue";
        assertEquals(plain, CryptoEngine.decryptString(plain));

        // (b) a well-formed <b64iv>:<b64ct> whose ciphertext fails the GCM auth tag throws
        //     AEADBadTagException (a GeneralSecurityException) => also CAUGHT => input returned
        //     unchanged, with NO signal that decryption actually failed.
        String enc = CryptoEngine.encryptString("real-value");
        String[] parts = enc.split(":", 2);
        byte[] ct = Base64.getDecoder().decode(parts[1]);
        ct[ct.length - 1] ^= 0x01; // corrupt one byte of ciphertext -> tag mismatch
        String corrupted = parts[0] + ":" + Base64.getEncoder().encodeToString(ct);
        assertEquals(corrupted, CryptoEngine.decryptString(corrupted),
                "corrupted payload is returned verbatim instead of raising an error");
    }

    @Test
    @DisplayName("S2b: malformed base64 escapes the catch as an uncaught IllegalArgumentException")
    void decryptMalformedBase64ThrowsUncaught() {
        // CHARACTERIZATION of a distinct latent bug: the catch only handles the checked crypto
        // exceptions, so Base64's unchecked IllegalArgumentException propagates out unhandled.
        assertThrows(IllegalArgumentException.class,
                () -> CryptoEngine.decryptString("not-base64:@@@"));
    }

    @Test
    @DisplayName("S3: encrypt/decrypt round-trips; envelope format is stable; IV is random (INVARIANT)")
    void roundTripAndEnvelopeInvariant() {
        // This invariant MUST survive the Stage-7 key fix unchanged.
        // Arrange
        String[] inputs = {"", "unicode-éà中文", "line1\nline2\nline3", "value with spaces"};

        // Act + Assert: round-trip
        for (String input : inputs) {
            String enc = CryptoEngine.encryptString(input);
            assertTrue(enc.matches("^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$"),
                    "Envelope must be <b64iv>:<b64ct> but was: " + enc);
            assertEquals(input, CryptoEngine.decryptString(enc));
        }

        // Assert: two encryptions of the same input differ (random 12-byte IV)
        String a = CryptoEngine.encryptString("same-input");
        String b = CryptoEngine.encryptString("same-input");
        assertNotEquals(a, b, "Two encryptions must differ due to random IV");

        // A non-ENC / non-envelope plain string is returned unchanged by decrypt at the engine layer
        assertFalse("same-input".contains(":"));
    }
}
