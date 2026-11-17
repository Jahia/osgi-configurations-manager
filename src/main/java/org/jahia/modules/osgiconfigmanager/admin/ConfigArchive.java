package org.jahia.modules.osgiconfigmanager.admin;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.osgi.framework.Bundle;
import org.osgi.framework.BundleContext;
import org.osgi.framework.Version;
import org.osgi.service.metatype.AttributeDefinition;
import org.osgi.service.metatype.ObjectClassDefinition;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Exports several configuration files into one password-sealed archive, and imports them on another
 * instance.
 *
 * <p>Secrets: a file keeps its text as stored, {@code ENC(...)} envelopes included, and the archive
 * lists each envelope with its value in clear. On import every listed envelope is replaced by a new
 * one, encrypted with the target's secret and bound to the target file (SEC-603), so nothing has to
 * be re-escaped in the file's syntax. An envelope this instance cannot decrypt is exported as is and
 * reported: it will not decrypt on the target either. A secret stored in clear stays in clear, and
 * the import preview names it.
 *
 * <p>Each file also records the bundles that use its configuration and their versions (and the
 * bundle describing it, its Metatype), and the archive the Jahia version. The import preview
 * compares them with the target. It informs and never blocks: what can refuse a file is only what
 * refuses a save, its name and the caller's rights.
 *
 * <p>The manager's own configuration is never exported nor imported: it holds the secret every
 * other value is encrypted with.
 */
final class ConfigArchive {

    static final int MAX_FILES = 500;
    /** The decoded archive: what 500 typical configuration files take, with a wide margin. */
    static final int MAX_ARCHIVE_BYTES = 32 * 1024 * 1024;
    static final int FORMAT = 1;

    static final String SAME = "SAME";
    static final String OLDER = "OLDER";
    static final String NEWER = "NEWER";
    static final String DIFFERENT = "DIFFERENT";
    static final String ABSENT = "ABSENT";
    static final String UNKNOWN = "UNKNOWN";

    private static final String TOO_LARGE_TO_EXPORT =
            "The selected files are too large for one archive: export them in several archives";
    private static final Logger LOGGER = LoggerFactory.getLogger(ConfigArchive.class);
    private static final Pattern LOG_UNSAFE = Pattern.compile("[\\p{Cntrl}\\u2028\\u2029]");
    private static final ObjectMapper MAPPER = new ObjectMapper();
    /** An encrypted value as the manager writes it: no space and no parenthesis inside. */
    private static final Pattern ENVELOPE = Pattern.compile("ENC\\(([^()\\s]+)\\)");
    /** secretMask.js's rule for a name that looks like a secret, so that both sides agree. */
    private static final Pattern SECRET_NAME =
            Pattern.compile("pass(?:word|wd|phrase)|secret|token|credential|api[._-]?key|private[._-]?key", Pattern.CASE_INSENSITIVE);
    /** Keys the framework adds to a configuration, which no Metatype declares. */
    private static final Pattern FRAMEWORK_KEY = Pattern.compile("^(service\\.|felix\\.|component\\.|:org\\.apache\\.felix\\.).*");
    private static final DateTimeFormatter FILE_STAMP = DateTimeFormatter.ofPattern("yyyyMMdd-HHmm").withZone(ZoneOffset.UTC);

    private final OsgiConfigService service;

    ConfigArchive(OsgiConfigService service) {
        this.service = service;
    }

    // ---------------------------------------------------------------- export

