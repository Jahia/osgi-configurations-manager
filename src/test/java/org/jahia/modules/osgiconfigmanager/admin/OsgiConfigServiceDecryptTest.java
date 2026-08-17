package org.jahia.modules.osgiconfigmanager.admin;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Graceful degradation of the decrypt READ path.
 *
 * <p>The SUPPORT-646 hardening made {@link CryptoEngine#decryptString(String)} throw on an
 * undecryptable payload instead of silently returning its input. That is correct for the engine,
 * but {@link OsgiConfigService#decrypt(String)} called it without a guard, so an undecryptable
 * {@code ENC(...)} value surfaced as an opaque HTTP 500 through OsgiConfigAction's catch-all.
 *
 * <p>The realistic trigger is not corruption but portability: a v2 value encrypted with one
 * instance's secret cannot be decrypted on another instance, so copying a config between
 * environments used to 500. Reading now degrades to returning the value untouched; writing
 * (encryption) stays fail-closed so a secret is never persisted in clear.
 */
class OsgiConfigServiceDecryptTest {

    private static final String SECRET_A = "instance-a-secret";
    private static final String SECRET_B = "instance-b-secret";

    private OsgiConfigService newService(Path etc) {
        System.setProperty("karaf.etc", etc.toString());
        return new OsgiConfigService();
    }

    @AfterEach
    void clearSecret() {
        CryptoEngine.configureSecret(null);
    }

    @Test
    @DisplayName("decrypt returns the value unchanged when the ENC(...) payload cannot be decrypted")
    void corruptPayloadDegradesInsteadOfThrowing(@TempDir Path etc) {
        OsgiConfigService service = newService(etc);
        CryptoEngine.configureSecret(SECRET_A.toCharArray());

        // Not valid base64, so the engine cannot even parse the envelope.
        String corrupt = "ENC(!!!not-base64!!!)";

        String result = assertDoesNotThrow(() -> service.decrypt(corrupt),
                "an undecryptable payload must not propagate out of the read path");
        assertEquals(corrupt, result, "the value must be handed back untouched");
    }

    @Test
    @DisplayName("decrypt degrades when a v2 value was encrypted with another instance's secret")
    void foreignSecretDegradesInsteadOfThrowing(@TempDir Path etc) {
        OsgiConfigService service = newService(etc);

        // Instance A encrypts...
        CryptoEngine.configureSecret(SECRET_A.toCharArray());
        String encryptedOnA = service.encrypt("s3cr3t-value");

        // ...and the config file is copied to instance B, which holds a different secret.
        CryptoEngine.configureSecret(SECRET_B.toCharArray());

        String result = assertDoesNotThrow(() -> service.decrypt(encryptedOnA),
                "a config copied between environments must not fail the request");
        assertEquals(encryptedOnA, result, "the still-encrypted value must be handed back as-is");
    }

    @Test
    @DisplayName("a value encrypted with the active secret still round-trips")
    void roundTripStillWorks(@TempDir Path etc) {
        OsgiConfigService service = newService(etc);
        CryptoEngine.configureSecret(SECRET_A.toCharArray());

        String encrypted = service.encrypt("plaintext-value");

        assertEquals("plaintext-value", service.decrypt(encrypted),
                "the graceful path must not mask a decryption that should succeed");
    }

    @Test
    @DisplayName("a value that is not wrapped in ENC(...) passes through untouched")
    void plainValuePassesThrough(@TempDir Path etc) {
        OsgiConfigService service = newService(etc);

        assertEquals("just-a-value", service.decrypt("just-a-value"));
        assertEquals("", service.decrypt(""));
    }

    @Test
    @DisplayName("the engine itself still fails loudly — only the service read path degrades")
    void engineContractUnchanged(@TempDir Path etc) {
        newService(etc);
        CryptoEngine.configureSecret(SECRET_A.toCharArray());

        assertThrows(IllegalStateException.class,
                () -> CryptoEngine.decryptString("!!!not-base64!!!"),
                "the hardening must stay in place at the engine level");
    }
}
