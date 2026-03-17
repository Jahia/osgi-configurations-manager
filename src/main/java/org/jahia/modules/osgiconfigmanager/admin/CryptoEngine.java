package org.jahia.modules.osgiconfigmanager.admin;

/*
  Created based on org.jahia.misc.CryptoEngine
 */

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.security.spec.InvalidKeySpecException;
import java.util.Base64;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class CryptoEngine {
    private static final Logger LOGGER = LoggerFactory.getLogger(CryptoEngine.class);
    private static final byte[] salt = "12345678".getBytes();
    private static final String password = "hardcodedpassword";

    public static String encryptString(String string) {
        int iterationCount = 10; // should be more eg 40000
        int keyLength = 128;
        try {
            SecretKeySpec key = createSecretKey(password.toCharArray(),
                    salt, iterationCount, keyLength);
            return encrypt(string, key);
        } catch (NoSuchAlgorithmException e) {
            LOGGER.error("NoSuchAlgorithmException", e);
        } catch (InvalidKeySpecException e) {
            LOGGER.error("InvalidKeySpecException", e);
        } catch (GeneralSecurityException e) {
            LOGGER.error("GeneralSecurityException", e);
        }
        return string;
    }

    public static String decryptString(String string) {
        int iterationCount = 10; // should be more eg 40000
        int keyLength = 128;
        try {
            SecretKeySpec key = createSecretKey(password.toCharArray(),
                    salt, iterationCount, keyLength);
            return decrypt(string, key);
        } catch (NoSuchAlgorithmException e) {
            LOGGER.error("NoSuchAlgorithmException", e);
        } catch (InvalidKeySpecException e) {
            LOGGER.error("InvalidKeySpecException", e);
        } catch (GeneralSecurityException e) {
            LOGGER.error("GeneralSecurityException", e);
        }
        return string;
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
        String ivString = string.split(":")[0];
        String propertyString = string.split(":")[1];
        byte[] iv = base64Decode(ivString);
        byte[] property = base64Decode(propertyString);

        Cipher pbeCipher;
        if (iv.length == 16) {
            // Fallback for older CBC-encrypted strings
            pbeCipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
            pbeCipher.init(Cipher.DECRYPT_MODE, key, new IvParameterSpec(iv));
        } else {
            pbeCipher = Cipher.getInstance("AES/GCM/NoPadding");
            pbeCipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, iv));
        }
        return new String(pbeCipher.doFinal(property), StandardCharsets.UTF_8);
    }

    private static byte[] base64Decode(String property) {
        return Base64.getDecoder().decode(property);
    }
}
