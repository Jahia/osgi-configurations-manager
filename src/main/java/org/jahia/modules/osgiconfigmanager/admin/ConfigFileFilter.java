package org.jahia.modules.osgiconfigmanager.admin;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Owns the allow/deny filtering of configuration filenames: the blacklist/whitelist (exact +
 * wildcard) configured on the module's own OSGi config, plus the rule that the manager's own
 * configuration file is only visible to the root user.
 *
 * <p>The active rules are published atomically as a single immutable {@link FilterConfig} snapshot
 * behind a {@code volatile} reference, so request threads never observe a half-applied update.
 */
final class ConfigFileFilter {

    private final String selfConfigPid;

    // Deeply immutable snapshot → a volatile reference is sufficient for safe publication (S3077 N/A).
    @SuppressWarnings("java:S3077")
    private volatile FilterConfig filterConfig = FilterConfig.EMPTY;

    ConfigFileFilter(String selfConfigPid) {
        this.selfConfigPid = selfConfigPid;
    }

    /** Immutable snapshot of the filtering configuration. */
    private static final class FilterConfig {
        private static final FilterConfig EMPTY = new FilterConfig(
                Collections.emptySet(), Collections.emptySet(),
                Collections.emptyList(), Collections.emptyList(), false);

        private final Set<String> blacklist;
        private final Set<String> whitelist;
        private final List<Pattern> blacklistPatterns;
        private final List<Pattern> whitelistPatterns;
        private final boolean visualFormattingControlsEnabled;

        private FilterConfig(Set<String> blacklist, Set<String> whitelist,
                             List<Pattern> blacklistPatterns, List<Pattern> whitelistPatterns,
                             boolean visualFormattingControlsEnabled) {
            this.blacklist = blacklist;
            this.whitelist = whitelist;
            this.blacklistPatterns = blacklistPatterns;
            this.whitelistPatterns = whitelistPatterns;
            this.visualFormattingControlsEnabled = visualFormattingControlsEnabled;
        }
    }

    /** Rebuilds and atomically publishes a new snapshot from the module's OSGi properties. */
    void update(Map<String, Object> properties) {
        Set<String> newBlacklist = new HashSet<>();
        Set<String> newWhitelist = new HashSet<>();
        List<Pattern> newBlacklistPatterns = new ArrayList<>();
        List<Pattern> newWhitelistPatterns = new ArrayList<>();

        if (properties != null && properties.containsKey("filteredFiles")) {
            addConfiguredFilenames(newBlacklist, newBlacklistPatterns, (String) properties.get("filteredFiles"));
        }
        if (properties != null && properties.containsKey("allowedFiles")) {
            addConfiguredFilenames(newWhitelist, newWhitelistPatterns, (String) properties.get("allowedFiles"));
        }
        boolean newVisualFormattingControlsEnabled =
                getBooleanProperty(properties, "visualFormattingControlsEnabled", false);

        this.filterConfig = new FilterConfig(newBlacklist, newWhitelist,
                newBlacklistPatterns, newWhitelistPatterns, newVisualFormattingControlsEnabled);
    }

    int blacklistWildcardCount() {
        return filterConfig.blacklistPatterns.size();
    }

    int whitelistWildcardCount() {
        return filterConfig.whitelistPatterns.size();
    }

    Set<String> blacklist() {
        return filterConfig.blacklist;
    }

    Set<String> whitelist() {
        return filterConfig.whitelist;
    }

    boolean isVisualFormattingControlsEnabled() {
        return filterConfig.visualFormattingControlsEnabled;
    }

    boolean hasActiveWhitelist() {
        FilterConfig fc = this.filterConfig;
        return hasConfiguredEntries(fc.whitelist, fc.whitelistPatterns);
    }

    boolean isFilenameAllowed(String filename, boolean isRootUser) {
        if (isSelfConfigurationFilename(filename)) {
            return isRootUser;
        }
        FilterConfig fc = this.filterConfig;
        if (hasConfiguredEntries(fc.whitelist, fc.whitelistPatterns)) {
            return matchesConfiguredFilename(filename, fc.whitelist, fc.whitelistPatterns);
        }
        return !matchesConfiguredFilename(filename, fc.blacklist, fc.blacklistPatterns);
    }

    /** @return whether {@code filename} (or its {@code .disabled} variant) is blacklisted. */
    boolean isBlacklisted(String filename) {
        FilterConfig fc = this.filterConfig;
        return matchesConfiguredFilename(filename, fc.blacklist, fc.blacklistPatterns)
                || matchesConfiguredFilename(filename + OsgiConfigService.DISABLED_SUFFIX, fc.blacklist, fc.blacklistPatterns);
    }

    boolean hasWhitelistedFactoryCandidate(String factoryPid) {
        FilterConfig fc = this.filterConfig;
        if (!hasConfiguredEntries(fc.whitelist, fc.whitelistPatterns)) {
            return true;
        }
        // Uses the shared constant, not a literal, so the probe follows the real extension.
        String sampleCandidate = factoryPid + "-placeholder" + OsgiConfigService.DEFAULT_FACTORY_FILE_EXTENSION;
        String disabledSampleCandidate = sampleCandidate + OsgiConfigService.DISABLED_SUFFIX;
        return fc.whitelist.stream().anyMatch(entry -> entry.startsWith(factoryPid + "-"))
                || matchesConfiguredFilename(sampleCandidate, fc.whitelist, fc.whitelistPatterns)
                || matchesConfiguredFilename(disabledSampleCandidate, fc.whitelist, fc.whitelistPatterns);
    }