    Map<String, Object> export(List<String> names, char[] password, boolean isRootUser) throws IOException {
        ConfigArchiveCodec.checkPassword(password);
        Set<String> requested = new LinkedHashSet<>(names == null ? List.of() : names);
        if (requested.isEmpty()) {
            throw new IOException("Choose at least one file to export");
        }
        if (requested.size() > MAX_FILES) {
            throw new IOException("An archive holds at most " + MAX_FILES + " files");
        }

        List<Map<String, Object>> files = new ArrayList<>();
        List<Map<String, Object>> warnings = new ArrayList<>();
        Set<String> exported = new HashSet<>();
        long totalBytes = 0;
        for (String name : requested) {
            String safeName = service.validateFilename(name);
            // The same rule as when an archive is opened: an export must never make one an import refuses.
            if (!exported.add(fileKey(safeName))) {
                throw new IOException("The file " + safeName + " is selected more than once");
            }
            if (ConfigFileFilter.isConfigurationFileOf(OsgiConfigService.SELF_CONFIG_PID, safeName)) {
                throw new ConfigAccessDeniedException("Export denied: " + safeName
                        + " is the manager's own configuration, which holds the encryption secret");
            }
            service.ensureArchiveFileAllowed(safeName, isRootUser, "Export");
            Path path = service.resolveConfigPath(safeName);
            if (!Files.exists(path)) {
                throw new ConfigNotFoundException("File not found: " + safeName);
            }
            long size = Files.size(path);
            if (size > OsgiConfigService.MAX_RAW_CONTENT_BYTES) {
                throw new IOException("Export denied: " + safeName + " exceeds the maximum allowed size");
            }
            // Before reading it: 500 files of 5 MiB would otherwise all be in memory before any limit applies.
            totalBytes += size;
            if (totalBytes > ConfigArchiveCodec.MAX_PAYLOAD_BYTES) {
                throw new IOException(TOO_LARGE_TO_EXPORT);
            }
            String content = Files.readString(path, StandardCharsets.UTF_8);

            List<Map<String, String>> secrets = new ArrayList<>();
            int undecryptable = 0;
            String binding = EnvelopeBinding.ofFile(safeName);
            for (String envelope : envelopesIn(content)) {
                try {
                    String value = CryptoEngine.decryptBound(envelope.substring(4, envelope.length() - 1), binding);
                    Map<String, String> secret = new LinkedHashMap<>();
                    secret.put("envelope", envelope);
                    secret.put("value", value);
                    secrets.add(secret);
                } catch (IllegalStateException e) {
                    undecryptable++;
                }
            }
            if (undecryptable > 0) {
                Map<String, Object> warning = new LinkedHashMap<>();
                warning.put("name", safeName);
                warning.put("undecryptable", undecryptable);
                warnings.add(warning);
            }

            Map<String, Object> file = new LinkedHashMap<>();
            file.put("name", safeName);
            file.put("content", content);
            file.put("secrets", secrets);
            file.put("undecryptable", undecryptable);
            file.put("bundles", bundlesOf(safeName, isRootUser));
            files.add(file);
        }

        Instant now = Instant.now();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("format", FORMAT);
        payload.put("exportedAt", now.toString());
        payload.put("jahiaVersion", jahiaVersion());
        payload.put("files", files);

        // The limits an import applies, so that an archive that was exported can always be imported.
        byte[] json = MAPPER.writeValueAsBytes(payload);
        if (json.length > ConfigArchiveCodec.MAX_PAYLOAD_BYTES) {
            throw new IOException(TOO_LARGE_TO_EXPORT);
        }
        byte[] sealed = ConfigArchiveCodec.seal(json, password);
        if (sealed.length > MAX_ARCHIVE_BYTES) {
            throw new IOException(TOO_LARGE_TO_EXPORT);
        }
        LOGGER.info("[AUDIT] Exported {} configuration file(s) into an archive", files.size());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("archive", Base64.getEncoder().encodeToString(sealed));
        result.put("fileName", "osgi-configurations-" + FILE_STAMP.format(now) + ".ocmx");
        result.put("files", files.size());
        result.put("warnings", warnings);
        return result;
    }

    /**
     * Who uses the file's configuration: {@code users} (bound, components, managed services) and
     * {@code metatype} (the bundle describing it). Null when this caller may not know it, as for
     * the bundleUsage query, which refuses a file that resolves to a hidden configuration.
     */
    private Map<String, Object> bundlesOf(String filename, boolean isRootUser) throws IOException {
        List<Map<String, Object>> usage;
        try {
            usage = service.findBundleUsage(filename, isRootUser);
        } catch (ConfigAccessDeniedException e) {
            return null;
        }
        List<Map<String, Object>> users = new ArrayList<>();
        List<Map<String, Object>> metatype = new ArrayList<>();
        for (Map<String, Object> entry : usage) {
            Map<String, Object> bundle = new LinkedHashMap<>();
            bundle.put("symbolicName", entry.get("symbolicName"));
            bundle.put("name", entry.get("name"));
            bundle.put("version", entry.get("version"));
            Collection<?> usages = entry.get("usages") instanceof Collection ? (Collection<?>) entry.get("usages") : List.of();
            boolean describes = false;
            boolean uses = false;
            for (Object usageEntry : usages) {
                Object kind = usageEntry instanceof Map ? ((Map<?, ?>) usageEntry).get("kind") : null;
                if ("METATYPE".equals(kind)) {
                    describes = true;
                } else if (kind != null) {
                    uses = true;
                }
            }
            if (uses) {
                users.add(bundle);
            }
            if (describes) {
                metatype.add(bundle);
            }
        }
        Map<String, Object> bundles = new LinkedHashMap<>();
        bundles.put("users", users);
        bundles.put("metatype", metatype);
        return bundles;
    }

