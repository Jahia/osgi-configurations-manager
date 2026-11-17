package org.jahia.modules.osgiconfigmanager.admin;

import javax.crypto.AEADBadTagException;
import javax.crypto.Cipher;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

/**
 * The export archive: a payload sealed whole with a password, readable only by this module.
 *
 * <p>Layout: {@code "OCMX"}, a format byte, the PBKDF2 iteration count (4 bytes), a 16-byte salt
 * and a 12-byte nonce, then the AES-256-GCM ciphertext of the gzipped payload. The header is the
 * additional authenticated data, so a changed iteration count or format byte fails like a wrong
 * password. The key comes from the password through PBKDF2-HMAC-SHA256: slow on purpose, since the
 * archive holds the configurations' secrets in clear and may be copied anywhere.
 *
 * <p>Opening refuses an iteration count outside the accepted range before deriving anything (a
 * crafted header must not make the server spin), and stops decompressing past a size cap (a small
 * archive must not expand into memory exhaustion).
 */
final class ConfigArchiveCodec {

    static final int MIN_PASSWORD_LENGTH = 12;
    static final int MAX_PASSWORD_LENGTH = 1024;
    /** The largest payload once decompressed: 500 files of up to 5 MiB would not fit, nor should they. */
    static final int MAX_PAYLOAD_BYTES = 64 * 1024 * 1024;

    private static final byte[] MAGIC = {'O', 'C', 'M', 'X'};
    private static final byte FORMAT_VERSION = 1;
    private static final int ITERATIONS = 600_000;
    private static final int MIN_ITERATIONS = 100_000;
    private static final int MAX_ITERATIONS = 5_000_000;
    private static final int SALT_BYTES = 16;
    private static final int NONCE_BYTES = 12;
    private static final int TAG_BITS = 128;
    private static final int KEY_BITS = 256;
    private static final int HEADER_BYTES = MAGIC.length + 1 + 4 + SALT_BYTES + NONCE_BYTES;

    /** Wrong password, a damaged or truncated file, or not an archive of this module. */
    static final class ArchiveException extends IOException {
        ArchiveException(String message) {
            super(message);
        }

        ArchiveException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    private ConfigArchiveCodec() {
    }

    static void checkPassword(char[] password) throws IOException {
        if (password == null || password.length < MIN_PASSWORD_LENGTH) {
            throw new IOException("The archive password must have at least " + MIN_PASSWORD_LENGTH + " characters");
        }
        if (password.length > MAX_PASSWORD_LENGTH) {
            throw new IOException("The archive password is too long");
        }
    }

    static byte[] seal(byte[] payload, char[] password) throws IOException {
        checkPassword(password);
        SecureRandom random = new SecureRandom();
        byte[] salt = new byte[SALT_BYTES];
        byte[] nonce = new byte[NONCE_BYTES];
        random.nextBytes(salt);
        random.nextBytes(nonce);
        byte[] header = ByteBuffer.allocate(HEADER_BYTES)
                .put(MAGIC).put(FORMAT_VERSION).putInt(ITERATIONS).put(salt).put(nonce).array();
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, deriveKey(password, salt, ITERATIONS), new GCMParameterSpec(TAG_BITS, nonce));
            cipher.updateAAD(header);
            byte[] cipherText = cipher.doFinal(gzip(payload));
            return ByteBuffer.allocate(header.length + cipherText.length).put(header).put(cipherText).array();
        } catch (GeneralSecurityException e) {
            // Fails closed: no archive rather than one sealed in a way nobody checked.
            throw new IllegalStateException("Archive encryption failed", e);
        }
    }

    static byte[] open(byte[] archive, char[] password) throws IOException {
        checkPassword(password);
        if (archive == null || archive.length <= HEADER_BYTES || !Arrays.equals(Arrays.copyOf(archive, MAGIC.length), MAGIC)) {
            throw new ArchiveException("This file is not an archive of the OSGi Configurations Manager");
        }
        ByteBuffer buffer = ByteBuffer.wrap(archive);
        buffer.position(MAGIC.length);
        byte format = buffer.get();
        if (format != FORMAT_VERSION) {
            throw new ArchiveException("This archive was made by a newer version of the OSGi Configurations Manager");
        }
        int iterations = buffer.getInt();
        if (iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS) {
            throw new ArchiveException("The archive is damaged");
        }
        byte[] salt = new byte[SALT_BYTES];
        byte[] nonce = new byte[NONCE_BYTES];
        buffer.get(salt).get(nonce);
        byte[] header = Arrays.copyOf(archive, HEADER_BYTES);
        byte[] cipherText = Arrays.copyOfRange(archive, HEADER_BYTES, archive.length);
        byte[] compressed;
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, deriveKey(password, salt, iterations), new GCMParameterSpec(TAG_BITS, nonce));
            cipher.updateAAD(header);
            compressed = cipher.doFinal(cipherText);
        } catch (AEADBadTagException e) {
            // One message for both: telling them apart would help guess the password.
            throw new ArchiveException("The password is not correct, or the archive is damaged. Check the password and try again.");
        } catch (GeneralSecurityException e) {
            throw new ArchiveException("The password is not correct, or the archive is damaged. Check the password and try again.", e);
        }
        return gunzip(compressed);
    }

    private static SecretKeySpec deriveKey(char[] password, byte[] salt, int iterations) throws GeneralSecurityException {
        PBEKeySpec spec = new PBEKeySpec(password, salt, iterations, KEY_BITS);
        try {
            byte[] key = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
            return new SecretKeySpec(key, "AES");
        } finally {
            spec.clearPassword();
        }
    }

    private static byte[] gzip(byte[] payload) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (GZIPOutputStream gzip = new GZIPOutputStream(out)) {
            gzip.write(payload);
        }
        return out.toByteArray();
    }

    private static byte[] gunzip(byte[] compressed) throws IOException {
        try (InputStream in = new GZIPInputStream(new ByteArrayInputStream(compressed))) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int total = 0;
            int read;
            while ((read = in.read(chunk)) != -1) {
                total += read;
                if (total > MAX_PAYLOAD_BYTES) {
                    throw new ArchiveException("The archive is too large once expanded");
                }
                out.write(chunk, 0, read);
            }
            return out.toByteArray();
        } catch (ArchiveException e) {
            throw e;
        } catch (IOException e) {
            throw new ArchiveException("The archive is damaged", e);
        }
    }

    static String utf8(byte[] bytes) {
        return new String(bytes, StandardCharsets.UTF_8);
    }
}
