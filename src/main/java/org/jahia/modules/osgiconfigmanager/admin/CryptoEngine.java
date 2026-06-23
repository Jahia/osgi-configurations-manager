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
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.security.spec.InvalidKeySpecException;
import java.util.Base64;

public class CryptoEngine {
    // Hardcoded obfuscation keys mirroring Jahia core's org.jahia.misc.CryptoEngine.
    // These MUST NOT be changed or externalized: doing so would break already-encrypted values.
    private static final byte[] SALT = "12345678".getBytes();
    private static final String PASSWORD = "hardcodedpassword";
    private static final int ITERATION_COUNT = 10; // should be more eg 40000
    private static final int KEY_LENGTH = 128;

    private CryptoEngine() {
        // Utility class - prevent instantiation
    }

    public static String encryptString(String string) {
        try {
            SecretKeySpec key = createSecretKey(PASSWORD.toCharArray(),
                    SALT, ITERATION_COUNT, KEY_LENGTH);
            return encrypt(string, key);
        } catch (GeneralSecurityException e) {
            // Fail closed: never return the plaintext on failure, otherwise a secret
            // would be silently stored unencrypted. The cause is carried for the caller to log.
            throw new IllegalStateException("Failed to encrypt configuration value", e);
        }
    }

    public static String decryptString(String string) {
        try {
            SecretKeySpec key = createSecretKey(PASSWORD.toCharArray(),
                    SALT, ITERATION_COUNT, KEY_LENGTH);
            return decrypt(string, key);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Failed to decrypt configuration value", e);
        }
    }

    private static SecretKeySpec createSecretKey(char[] password, byte[] salt, int iterationCount, int keyLength)
            throws NoSuchAlgorithmException, InvalidKeySpecException {
        SecretKeyFactory keyFactory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA512");
        PBEKeySpec keySpec = new PBEKeySpec(password, salt, iterationCount, keyLength);
        SecretKey keyTmp = keyFactory.generateSecret(keySpec);
        return new SecretKeySpec(keyTmp.getEncoded(), "AES");
    }

    private static String encrypt(String property, SecretKeySpec key)
            throws GeneralSecurityException {
        Cipher pbeCipher = Cipher.getInstance("AES/GCM/NoPadding");
        byte[] iv = new byte[12]; // GCM recommended IV length is 12 bytes
        new SecureRandom().nextBytes(iv);
        GCMParameterSpec parameterSpec = new GCMParameterSpec(128, iv); // 128-bit authentication tag
        pbeCipher.init(Cipher.ENCRYPT_MODE, key, parameterSpec);
        byte[] cryptoText = pbeCipher.doFinal(property.getBytes(StandardCharsets.UTF_8));
        return base64Encode(iv) + ":" + base64Encode(cryptoText);
    }

    private static String base64Encode(byte[] bytes) {
        return Base64.getEncoder().encodeToString(bytes);
    }

    @SuppressWarnings("java:S5542")
    private static String decrypt(String string, SecretKeySpec key) throws GeneralSecurityException {
        String[] parts = string.split(":", 2);
        if (parts.length != 2) {
            throw new GeneralSecurityException("Invalid encrypted payload format");
        }

        String ivString = parts[0];
        String propertyString = parts[1];
        byte[] iv = base64Decode(ivString);
        byte[] property = base64Decode(propertyString);

        if (iv.length != 12) {
            throw new GeneralSecurityException("Unsupported IV length for AES/GCM payload");
        }

        Cipher pbeCipher = Cipher.getInstance("AES/GCM/NoPadding");
        pbeCipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, iv));
        return new String(pbeCipher.doFinal(property), StandardCharsets.UTF_8);
    }

    private static byte[] base64Decode(String property) {
        return Base64.getDecoder().decode(property);
    }
}