    // ---------------------------------------------------------------- preview

    Map<String, Object> preview(String archive, char[] password, boolean isRootUser) throws IOException {
        Payload payload = open(archive, password);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("exportedAt", payload.exportedAt);
        result.put("jahia", jahiaComparison(payload.jahiaVersion));

        Set<String> existing = new HashSet<>();
        for (Map<String, Object> file : service.listFiles(isRootUser)) {
            existing.add(String.valueOf(file.get("name")));
        }

        List<Map<String, Object>> files = new ArrayList<>();
        for (ArchivedFile file : payload.files) {
            files.add(previewFile(file, existing, isRootUser));
        }
        result.put("files", files);
        return result;
    }

    private Map<String, Object> previewFile(ArchivedFile file, Set<String> existing, boolean isRootUser) throws IOException {
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("name", file.name);
        String refusal = refusalFor(file.name, isRootUser);
        entry.put("allowed", refusal == null);
        if (refusal != null) {
            entry.put("refusal", refusal);
            return entry;
        }

        boolean exists = Files.exists(service.resolveConfigPath(file.name));
        entry.put("action", exists ? "OVERWRITE" : "CREATE");
        String stem = ConfigFileFilter.configurationStem(file.name);
        List<String> sameConfiguration = new ArrayList<>();
        for (String other : existing) {
            if (!other.equals(file.name) && ConfigFileFilter.configurationStem(other).equals(stem)) {
                sameConfiguration.add(other);
            }
        }
        sameConfiguration.sort(Comparator.naturalOrder());
        entry.put("sameConfiguration", sameConfiguration);

        entry.put("secrets", file.secrets.size());
        entry.put("undecryptable", file.undecryptable);

        List<Map<String, Object>> comparisons = new ArrayList<>();
        String reference = UNKNOWN;
        if (file.bundles != null) {
            List<Map<String, Object>> referenceBundles;
            if (!file.bundles.users.isEmpty()) {
                reference = "USERS";
                referenceBundles = file.bundles.users;
            } else if (!file.bundles.metatype.isEmpty()) {
                reference = "METATYPE";
                referenceBundles = file.bundles.metatype;
            } else {
                reference = "NONE";
                referenceBundles = List.of();
            }
            Set<String> usedHere = bundlesUsingHere(file.name, isRootUser);
            BundleContext context = service.getBundleContext();
            Bundle[] installed = context == null ? null : context.getBundles();
            for (Map<String, Object> bundle : referenceBundles) {
                comparisons.add(compareBundle(bundle, installed, usedHere));
            }
        }
        entry.put("reference", reference);
        entry.put("bundles", comparisons);

        ObjectClassDefinition definition = service.metatypeForFile(file.name);
        Map<String, Integer> attributeTypes = attributeTypes(definition);
        Map<String, String> values = valuesOf(file.name, file.content);
        boolean versionsDiffer = comparisons.stream()
                .anyMatch(comparison -> !SAME.equals(comparison.get("comparison")) && !ABSENT.equals(comparison.get("comparison")));
        List<String> unknownKeys = new ArrayList<>();
        if (versionsDiffer && attributeTypes != null) {
            for (String key : values.keySet()) {
                if (!attributeTypes.containsKey(key) && !FRAMEWORK_KEY.matcher(key).matches()) {
                    unknownKeys.add(key);
                }
            }
        }
        entry.put("unknownKeys", unknownKeys);
        entry.put("metatypeChecked", versionsDiffer && attributeTypes != null);

        List<String> clearSecrets = new ArrayList<>();
        for (Map.Entry<String, String> value : values.entrySet()) {
            if (isSecret(value.getKey(), attributeTypes) && !isEnvelope(value.getValue()) && !value.getValue().isEmpty()) {
                clearSecrets.add(value.getKey());
            }
        }
        entry.put("clearSecrets", clearSecrets);
        return entry;
    }

