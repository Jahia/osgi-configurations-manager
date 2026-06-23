package org.jahia.modules.osgiconfigmanager.admin;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class CryptoEngineTest {

    @Test
    void encryptThenDecryptReturnsOriginalValue() {
        String plaintext = "my-secret-value";

        String encrypted = CryptoEngine.encryptString(plaintext);

        assertNotEquals(plaintext, encrypted);
        assertEquals(plaintext, CryptoEngine.decryptString(encrypted));
    }

    @Test
    void encryptProducesDifferentCiphertextEachTimeButRoundTrips() {
        String plaintext = "another-secret";

        String first = CryptoEngine.encryptString(plaintext);
        String second = CryptoEngine.encryptString(plaintext);

        // Random IV per call -> ciphertext differs
        assertNotEquals(first, second);
        assertEquals(plaintext, CryptoEngine.decryptString(first));
        assertEquals(plaintext, CryptoEngine.decryptString(second));
    }

    @Test
    void decryptFailsClosedOnMalformedPayload() {
        // Missing the iv:cipher separator -> GeneralSecurityException -> IllegalStateException
        assertThrows(IllegalStateException.class, () -> CryptoEngine.decryptString("not-a-valid-payload"));
    }
}
