package org.jahia.modules.osgiconfigmanager.admin;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * One-time migration of the unbound encrypted values (v2 and legacy) of an instance to v3 values
 * bound to their configuration (SEC-603). Each configuration file of {@code karaf/etc} is read as
 * text and only its {@code ENC(...)} values are replaced, so comments, order and layout are kept.
 * Once done, a marker file is written next to the instance secret and unbound values are refused:
 * a value copied into another configuration after the migration can no longer be decrypted there.
 *
 * <p>The migration runs at the manager's start, before the consumers are delivered again. On a
 * cluster every node runs it on the files it holds; Jahia replicates the rewritten files, and a
 * file already migrated elsewhere simply holds no unbound value any more. A value that does not
 * decrypt with this instance's secret (a file copied from another instance) is left as is: it did
 * not decrypt before either.
 */
final class EnvelopeMigration {

    private static final Logger LOGGER = LoggerFactory.getLogger(EnvelopeMigration.class);
    static final Pattern ENVELOPE = Pattern.compile("ENC\\(([^()\\s]+)\\)");

    /** What a pass did: the files rewritten, the values rebound, the values left as they were. */
    static final class Result {
        final Set<String> rewrittenFiles;
        final int rebound;
        final int undecryptable;

        Result(Set<String> rewrittenFiles, int rebound, int undecryptable) {
            this.rewrittenFiles = Collections.unmodifiableSet(rewrittenFiles);
            this.rebound = rebound;
            this.undecryptable = undecryptable;
        }
    }

    private EnvelopeMigration() {
    }

    /**
     * Runs the migration unless this instance already did (marker present), then refuses unbound
     * values. Returns what was done, or an empty result.
     */
    static Result runOnce(Path etcDirectory, String selfPid) {
        if (etcDirectory == null || !Files.isDirectory(etcDirectory)) {
            return new Result(new HashSet<>(), 0, 0);
        }
        Path marker = CryptoEngine.migrationMarkerPath();
        if (Files.exists(marker)) {
            CryptoEngine.refuseUnbound();
            return new Result(new HashSet<>(), 0, 0);
        }
        Result result = migrate(etcDirectory, selfPid);
        try {
            Files.write(marker, ("v3 since " + java.time.Instant.now() + "\n").getBytes(StandardCharsets.UTF_8));
            CryptoEngine.refuseUnbound();
            LOGGER.info("[AUDIT] Encrypted values bound to their configuration (v3): {} value(s) rebound in {} file(s), "
                    + "{} left as they were (not decryptable with this instance's secret); unbound values are refused "
                    + "from now on", result.rebound, result.rewrittenFiles.size(), result.undecryptable);
        } catch (IOException e) {
            // Without the marker the next start runs the (idempotent) pass again; unbound values stay accepted meanwhile.
            LOGGER.error("[AUDIT] Could not write {}: unbound encrypted values are still accepted", marker, e);
        }
        return result;
    }

    /** Rebinds the unbound values of every configuration file of the directory, the manager's own excepted. */
    static Result migrate(Path etcDirectory, String selfPid) {
        Set<String> rewritten = new HashSet<>();
        int rebound = 0;
        int undecryptable = 0;
        try (Stream<Path> files = Files.list(etcDirectory)) {
            for (Path file : (Iterable<Path>) files::iterator) {
                String name = file.getFileName().toString();
                if (!Files.isRegularFile(file) || !OsgiConfigService.isSupportedConfigFilename(name)
                        || ConfigFileFilter.isConfigurationFileOf(selfPid, name)) {
                    continue;
                }
                String text;
                try {
                    text = new String(Files.readAllBytes(file), StandardCharsets.UTF_8);
                } catch (IOException e) {
                    LOGGER.warn("Could not read {} to bind its encrypted values", name, e);
                    continue;
                }
                String binding = EnvelopeBinding.ofFile(name);
                Matcher matcher = ENVELOPE.matcher(text);
                StringBuffer out = new StringBuffer();
                int fileRebound = 0;
                while (matcher.find()) {
                    String inner = matcher.group(1);
                    String replacement = matcher.group();
                    if (!CryptoEngine.isBound(inner)) {
                        try {
                            String plain = CryptoEngine.decryptUnbound(inner);
                            replacement = "ENC(" + CryptoEngine.encryptBound(plain, binding) + ")";
                            fileRebound++;
                        } catch (RuntimeException e) {
                            undecryptable++;
                            LOGGER.warn("An encrypted value of {} does not decrypt with this instance's secret; left as is", name);
                        }
                    }
                    matcher.appendReplacement(out, Matcher.quoteReplacement(replacement));
                }
                matcher.appendTail(out);
                if (fileRebound == 0) {
                    continue;
                }
                try {
                    Path tmp = Files.createTempFile(etcDirectory, ".ocm-migration", ".tmp");
                    Files.write(tmp, out.toString().getBytes(StandardCharsets.UTF_8));
                    Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
                    rewritten.add(name);
                    rebound += fileRebound;
                } catch (IOException e) {
                    LOGGER.error("Could not rewrite {} with its bound encrypted values", name, e);
                }
            }
        } catch (IOException e) {
            LOGGER.error("Could not list {} to bind the encrypted values", etcDirectory, e);
        }
        return new Result(rewritten, rebound, undecryptable);
    }
}