    /** Why this caller may not import this file here, or null: the checks of a save. */
    private String refusalFor(String name, boolean isRootUser) {
        String safeName;
        try {
            safeName = service.validateFilename(name);
        } catch (IOException e) {
            return "INVALID_NAME";
        }
        if (ConfigFileFilter.isConfigurationFileOf(OsgiConfigService.SELF_CONFIG_PID, safeName)) {
            return "MANAGER_CONFIGURATION";
        }
        if (!service.isFilenameAllowed(safeName, isRootUser)) {
            return "NOT_PERMITTED";
        }
        return null;
    }

    /**
     * The symbolic names of the bundles this instance ties to the file's configuration: those the
     * bundleUsage query would name to this caller. Empty when the caller may not know them.
     */
    private Set<String> bundlesUsingHere(String filename, boolean isRootUser) {
        Set<String> names = new HashSet<>();
        try {
            for (Map<String, Object> entry : service.bundleUsageOfName(filename, isRootUser)) {
                names.add(String.valueOf(entry.get("symbolicName")));
            }
        } catch (IOException | RuntimeException e) {
            LOGGER.debug("No bundle usage for the import preview of {}", logValue(filename), e);
        }
        return names;
    }

    /**
     * Compares one bundle the archive names with this instance. Only a bundle this instance itself
     * ties to the configuration is looked up: the archive is the caller's, and comparing any name it
     * lists told the installed version of any bundle. Another name answers ABSENT, which then
     * means "no bundle of that name uses this configuration here", installed or not.
     */
    static Map<String, Object> compareBundle(Map<String, Object> archived, Bundle[] bundles, Set<String> usedHere) {
        String symbolicName = String.valueOf(archived.get("symbolicName"));
        String archivedVersion = String.valueOf(archived.get("version"));
        Map<String, Object> comparison = new LinkedHashMap<>();
        comparison.put("symbolicName", symbolicName);
        comparison.put("name", archived.get("name"));
        comparison.put("archiveVersion", archivedVersion);

        List<Bundle> installed = new ArrayList<>();
        if (bundles != null && usedHere.contains(symbolicName)) {
            for (Bundle bundle : bundles) {
                if (symbolicName.equals(bundle.getSymbolicName())) {
                    installed.add(bundle);
                }
            }
        }
        if (installed.isEmpty()) {
            comparison.put("comparison", ABSENT);
            comparison.put("otherVersions", List.of());
            return comparison;
        }
        // The running one when there is one, else the highest version installed.
        installed.sort(Comparator.comparing((Bundle bundle) -> bundle.getState() == Bundle.ACTIVE)
                .thenComparing(Bundle::getVersion).reversed());
        Bundle target = installed.get(0);
        comparison.put("targetVersion", String.valueOf(target.getVersion()));
        comparison.put("targetActive", target.getState() == Bundle.ACTIVE);
        comparison.put("comparison", compareVersions(archivedVersion, target.getVersion()));
        Set<String> others = new TreeSet<>();
        for (Bundle other : installed.subList(1, installed.size())) {
            others.add(String.valueOf(other.getVersion()));
        }
        comparison.put("otherVersions", new ArrayList<>(others));
        return comparison;
    }

    /** OLDER and NEWER describe the target against the archive. */
    static String compareVersions(String archived, Version target) {
        Version source;
        try {
            source = Version.parseVersion(archived);
        } catch (IllegalArgumentException e) {
            return archived.equals(String.valueOf(target)) ? SAME : DIFFERENT;
        }
        int order = target.compareTo(source);
        return order == 0 ? SAME : order < 0 ? OLDER : NEWER;
    }

    private Map<String, Object> jahiaComparison(String archived) {
        String target = jahiaVersion();
        Map<String, Object> jahia = new LinkedHashMap<>();
        jahia.put("archiveVersion", archived);
        jahia.put("targetVersion", target);
        if (archived == null || target == null) {
            jahia.put("comparison", UNKNOWN);
        } else {
            jahia.put("comparison", compareJahiaVersions(archived, target));
        }
        return jahia;
    }