    private boolean isSelfConfigurationFilename(String filename) {
        return isConfigurationFileOf(selfConfigPid, filename);
    }

    /**
     * Whether {@code filename} configures {@code pid}, whatever its spelling: every extension the
     * manager admits ({@code .cfg}, {@code .yml}, each optionally {@code .disabled}), any case (a
     * case-insensitive filesystem resolves {@code .CFG} to the same file), and the factory forms
     * {@code <pid>-<name>} and {@code <pid>~<name>}. Declarative Services creates one component
     * configuration per factory configuration of a component's PID, so a factory file for the
     * manager's PID activates a second instance of its configuration component.
     *
     * <p>SEC-525: the guard used to compare the name with two {@code .cfg} literals, so
     * {@code org.jahia.modules.osgiconfigmanager.yml}, which Karaf applies to the same PID, let a
     * delegated administrator rewrite the file filter and the encryption secret. The extensions are
     * taken from the list the manager admits, so a new one cannot reopen the hole.
     */
    static boolean isConfigurationFileOf(String pid, String filename) {
        if (pid == null || filename == null) {
            return false;
        }
        String stem = filename.toLowerCase(Locale.ROOT);
        String longest = "";
        for (String extension : OsgiConfigService.SUPPORTED_CONFIG_EXTENSIONS) {
            if (stem.endsWith(extension) && extension.length() > longest.length()) {
                longest = extension;
            }
        }
        stem = stem.substring(0, stem.length() - longest.length());
        String target = pid.toLowerCase(Locale.ROOT);
        return stem.equals(target) || stem.startsWith(target + "-") || stem.startsWith(target + "~");
    }

    private void addConfiguredFilenames(Set<String> target, List<Pattern> patterns, String csv) {
        if (csv == null || csv.trim().isEmpty()) {
            return;
        }
        for (String entry : csv.split(",")) {
            addConfigNameAndVariant(target, patterns, entry.trim());
        }
    }

    private void addConfigNameAndVariant(Set<String> target, List<Pattern> patterns, String filename) {
        if (filename == null || filename.isEmpty()) {
            return;
        }

        if (filename.contains("*")) {
            patterns.add(buildWildcardPattern(filename));
            if (filename.endsWith(OsgiConfigService.DISABLED_SUFFIX)) {
                patterns.add(buildWildcardPattern(filename.substring(0, filename.length() - OsgiConfigService.DISABLED_SUFFIX.length())));
            } else {
                patterns.add(buildWildcardPattern(filename + OsgiConfigService.DISABLED_SUFFIX));
            }
            return;
        }

        target.add(filename);
        if (filename.endsWith(OsgiConfigService.DISABLED_SUFFIX)) {
            target.add(filename.substring(0, filename.length() - OsgiConfigService.DISABLED_SUFFIX.length()));
        } else if (OsgiConfigService.isSupportedConfigFilename(filename)) {
            target.add(filename + OsgiConfigService.DISABLED_SUFFIX);
        }
    }

    private Pattern buildWildcardPattern(String wildcard) {
        StringBuilder regex = new StringBuilder("^");
        for (char c : wildcard.toCharArray()) {
            if (c == '*') {
                regex.append(".*");
            } else {
                regex.append(Pattern.quote(String.valueOf(c)));
            }
        }
        regex.append('$');
        // SUPPORT-646, same reasoning as the exact-name path in matchesConfiguredFilename: a
        // blacklist entry must not be bypassable by changing the case of the request. Exact names
        // were made case-insensitive, but wildcards were left case-sensitive, so "org.apache.*"
        // still let "ORG.APACHE.felix.cfg" through on a case-insensitive filesystem (macOS,
        // Windows), where that name resolves to the very file the pattern was meant to hide.
        return Pattern.compile(regex.toString(), Pattern.CASE_INSENSITIVE);
    }

    private boolean matchesConfiguredFilename(String filename, Set<String> exactMatches, List<Pattern> wildcardPatterns) {
        // SUPPORT-646: matching is case-insensitive, for both exact names and wildcards, so a
        // blacklist entry such as "Foo.cfg" or "org.apache.*" cannot be bypassed on a
        // case-preserving filesystem by varying the case of the request. #17's version of this
        // class used a plain contains() and would have reopened that bypass;
        // OsgiConfigServiceAllowlistTest S12 covers the exact-name half.
        if (exactMatches.stream().anyMatch(entry -> entry.equalsIgnoreCase(filename))) {
            return true;
        }
        return wildcardPatterns.stream().anyMatch(pattern -> pattern.matcher(filename).matches());
    }

    private boolean hasConfiguredEntries(Set<String> exactMatches, List<Pattern> wildcardPatterns) {
        return !exactMatches.isEmpty() || !wildcardPatterns.isEmpty();
    }

    private boolean getBooleanProperty(Map<String, Object> properties, String key, boolean defaultValue) {
        if (properties == null || !properties.containsKey(key)) {
            return defaultValue;
        }
        Object value = properties.get(key);
        if (value instanceof Boolean) {
            return (Boolean) value;
        }
        if (value instanceof String) {
            return Boolean.parseBoolean((String) value);
        }
        return defaultValue;
    }
}