    /** Jahia versions have four numbers (8.2.3.2); OSGi's Version takes three and a qualifier. */
    static String compareJahiaVersions(String archived, String target) {
        int[] source = numbers(archived);
        int[] here = numbers(target);
        if (source == null || here == null) {
            return archived.equals(target) ? SAME : DIFFERENT;
        }
        for (int i = 0; i < Math.max(source.length, here.length); i++) {
            int a = i < source.length ? source[i] : 0;
            int b = i < here.length ? here[i] : 0;
            if (a != b) {
                return b < a ? OLDER : NEWER;
            }
        }
        return SAME;
    }

    private static int[] numbers(String version) {
        Matcher matcher = Pattern.compile("^(\\d+(?:\\.\\d+)*)").matcher(version.trim());
        if (!matcher.find()) {
            return null;
        }
        String[] parts = matcher.group(1).split("\\.");
        int[] numbers = new int[parts.length];
        for (int i = 0; i < parts.length; i++) {
            try {
                numbers[i] = Integer.parseInt(parts[i]);
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return numbers;
    }

    // ---------------------------------------------------------------- import

    Map<String, Object> importFiles(String archive, char[] password, List<String> names, boolean isRootUser) throws IOException {
        Payload payload = open(archive, password);
        Map<String, ArchivedFile> byName = new LinkedHashMap<>();
        for (ArchivedFile file : payload.files) {
            byName.put(file.name, file);
        }

        List<String> imported = new ArrayList<>();
        List<Map<String, String>> failed = new ArrayList<>();
        for (String name : new LinkedHashSet<>(names == null ? List.<String>of() : names)) {
            ArchivedFile file = byName.get(name);
            try {
                if (file == null) {
                    throw new IOException("Not in the archive");
                }
                String refusal = refusalFor(file.name, isRootUser);
                if (refusal != null) {
                    throw new ConfigAccessDeniedException("Import denied: " + file.name + " (" + refusal + ")");
                }
                String binding = EnvelopeBinding.ofFile(file.name);
                String content = file.content;
                for (Secret secret : file.secrets) {
                    // Fails closed: encryptBound throws rather than leave a secret in clear.
                    content = content.replace(secret.envelope, "ENC(" + CryptoEngine.encryptBound(secret.value, binding) + ")");
                }
                service.saveFile(file.name, Map.of("rawContent", content), isRootUser);
                imported.add(file.name);
                LOGGER.info("[AUDIT] Imported {} from an archive", logValue(file.name));
            } catch (IOException | RuntimeException e) {
                Map<String, String> failure = new LinkedHashMap<>();
                failure.put("name", name);
                failure.put("error", clientMessage(e));
                failed.add(failure);
                LOGGER.warn("[AUDIT] Import of {} from an archive failed: {}", logValue(name), logValue(e.getMessage()));
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("imported", imported);
        result.put("failed", failed);
        return result;
    }

    /**
     * What a failed file says to the client. These messages do not go through
     * OsgiConfigGqlSupport.translate, so a file system error, whose message is an absolute path, is
     * replaced: only the manager's own reasons are passed on.
     */
    static String clientMessage(Exception e) {
        boolean own = e.getClass() == IOException.class || e instanceof ConfigAccessDeniedException
                || e instanceof ConfigNotFoundException || e instanceof ConfigConflictException;
        return own && e.getMessage() != null ? e.getMessage() : "The file could not be written";
    }

    /**
     * A caller's value in a log line: the names an import asks for are not validated yet, and a line
     * break in one wrote a whole forged [AUDIT] line. As OsgiConfigGqlSupport.auditValue does.
     */
    static String logValue(String value) {
        return value == null ? null : LOG_UNSAFE.matcher(value).replaceAll("_");
    }

    /**
     * What makes two names one file: the name as a save takes it (trimmed), whatever its case, since
     * a case-insensitive disk holds only one of them.
     */
    static String fileKey(String name) {
        return name.trim().toLowerCase(Locale.ROOT);
    }

    // ---------------------------------------------------------------- reading an archive

    private static final class Secret {
        final String envelope;
        final String value;

        Secret(String envelope, String value) {
            this.envelope = envelope;
            this.value = value;
        }
    }

    private static final class Bundles {
        final List<Map<String, Object>> users;
        final List<Map<String, Object>> metatype;

        Bundles(List<Map<String, Object>> users, List<Map<String, Object>> metatype) {
            this.users = users;
            this.metatype = metatype;
        }
    }

    private static final class ArchivedFile {
        String name;
        String content;
        List<Secret> secrets = new ArrayList<>();
        int undecryptable;
        Bundles bundles;
    }

    private static final class Payload {
        String exportedAt;
        String jahiaVersion;
        List<ArchivedFile> files = new ArrayList<>();
    }

    /** Opens and checks an archive: its shape is untrusted until here, whoever made it. */
    private static Payload open(String archive, char[] password) throws IOException {
        if (archive == null || archive.isBlank()) {
            throw new IOException("No archive was given");
        }
        // Before anything is done with it, with room for line breaks: the rest works on copies.
        int maxChars = (MAX_ARCHIVE_BYTES / 3 + 1) * 4;
        String tooLarge = "The archive is larger than " + (MAX_ARCHIVE_BYTES / (1024 * 1024)) + " MiB";
        if (archive.length() > maxChars + maxChars / 8) {
            throw new IOException(tooLarge);
        }
        String compact = archive.replaceAll("\\s", "");
        if (compact.length() > maxChars) {
            throw new IOException(tooLarge);
        }
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(compact);
        } catch (IllegalArgumentException e) {
            throw new ConfigArchiveCodec.ArchiveException("This file is not an archive of the OSGi Configurations Manager");
        }
        byte[] json = ConfigArchiveCodec.open(bytes, password);

        Map<?, ?> root;
        try {
            root = MAPPER.readValue(json, Map.class);
        } catch (JsonProcessingException e) {
            throw new ConfigArchiveCodec.ArchiveException("The archive is damaged");
        } catch (IOException e) {
            throw new ConfigArchiveCodec.ArchiveException("The archive is damaged", e);
        }
        if (!Integer.valueOf(FORMAT).equals(root.get("format"))) {
            throw new ConfigArchiveCodec.ArchiveException("This archive was made by a newer version of the OSGi Configurations Manager");
        }
        Payload payload = new Payload();
        payload.exportedAt = root.get("exportedAt") instanceof String ? (String) root.get("exportedAt") : null;
        payload.jahiaVersion = root.get("jahiaVersion") instanceof String ? (String) root.get("jahiaVersion") : null;
        List<?> files = root.get("files") instanceof List ? (List<?>) root.get("files") : List.of();
        if (files.isEmpty() || files.size() > MAX_FILES) {
            throw new ConfigArchiveCodec.ArchiveException("The archive is damaged");
        }
        Set<String> seen = new HashSet<>();
        for (Object item : files) {
            if (!(item instanceof Map)) {
                throw new ConfigArchiveCodec.ArchiveException("The archive is damaged");
            }
            Map<?, ?> map = (Map<?, ?>) item;
            ArchivedFile file = new ArchivedFile();
            if (!(map.get("name") instanceof String) || !(map.get("content") instanceof String)) {
                throw new ConfigArchiveCodec.ArchiveException("The archive is damaged");
            }
            // The name as a save takes it: bound untrimmed, the secrets of "a.cfg " were encrypted
            // for another configuration than the file a.cfg they were written to.
            file.name = ((String) map.get("name")).trim();
            file.content = (String) map.get("content");
            // Two entries for one file: the preview showed both, and the last one written won.
            if (!seen.add(fileKey(file.name))) {
                throw new ConfigArchiveCodec.ArchiveException("The archive holds the same file more than once");
            }
            if (file.content.getBytes(StandardCharsets.UTF_8).length > OsgiConfigService.MAX_RAW_CONTENT_BYTES) {
                throw new ConfigArchiveCodec.ArchiveException("The archive holds a file larger than the maximum allowed size");
            }
            if (map.get("secrets") instanceof List) {
                // Only an envelope that is in the file, and once: a listed value must not plant text
                // elsewhere, and each entry costs a key derivation on import. The file is scanned
                // once, not per entry, and a list of a million entries is a million set lookups.
                Set<String> present = envelopesIn(file.content);
                for (Object secret : (List<?>) map.get("secrets")) {
                    if (secret instanceof Map) {
                        Object envelope = ((Map<?, ?>) secret).get("envelope");
                        Object value = ((Map<?, ?>) secret).get("value");
                        if (envelope instanceof String && value instanceof String && present.remove(envelope)) {
                            file.secrets.add(new Secret((String) envelope, (String) value));
                        }
                    }
                }
            }
            file.undecryptable = map.get("undecryptable") instanceof Integer ? (Integer) map.get("undecryptable") : 0;
            if (map.get("bundles") instanceof Map) {
                Map<?, ?> bundles = (Map<?, ?>) map.get("bundles");
                file.bundles = new Bundles(bundleList(bundles.get("users")), bundleList(bundles.get("metatype")));
            }
            payload.files.add(file);
        }
        return payload;
    }

    private static List<Map<String, Object>> bundleList(Object value) {
        List<Map<String, Object>> bundles = new ArrayList<>();
        if (value instanceof List) {
            for (Object item : (List<?>) value) {
                if (item instanceof Map && ((Map<?, ?>) item).get("symbolicName") instanceof String
                        && ((Map<?, ?>) item).get("version") instanceof String) {
                    Map<String, Object> bundle = new LinkedHashMap<>();
                    bundle.put("symbolicName", ((Map<?, ?>) item).get("symbolicName"));
                    bundle.put("name", ((Map<?, ?>) item).get("name") instanceof String ? ((Map<?, ?>) item).get("name") : null);
                    bundle.put("version", ((Map<?, ?>) item).get("version"));
                    bundles.add(bundle);
                }
            }
        }
        return bundles;
    }

    // ---------------------------------------------------------------- helpers

    /**
     * The encrypted values of a file, comment lines left out as the migration leaves them: a comment
     * is never delivered, and the templates' "keep it encrypted (ENC(...))" hints are not values.
     * Counted, each hint was reported as a value the instance could not decrypt.
     */
    static Set<String> envelopesIn(String content) {
        Set<String> envelopes = new LinkedHashSet<>();
        Matcher matcher = ENVELOPE.matcher(content);
        while (matcher.find()) {
            if (!EnvelopeMigration.inComment(content, matcher.start())) {
                envelopes.add(matcher.group());
            }
        }
        return envelopes;
    }

    private static boolean isEnvelope(String value) {
        return ENVELOPE.matcher(value.trim()).matches();
    }

    /** Password in the Metatype, or a secret-looking name on a text attribute or an undeclared key. */
    static boolean isSecret(String key, Map<String, Integer> attributeTypes) {
        Integer type = attributeTypes == null ? null : attributeTypes.get(key);
        if (type != null && type == AttributeDefinition.PASSWORD) {
            return true;
        }
        if (type != null && type != AttributeDefinition.STRING) {
            return false;
        }
        return SECRET_NAME.matcher(key).find();
    }

    private static Map<String, Integer> attributeTypes(ObjectClassDefinition definition) {
        if (definition == null) {
            return null;
        }
        AttributeDefinition[] attributes = definition.getAttributeDefinitions(ObjectClassDefinition.ALL);
        Map<String, Integer> types = new LinkedHashMap<>();
        if (attributes != null) {
            for (AttributeDefinition attribute : attributes) {
                types.put(attribute.getID(), attribute.getType());
            }
        }
        return types;
    }

    /** The file's top-level keys and their text values, in order: .cfg lines, or a YAML mapping. */
    static Map<String, String> valuesOf(String name, String content) {
        Map<String, String> values = new LinkedHashMap<>();
        String lower = name.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".yml") || lower.endsWith(".yml" + OsgiConfigService.DISABLED_SUFFIX)) {
            Object parsed;
            try {
                parsed = ConfigFileCodec.parseYaml(content);
            } catch (RuntimeException e) {
                return values;
            }
            if (parsed instanceof Map) {
                for (Map.Entry<?, ?> entry : ((Map<?, ?>) parsed).entrySet()) {
                    Object value = entry.getValue();
                    values.put(String.valueOf(entry.getKey()), value instanceof Map || value instanceof List ? "" : String.valueOf(value));
                }
            }
            return values;
        }
        for (String line : content.split("\\R")) {
            Map<String, String> entry = ConfigFileCodec.parseCfgLine(line);
            if ("property".equals(entry.get("type"))) {
                values.put(entry.get("key"), entry.get("value") == null ? "" : entry.get("value"));
            }
        }
        return values;
    }

    /** This instance's Jahia version, such as 8.2.3.2, or null outside Jahia. */
    static String jahiaVersion() {
        try {
            return org.jahia.bin.Jahia.VERSION;
        } catch (LinkageError | RuntimeException e) {
            return null;
        }
    }
}
