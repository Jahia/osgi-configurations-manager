package org.jahia.modules.osgiconfigmanager.admin;

import org.osgi.framework.Bundle;
import org.osgi.framework.BundleContext;
import org.osgi.framework.Constants;
import org.osgi.framework.FrameworkUtil;
import org.osgi.framework.ServiceReference;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Reference;
import org.osgi.service.component.annotations.ReferenceCardinality;
import org.osgi.service.cm.ManagedServiceFactory;
import org.osgi.service.metatype.annotations.Designate;
import org.osgi.service.metatype.AttributeDefinition;
import org.osgi.service.metatype.MetaTypeInformation;
import org.osgi.service.metatype.MetaTypeService;
import org.osgi.service.metatype.ObjectClassDefinition;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.io.IOException;
import java.io.Reader;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.*;
import java.util.function.Consumer;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Service to manage OSGi configuration files in karaf/etc
 */
@Component(service = OsgiConfigService.class, configurationPid = OsgiConfigService.SELF_CONFIG_PID)
@Designate(ocd = OsgiConfigService.Config.class)
public class OsgiConfigService {

    private static final Logger LOGGER = LoggerFactory.getLogger(OsgiConfigService.class);
    private static final Set<String> SUPPORTED_CONFIG_EXTENSIONS = Set.of(".cfg", ".cfg.disabled", ".yml", ".yml.disabled");
    static final String DEFAULT_FACTORY_FILE_EXTENSION = ".cfg";
    private static final String FACTORY_IDENTIFIER_PATTERN = "^[A-Za-z0-9._-]+$";
    private static final String KEY_CREATED = "created";
    private static final String KEY_CONFIG_STATE = "configState";
    private static final String KEY_FILENAME = "filename";
    private static final String KEY_PROPERTIES = "properties";
    private static final String CONFIG_STATE_MODULE = "MODULE";
    private static final String CONFIG_STATE_MODULE_DEFAULT = "MODULE_DEFAULT";
    private static final String CONFIG_STATE_USER = "USER";
    static final String DISABLED_SUFFIX = ".disabled";
    private static final String DEFAULT_CONFIGURATION_COMMENT = "# default configuration, can be edited";
    private static final String DEFAULT_CONFIGURATION_PREFIX = "# default configuration";
    private static final String DO_NOT_EDIT_PREFIX = "# do not edit";
    private static final String METATYPE_PID_NOT_FOUND_LOG = "Metatype PID {} not found in bundle {}";
    private static final String INVALID_FILENAME_MESSAGE = "Invalid configuration filename: ";
    private static final String ACTION_CREATE = "Create";
    private File karafEtcDir;
    // Filtering state lives behind ConfigFileFilter, which publishes it as ONE immutable snapshot.
    // These were five separate mutable fields assigned one by one in updateConfig, none volatile:
    // a request thread could observe the new whitelist with the old blacklist and apply the wrong
    // rule set entirely, which for a security filter means exposing a file meant to be hidden.
    private final ConfigFileFilter fileFilter = new ConfigFileFilter(SELF_CONFIG_PID);
    private MetaTypeService metaTypeService;

    static final String SELF_CONFIG_PID = "org.jahia.modules.osgiconfigmanager";
    private static final String SELF_CONFIG = SELF_CONFIG_PID + ".cfg";
    private static final String SELF_CONFIG_DISABLED = SELF_CONFIG + DISABLED_SUFFIX;

    @org.osgi.service.metatype.annotations.ObjectClassDefinition(
            name = "OSGi Configurations Manager",
            description = "Controls the visibility and editability of OSGi configuration files exposed by this module."
    )
    public @interface Config {
        @org.osgi.service.metatype.annotations.AttributeDefinition(
                name = "Blacklisted files",
                description = "Comma-separated configuration filenames to hide and block. Ignored when a white list is defined.",
                required = false
        )
        String filteredFiles() default "";

        @org.osgi.service.metatype.annotations.AttributeDefinition(
                name = "Whitelisted files",
                description = "Comma-separated configuration filenames to exclusively expose. When defined, only these files remain visible and editable.",
                required = false
        )
        String allowedFiles() default "";

        @org.osgi.service.metatype.annotations.AttributeDefinition(
                name = "Enable visual formatting controls",
                description = "Shows the visual editor controls for comments and empty lines. When disabled, the visual editor hides comments and empty lines by default.",
                required = false
        )
        boolean visualFormattingControlsEnabled() default false;

        @org.osgi.service.metatype.annotations.AttributeDefinition(
                name = "Encryption secret",
                description = "Passphrase used to derive the encryption key for NEW ENC(...) values. "
                        + "Leave empty to auto-generate and persist a per-instance random secret. "
                        + "Never uses a hardcoded default. Legacy values remain decryptable regardless.",
                required = false,
                type = org.osgi.service.metatype.annotations.AttributeType.PASSWORD
        )
        String cryptoSecret() default "";
    }

    private static final class MetatypeCollectionContext {
        private final List<Map<String, Object>> metatypes;
        private final Set<String> seenPids;
        private final String localeCode;
        private final Set<String> factoryCapablePids;

        private MetatypeCollectionContext(List<Map<String, Object>> metatypes, Set<String> seenPids,
                                          String localeCode, Set<String> factoryCapablePids) {
            this.metatypes = metatypes;
            this.seenPids = seenPids;
            this.localeCode = localeCode;
            this.factoryCapablePids = factoryCapablePids;
        }
    }

    public OsgiConfigService() {
        String etcPath = System.getProperty("karaf.etc");
        if (etcPath != null && !etcPath.isEmpty()) {
            karafEtcDir = new File(etcPath);
        } else {
            LOGGER.error("System property 'karaf.etc' not found!");
        }
    }

    @Reference(service = MetaTypeService.class, cardinality = ReferenceCardinality.OPTIONAL)
    public void setMetaTypeService(MetaTypeService metaTypeService) {
        this.metaTypeService = metaTypeService;
    }

    public void unsetMetaTypeService(MetaTypeService metaTypeService) {
        if (this.metaTypeService == metaTypeService) {
            this.metaTypeService = null;
        }
    }

    @org.osgi.service.component.annotations.Activate
    @org.osgi.service.component.annotations.Modified
    public void updateConfig(Map<String, Object> properties) {
        fileFilter.update(properties);

        if (properties != null && properties.get("cryptoSecret") != null) {
            String secret = String.valueOf(properties.get("cryptoSecret"));
            CryptoEngine.configureSecret(secret.isEmpty() ? null : secret.toCharArray());
        }

        LOGGER.info("Updated blacklist: {}", fileFilter.blacklist());
        LOGGER.info("Updated blacklist wildcard count: {}", fileFilter.blacklistWildcardCount());
        LOGGER.info("Updated whitelist: {}", fileFilter.whitelist());
        LOGGER.info("Updated whitelist wildcard count: {}", fileFilter.whitelistWildcardCount());
        LOGGER.info("Updated visual formatting controls flag: {}", fileFilter.isVisualFormattingControlsEnabled());
    }

    public Map<String, Object> getUiConfig() {
        Map<String, Object> uiConfig = new LinkedHashMap<>();
        uiConfig.put("visualFormattingControlsEnabled", fileFilter.isVisualFormattingControlsEnabled());
        return uiConfig;
    }

    /**
     * List all .cfg and .yml files (including disabled ones)
     */
    public List<Map<String, Object>> listFiles() {
        return listFiles(true);
    }

    public List<Map<String, Object>> listFiles(boolean isRootUser) {
        if (karafEtcDir == null) {
            LOGGER.error("karafEtcDir is null. System property 'karaf.etc' was: {}", System.getProperty("karaf.etc"));
            return Collections.emptyList();
        }
        if (!karafEtcDir.exists()) {
            LOGGER.error("karafEtcDir does not exist: {}", karafEtcDir.getAbsolutePath());
            return Collections.emptyList();
        }

        LOGGER.info("Listing configuration files from: {}", karafEtcDir.getAbsolutePath());

        File[] files = karafEtcDir.listFiles((dir, name) -> {
            String lowercaseName = name.toLowerCase();
            boolean isConfig = (lowercaseName.endsWith(".cfg") || lowercaseName.endsWith(".yml") ||
                    lowercaseName.endsWith(".cfg.disabled") || lowercaseName.endsWith(".yml.disabled"));
            return isConfig && isFilenameAllowed(name, isRootUser);
        });

        if (files == null) {
            LOGGER.warn("listFiles returned null (IO error or not a directory?)");
            return Collections.emptyList();
        }

        LOGGER.info("Found {} configuration files.", files.length);

        return Arrays.stream(files)
                .sorted(Comparator.comparing(File::getName))
                .map(f -> {
                    Map<String, Object> map = new LinkedHashMap<>();
                    map.put("name", f.getName());
                    map.put("path", f.getAbsolutePath());
                    map.put("enabled", !f.getName().endsWith(DISABLED_SUFFIX));
                    map.put("type", getFileType(f.getName()));
                    map.put(KEY_CONFIG_STATE, readConfigStateSafely(f.toPath()));
                    return map;
                })
                .collect(Collectors.toList());
    }

    public List<Map<String, Object>> listAvailableMetatypeConfigurations(Locale locale) {
        return listAvailableMetatypeConfigurations(locale, true);
    }

    public List<Map<String, Object>> listAvailableMetatypeConfigurations(Locale locale, boolean isRootUser) {
        MetaTypeService currentMetaTypeService = this.metaTypeService;
        if (currentMetaTypeService == null) {
            return Collections.emptyList();
        }

        BundleContext bundleContext = getBundleContext();
        if (bundleContext == null) {
            return Collections.emptyList();
        }

        String localeCode = locale != null ? locale.toString() : null;
        Bundle[] bundles = bundleContext.getBundles();
        if (bundles == null) {
            return Collections.emptyList();
        }

        List<Map<String, Object>> metatypes = new ArrayList<>();
        Set<String> seenPids = new HashSet<>();
        MetatypeCollectionContext context = new MetatypeCollectionContext(
                metatypes,
                seenPids,
                localeCode,
                getManagedServiceFactoryPids(bundleContext)
        );

        forEachInspectableBundle(currentMetaTypeService, bundles, bundle -> {
            try {
                MetaTypeInformation metaTypeInformation = currentMetaTypeService.getMetaTypeInformation(bundle);
                if (metaTypeInformation != null) {
                    appendMetatypeDefinitions(context, bundle, metaTypeInformation, metaTypeInformation.getPids(), false, isRootUser);
                    appendMetatypeDefinitions(context, bundle, metaTypeInformation, metaTypeInformation.getFactoryPids(), true, isRootUser);
                }
            } catch (Exception e) {
                LOGGER.debug("Unable to inspect metatype information for bundle {}", bundle.getSymbolicName(), e);
            }
        });

        metatypes.sort(Comparator
                .comparing((Map<String, Object> definition) -> Boolean.TRUE.equals(definition.get("factory")))
                .thenComparing((Map<String, Object> definition) -> String.valueOf(definition.getOrDefault(KEY_CREATED, false)))
                .thenComparing(definition -> String.valueOf(definition.getOrDefault("name", definition.get("pid"))), String.CASE_INSENSITIVE_ORDER)
                .thenComparing(definition -> String.valueOf(definition.get("pid")), String.CASE_INSENSITIVE_ORDER));

        return metatypes;
    }

    private void appendMetatypeDefinitions(MetatypeCollectionContext context, Bundle bundle,
                                           MetaTypeInformation metaTypeInformation, String[] pids, boolean factory,
                                           boolean isRootUser) {
        if (pids == null) {
            return;
        }

        for (String pid : pids) {
            appendMetatypeDefinition(context, bundle, metaTypeInformation, pid, factory, isRootUser);
        }
    }

    private void appendMetatypeDefinition(MetatypeCollectionContext context, Bundle bundle,
                                          MetaTypeInformation metaTypeInformation, String pid, boolean factory,
                                          boolean isRootUser) {
        boolean effectiveFactory = factory || context.factoryCapablePids.contains(pid);
        if (!shouldProcessMetatypePid(context, pid, effectiveFactory)) {
            return;
        }

        String suggestedFilename = effectiveFactory ? buildFactoryFilenamePattern(pid) : pid + DEFAULT_FACTORY_FILE_EXTENSION;
        if (isBlockedSimpleMetatype(pid, suggestedFilename, effectiveFactory, isRootUser)) {
            return;
        }

        try {
            ObjectClassDefinition objectClassDefinition = metaTypeInformation.getObjectClassDefinition(pid, context.localeCode);
            if (objectClassDefinition == null) {
                return;
            }

            Map<String, Object> definition = toMetaTypeMap(pid, objectClassDefinition);
            definition.put(KEY_FILENAME, suggestedFilename);
            definition.put("bundleName", getBundleDisplayName(bundle));
            definition.put("bundleSymbolicName", bundle.getSymbolicName());
            definition.put("factory", effectiveFactory);
            if (effectiveFactory) {
                List<Map<String, Object>> instances = getFactoryInstances(pid, isRootUser);
                definition.put("instances", instances);
                definition.put("instanceCount", instances.size());
                definition.put(KEY_CREATED, !instances.isEmpty());
            } else {
                definition.put(KEY_CREATED, hasExistingConfigurationFile(pid));
            }
            context.metatypes.add(definition);
        } catch (IllegalArgumentException e) {
            LOGGER.debug(METATYPE_PID_NOT_FOUND_LOG, pid, bundle.getSymbolicName());
        } catch (Exception e) {
            LOGGER.debug("Unable to list metatype PID {} from bundle {}", pid, bundle.getSymbolicName(), e);
        }
    }

    private boolean shouldProcessMetatypePid(MetatypeCollectionContext context, String pid, boolean effectiveFactory) {
        if (pid == null || pid.isEmpty()) {
            return false;
        }

        String key = (effectiveFactory ? "factory:" : "pid:") + pid;
        return context.seenPids.add(key);
    }

    private boolean isBlockedSimpleMetatype(String pid, String suggestedFilename, boolean effectiveFactory, boolean isRootUser) {
        if (isSelfConfigurationPid(pid)) {
            return !isRootUser;
        }
        if (!fileFilter.hasActiveWhitelist()) {
            return !effectiveFactory && fileFilter.isBlacklisted(suggestedFilename);
        }
        if (effectiveFactory) {
            return !hasWhitelistedFactoryCandidate(pid);
        }
        return !isFilenameAllowed(suggestedFilename, isRootUser);
    }

    private Set<String> getManagedServiceFactoryPids(BundleContext bundleContext) {
        if (bundleContext == null) {
            return Collections.emptySet();
        }

        Set<String> pids = new HashSet<>();
        try {
            Collection<ServiceReference<ManagedServiceFactory>> references = bundleContext.getServiceReferences(ManagedServiceFactory.class, null);
            if (references == null) {
                return Collections.emptySet();
            }

            for (ServiceReference<ManagedServiceFactory> reference : references) {
                Object servicePid = reference.getProperty(Constants.SERVICE_PID);
                if (servicePid instanceof String) {
                    pids.add((String) servicePid);
                } else if (servicePid instanceof String[]) {
                    pids.addAll(Arrays.asList((String[]) servicePid));
                } else if (servicePid instanceof Collection<?>) {
                    ((Collection<?>) servicePid).stream()
                            .filter(String.class::isInstance)
                            .map(String.class::cast)
                            .forEach(pids::add);
                }
            }
        } catch (Exception e) {
            LOGGER.debug("Unable to inspect ManagedServiceFactory registrations", e);
        }

        return pids;
    }

    private String getFileType(String filename) {
        if (filename.contains(".cfg"))
            return "cfg";
        if (filename.contains(".yml"))
            return "yml";
        return "unknown";
    }

    public Map<String, Object> readFile(String filename) throws IOException {
        return readFile(filename, null, true);
    }

    public Map<String, Object> readFile(String filename, Locale locale) throws IOException {
        return readFile(filename, locale, true);
    }

    public Map<String, Object> readFile(String filename, Locale locale, boolean isRootUser) throws IOException {
        String safeFilename = validateFilename(filename);
        ensureFilenameAllowed(safeFilename, isRootUser, "Access");

        Path filePath = resolveConfigPath(safeFilename);
        if (!Files.exists(filePath)) {
            throw new IOException("File not found: " + safeFilename);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        String type = getFileType(safeFilename);
        result.put(KEY_CONFIG_STATE, detectConfigState(filePath));

        // Always read raw content for Monaco Support
        String rawContent = Files.readString(filePath, StandardCharsets.UTF_8);
        result.put("rawContent", rawContent);

        enrichWithMetatype(result, safeFilename, type, locale);

        if ("cfg".equals(type)) {
            result.put(KEY_PROPERTIES, ConfigFileCodec.readCfgProperties(filePath));
        } else if ("yml".equals(type)) {
            result.put(KEY_PROPERTIES, readYamlProperties(filePath));
        }
        return result;
    }

    private String getConfigurationPid(String filename) {
        return normalizeConfigFilename(filename);
    }

    private void enrichWithMetatype(Map<String, Object> result, String filename, String type, Locale locale) {
        if (!"cfg".equals(type) && !"yml".equals(type)) {
            return;
        }

        String pid = resolveMetatypePid(filename, locale);
        result.put("pid", pid);

        Map<String, Object> metaTypeDefinition = getMetaTypeDefinition(pid, locale);
        if (metaTypeDefinition != null) {
            result.put("metatype", metaTypeDefinition);
        }
    }


    // package-private seam for unit testing (SUPPORT-646); the logic lives in ConfigFileCodec
    Map<String, String> parseCfgLine(String line) {
        return ConfigFileCodec.parseCfgLine(line);
    }


    // package-private seam for unit testing (SUPPORT-646); the logic lives in ConfigFileCodec
    Object readYamlProperties(Path filePath) throws IOException {
        return ConfigFileCodec.readYamlProperties(filePath);
    }

    private String resolveMetatypePid(String filename, Locale locale) {
        String normalizedPid = getConfigurationPid(filename);
        if (normalizedPid == null || normalizedPid.isEmpty()) {
            return normalizedPid;
        }

        if (getMetaTypeDefinition(normalizedPid, locale) != null) {
            return normalizedPid;
        }

        String factoryPid = findFactoryPidForInstance(normalizedPid);
        return factoryPid != null ? factoryPid : normalizedPid;
    }

    private String findFactoryPidForInstance(String normalizedConfigurationName) {
        MetaTypeService currentMetaTypeService = this.metaTypeService;
        if (currentMetaTypeService == null || normalizedConfigurationName == null || normalizedConfigurationName.isEmpty()) {
            return null;
        }

        BundleContext bundleContext = getBundleContext();
        if (bundleContext == null) {
            return null;
        }

        Set<String> factoryCapablePids = getManagedServiceFactoryPids(bundleContext);
        Bundle[] bundles = bundleContext.getBundles();
        if (bundles == null) {
            return null;
        }

        String bestMatch = null;
        Set<String> seenFactoryPids = new HashSet<>();

        for (Bundle bundle : bundles) {
            if (isInspectableBundle(bundle)) {
                bestMatch = findFactoryPidForInstance(bundle, currentMetaTypeService, normalizedConfigurationName,
                        factoryCapablePids, seenFactoryPids, bestMatch);
            }
        }

        return bestMatch;
    }

    private String findFactoryPidForInstance(Bundle bundle, MetaTypeService currentMetaTypeService,
                                             String normalizedConfigurationName, Set<String> factoryCapablePids,
                                             Set<String> seenFactoryPids, String currentBestMatch) {
        try {
            MetaTypeInformation metaTypeInformation = currentMetaTypeService.getMetaTypeInformation(bundle);
            if (metaTypeInformation == null) {
                return currentBestMatch;
            }

            String bestMatch = findBestFactoryPidMatch(
                    normalizedConfigurationName,
                    metaTypeInformation.getPids(),
                    false,
                    factoryCapablePids,
                    seenFactoryPids,
                    currentBestMatch
            );
            return findBestFactoryPidMatch(
                    normalizedConfigurationName,
                    metaTypeInformation.getFactoryPids(),
                    true,
                    factoryCapablePids,
                    seenFactoryPids,
                    bestMatch
            );
        } catch (Exception e) {
            LOGGER.debug("Unable to inspect metatype information for bundle {}", bundle.getSymbolicName(), e);
            return currentBestMatch;
        }
    }

    // package-private seam for unit testing (SUPPORT-646)
    String findBestFactoryPidMatch(String normalizedConfigurationName, String[] pids,
                                           boolean declaredFactory, Set<String> factoryCapablePids, Set<String> seenFactoryPids,
                                           String currentBestMatch) {
        if (pids == null) {
            return currentBestMatch;
        }

        String bestMatch = currentBestMatch;
        for (String pid : pids) {
            if (isFactoryPidMatch(normalizedConfigurationName, pid, declaredFactory, factoryCapablePids, seenFactoryPids)
                    && (bestMatch == null || pid.length() > bestMatch.length())) {
                bestMatch = pid;
            }
        }

        return bestMatch;
    }

    private boolean isFactoryPidMatch(String normalizedConfigurationName, String pid, boolean declaredFactory,
                                      Set<String> factoryCapablePids, Set<String> seenFactoryPids) {
        if (pid == null || pid.isEmpty() || !seenFactoryPids.add(pid)) {
            return false;
        }

        boolean effectiveFactory = declaredFactory || factoryCapablePids.contains(pid);
        String prefix = pid + "-";
        return effectiveFactory
                && normalizedConfigurationName.startsWith(prefix)
                && normalizedConfigurationName.length() > prefix.length();
    }

    private boolean hasExistingConfigurationFile(String pid) {
        if (karafEtcDir == null || pid == null || pid.isEmpty()) {
            return false;
        }

        for (String candidate : getConfigurationFileCandidates(pid)) {
            if (configPathExists(candidate)) {
                return true;
            }
        }

        return false;
    }

    private String[] getConfigurationFileCandidates(String baseName) {
        return SUPPORTED_CONFIG_EXTENSIONS.stream()
                .map(baseName::concat)
                .toArray(String[]::new);
    }

    private List<Map<String, Object>> getFactoryInstances(String factoryPid, boolean isRootUser) {
        if (karafEtcDir == null || factoryPid == null || factoryPid.isEmpty()) {
            return Collections.emptyList();
        }

        String prefix = factoryPid + "-";
        File[] files = karafEtcDir.listFiles((dir, name) -> name.startsWith(prefix) && isSupportedConfigFilename(name) && isFilenameAllowed(name, isRootUser));
        if (files == null || files.length == 0) {
            return Collections.emptyList();
        }

        return Arrays.stream(files)
                .map(file -> toFactoryInstanceMap(factoryPid, file))
                .filter(Objects::nonNull)
                .sorted(Comparator
                        .comparing((Map<String, Object> instance) -> String.valueOf(instance.getOrDefault("identifier", "")), String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(instance -> String.valueOf(instance.getOrDefault(KEY_FILENAME, "")), String.CASE_INSENSITIVE_ORDER))
                .collect(Collectors.toList());
    }

    private Map<String, Object> toFactoryInstanceMap(String factoryPid, File file) {
        String identifier = extractFactoryIdentifier(factoryPid, file.getName());
        if (identifier == null || identifier.isEmpty()) {
            return null;
        }

        Map<String, Object> instance = new LinkedHashMap<>();
        instance.put("identifier", identifier);
        instance.put(KEY_FILENAME, file.getName());
        instance.put("enabled", !file.getName().endsWith(DISABLED_SUFFIX));
        instance.put("type", getFileType(file.getName()));
        return instance;
    }

    private String extractFactoryIdentifier(String factoryPid, String filename) {
        if (factoryPid == null || filename == null) {
            return null;
        }

        String normalizedName = normalizeConfigFilename(filename);
        String prefix = factoryPid + "-";
        if (!normalizedName.startsWith(prefix) || normalizedName.length() <= prefix.length()) {
            return null;
        }

        return normalizedName.substring(prefix.length());
    }

    private boolean hasExistingFactoryInstanceFile(String factoryPid, String identifier) {
        if (karafEtcDir == null || factoryPid == null || factoryPid.isEmpty() || identifier == null || identifier.isEmpty()) {
            return false;
        }

        String baseName = factoryPid + "-" + identifier;
        for (String candidate : getConfigurationFileCandidates(baseName)) {
            if (configPathExists(candidate)) {
                return true;
            }
        }

        return false;
    }

    private String getBundleDisplayName(Bundle bundle) {
        String bundleName = bundle.getHeaders().get(Constants.BUNDLE_NAME);
        if (bundleName != null && !bundleName.trim().isEmpty()) {
            return bundleName;
        }

        return bundle.getSymbolicName();
    }

    private Map<String, Object> getMetaTypeDefinition(String pid, Locale locale) {
        ObjectClassDefinition objectClassDefinition = findObjectClassDefinition(pid, locale);
        return objectClassDefinition != null ? toMetaTypeMap(pid, objectClassDefinition) : null;
    }

    private BundleContext getBundleContext() {
        Bundle bundle = FrameworkUtil.getBundle(OsgiConfigService.class);
        return bundle != null ? bundle.getBundleContext() : null;
    }

    private void forEachInspectableBundle(MetaTypeService currentMetaTypeService, Bundle[] bundles, Consumer<Bundle> consumer) {
        if (currentMetaTypeService == null || bundles == null) {
            return;
        }

        for (Bundle bundle : bundles) {
            if (isInspectableBundle(bundle)) {
                consumer.accept(bundle);
            }
        }
    }

    private boolean isInspectableBundle(Bundle bundle) {
        return bundle != null && bundle.getState() >= Bundle.STARTING;
    }

    private Map<String, Object> toMetaTypeMap(String pid, ObjectClassDefinition objectClassDefinition) {
        Map<String, Object> metatype = new LinkedHashMap<>();
        metatype.put("pid", pid);
        metatype.put("name", objectClassDefinition.getName());
        metatype.put("description", objectClassDefinition.getDescription());

        List<Map<String, Object>> properties = new ArrayList<>();
        Set<String> seenAttributeIds = new LinkedHashSet<>();
        appendDistinctAttributeDefinitions(objectClassDefinition.getAttributeDefinitions(ObjectClassDefinition.REQUIRED), seenAttributeIds,
                definition -> properties.add(toAttributeDefinitionMap(definition, false)));
        appendDistinctAttributeDefinitions(objectClassDefinition.getAttributeDefinitions(ObjectClassDefinition.OPTIONAL), seenAttributeIds,
                definition -> properties.add(toAttributeDefinitionMap(definition, true)));
        metatype.put(KEY_PROPERTIES, properties);
        return metatype;
    }

    private Map<String, Object> toAttributeDefinitionMap(AttributeDefinition definition, boolean optional) {
        Map<String, Object> property = new LinkedHashMap<>();
        property.put("id", definition.getID());
        property.put("name", definition.getName());
        property.put("description", definition.getDescription());
        property.put("type", getAttributeTypeName(definition.getType()));
        property.put("cardinality", definition.getCardinality());
        property.put("optional", optional);

        String[] defaultValues = definition.getDefaultValue();
        if (defaultValues != null) {
            property.put("defaultValues", Arrays.asList(defaultValues));
        } else {
            property.put("defaultValues", Collections.emptyList());
        }

        String[] optionValues = definition.getOptionValues();
        String[] optionLabels = definition.getOptionLabels();
        List<Map<String, String>> options = new ArrayList<>();
        if (optionValues != null) {
            for (int i = 0; i < optionValues.length; i++) {
                Map<String, String> option = new LinkedHashMap<>();
                option.put("value", optionValues[i]);
                option.put("label", optionLabels != null && optionLabels.length > i ? optionLabels[i] : optionValues[i]);
                options.add(option);
            }
        }
        property.put("options", options);
        return property;
    }

    private void appendDistinctAttributeDefinitions(AttributeDefinition[] definitions, Set<String> seenAttributeIds,
                                                     Consumer<AttributeDefinition> definitionConsumer) {
        if (definitions == null) {
            return;
        }

        for (AttributeDefinition definition : definitions) {
            if (definition != null) {
                String id = definition.getID();
                if (id != null && !id.isBlank() && seenAttributeIds.add(id)) {
                    definitionConsumer.accept(definition);
                }
            }
        }
    }

    private String getAttributeTypeName(int type) {
        switch (type) {
            case AttributeDefinition.BOOLEAN:
                return "boolean";
            case AttributeDefinition.BYTE:
                return "byte";
            case AttributeDefinition.CHARACTER:
                return "character";
            case AttributeDefinition.DOUBLE:
                return "double";
            case AttributeDefinition.FLOAT:
                return "float";
            case AttributeDefinition.INTEGER:
                return "integer";
            case AttributeDefinition.LONG:
                return "long";
            case AttributeDefinition.SHORT:
                return "short";
            case AttributeDefinition.STRING:
                return "string";
            case AttributeDefinition.PASSWORD:
                return "password";
            default:
                return "string";
        }
    }

    @SuppressWarnings("unchecked")
    public void saveFile(String filename, Map<String, Object> content) throws IOException {
        saveFile(filename, content, true);
    }

    public void saveFile(String filename, Map<String, Object> content, boolean isRootUser) throws IOException {
        String safeFilename = validateFilename(filename);
        ensureFilenameAllowed(safeFilename, isRootUser, "Save");

        Path filePath = resolveConfigPath(safeFilename);

        // Auto-Backup Logic: a transient recovery copy in case the write below fails.
        // It is PURGED on success (SUPPORT-646) — a lingering .bak holds the prior (possibly
        // secret) content, is invisible in the UI and un-filterable by the allow/blacklist.
        Path backupPath = null;
        if (Files.exists(filePath)) {
            try {
                Path candidate = filePath.resolveSibling(filePath.getFileName().toString() + ".bak");
                Files.copy(filePath, candidate, StandardCopyOption.REPLACE_EXISTING);
                backupPath = candidate;
                LOGGER.debug("Created transient backup for {}: {}", safeFilename, candidate.getFileName());
            } catch (IOException e) {
                LOGGER.error("Failed to create backup for " + safeFilename, e);
            }
        }

        try {
            // Universal Raw Content Handling
            // If the frontend sends "rawContent", we trust it completely and write it to
            // disk. This allows the frontend to handle encryption, formatting, and comments.
            if (content.containsKey("rawContent")) {
                ConfigFileCodec.writeRawContent(filePath, (String) content.get("rawContent"));
            } else {
                String type = getFileType(safeFilename);
                if ("cfg".equals(type)) {
                    ConfigFileCodec.saveCfgContent(filePath, content.get(KEY_PROPERTIES));
                } else if ("yml".equals(type)) {
                    // YML fallback if no rawContent sent (unlikely given frontend logic, but good
                    // for completeness)
                    ConfigFileCodec.saveYaml(filePath, content.get(KEY_PROPERTIES));
                }
            }
        } catch (IOException e) {
            // Write failed: retain the backup so the operator can recover the prior content.
            LOGGER.error("[AUDIT] Save failed for {}; retained recovery backup {}", safeFilename,
                    backupPath == null ? "<none>" : backupPath.getFileName(), e);
            throw e;
        }

        // Success: purge the secret-bearing backup so it never lingers in karaf/etc.
        purgeBackup(backupPath);
    }

    private void purgeBackup(Path backupPath) {
        if (backupPath == null) {
            return;
        }
        try {
            Files.deleteIfExists(backupPath);
        } catch (IOException e) {
            LOGGER.warn("Could not purge transient backup {}", backupPath.getFileName(), e);
        }
    }

    public void toggleFileStatus(String filename) throws IOException {
        toggleFileStatus(filename, true);
    }

    public void toggleFileStatus(String filename, boolean isRootUser) throws IOException {
        String safeFilename = validateFilename(filename);
        ensureFilenameAllowed(safeFilename, isRootUser, "Toggle");

        Path filePath = resolveConfigPath(safeFilename);
        if (!Files.exists(filePath)) {
            throw new IOException("File not found: " + safeFilename);
        }

        String newName;
        if (safeFilename.endsWith(DISABLED_SUFFIX)) {
            newName = safeFilename.substring(0, safeFilename.length() - DISABLED_SUFFIX.length());
        } else {
            newName = safeFilename + DISABLED_SUFFIX;
        }

        Path newFilePath = resolveConfigPath(newName);
        if (Files.exists(newFilePath)) {
            throw new IOException("Target file already exists: " + newName);
        }

        Files.move(filePath, newFilePath);
    }

    public void deleteFile(String filename) throws IOException {
        deleteFile(filename, true);
    }

    public void deleteFile(String filename, boolean isRootUser) throws IOException {
        String safeFilename = validateFilename(filename);
        ensureFilenameAllowed(safeFilename, isRootUser, "Delete");

        Path filePath = resolveConfigPath(safeFilename);
        if (Files.exists(filePath)) {
            Files.delete(filePath);
        }
    }

    public void createFile(String filename) throws IOException {
        createFile(filename, true);
    }

    public void createFile(String filename, boolean isRootUser) throws IOException {
        String safeFilename = validateFilename(filename);
        ensureFilenameAllowed(safeFilename, isRootUser, ACTION_CREATE);

        Path filePath = resolveConfigPath(safeFilename);
        if (Files.exists(filePath)) {
            throw new IOException("File already exists: " + safeFilename);
        }
        Files.createFile(filePath);
    }

    public void markAsDefaultConfiguration(String filename) throws IOException {
        markAsDefaultConfiguration(filename, true);
    }

    public void markAsDefaultConfiguration(String filename, boolean isRootUser) throws IOException {
        String safeFilename = validateFilename(filename);
        ensureFilenameAllowed(safeFilename, isRootUser, "Update");

        Path filePath = resolveConfigPath(safeFilename);
        if (!Files.exists(filePath)) {
            throw new IOException("File not found: " + safeFilename);
        }

        String configState = detectConfigState(filePath);
        if (CONFIG_STATE_MODULE.equals(configState)) {
            throw new IOException("Module-managed configurations cannot be converted to default configuration from this tool.");
        }
        if (CONFIG_STATE_MODULE_DEFAULT.equals(configState)) {
            return;
        }

        String content = Files.readString(filePath, StandardCharsets.UTF_8);
        String updatedContent = content.isEmpty()
                ? DEFAULT_CONFIGURATION_COMMENT + '\n'
                : DEFAULT_CONFIGURATION_COMMENT + '\n' + content;
        Files.writeString(filePath, updatedContent, StandardCharsets.UTF_8);
    }

    public String createFileFromMetatype(String pid, Locale locale) throws IOException {
        return createFileFromMetatype(pid, locale, true);
    }

    public String createFileFromMetatype(String pid, Locale locale, boolean isRootUser) throws IOException {
        if (pid == null || pid.trim().isEmpty()) {
            throw new IOException("PID is required");
        }

        String trimmedPid = pid.trim();
        ensurePidAllowed(trimmedPid, isRootUser);
        ObjectClassDefinition objectClassDefinition = findObjectClassDefinition(trimmedPid, locale);
        if (objectClassDefinition == null) {
            throw new IOException("No Metatype definition found for PID: " + trimmedPid);
        }

        return createMetatypeFile(trimmedPid + DEFAULT_FACTORY_FILE_EXTENSION,
                buildCfgTemplate(trimmedPid, objectClassDefinition),
                false,
                isRootUser);
    }

    public String createFactoryFileFromMetatype(String factoryPid, String identifier, Locale locale) throws IOException {
        return createFactoryFileFromMetatype(factoryPid, identifier, locale, true);
    }

    public String createFactoryFileFromMetatype(String factoryPid, String identifier, Locale locale, boolean isRootUser) throws IOException {
        if (factoryPid == null || factoryPid.trim().isEmpty()) {
            throw new IOException("Factory PID is required");
        }
        if (identifier == null || identifier.trim().isEmpty()) {
            throw new IOException("Factory identifier is required");
        }

        String trimmedFactoryPid = factoryPid.trim();
        String trimmedIdentifier = identifier.trim();
        validateFactoryIdentifier(trimmedIdentifier);
        ensurePidAllowed(trimmedFactoryPid, isRootUser);

        String filename = trimmedFactoryPid + "-" + trimmedIdentifier + DEFAULT_FACTORY_FILE_EXTENSION;
        ObjectClassDefinition objectClassDefinition = findFactoryObjectClassDefinition(trimmedFactoryPid, locale);
        if (objectClassDefinition == null) {
            throw new IOException("No Metatype factory definition found for PID: " + trimmedFactoryPid);
        }

        ensureFactoryFileCanBeCreated(trimmedFactoryPid, trimmedIdentifier, filename, isRootUser);
        return createMetatypeFile(filename,
                buildCfgTemplate(trimmedFactoryPid, objectClassDefinition, trimmedIdentifier),
                true,
                isRootUser);
    }

    private ObjectClassDefinition findObjectClassDefinition(String pid, Locale locale) {
        return findObjectClassDefinition(pid, locale, false);
    }

    private ObjectClassDefinition findFactoryObjectClassDefinition(String factoryPid, Locale locale) {
        return findObjectClassDefinition(factoryPid, locale, true);
    }

    private ObjectClassDefinition findObjectClassDefinition(String pid, Locale locale, boolean requireFactorySupport) {
        if (!isMetatypeLookupPossible(pid)) {
            return null;
        }

        BundleContext bundleContext = getBundleContext();
        if (bundleContext == null) {
            return null;
        }

        String localeCode = locale != null ? locale.toString() : null;
        Bundle[] bundles = bundleContext.getBundles();
        if (bundles == null) {
            return null;
        }

        MetaTypeLookupContext lookupContext = createLookupContext(localeCode, bundleContext, requireFactorySupport);
        for (Bundle bundle : bundles) {
            ObjectClassDefinition objectClassDefinition = findObjectClassDefinitionInBundle(bundle, pid, lookupContext);
            if (objectClassDefinition != null) {
                return objectClassDefinition;
            }
        }

        return null;
    }

    private boolean isMetatypeLookupPossible(String pid) {
        return this.metaTypeService != null && pid != null && !pid.isEmpty();
    }

    private MetaTypeLookupContext createLookupContext(String localeCode, BundleContext bundleContext, boolean requireFactorySupport) {
        Set<String> factoryCapablePids = requireFactorySupport
                ? getManagedServiceFactoryPids(bundleContext)
                : Collections.emptySet();
        return new MetaTypeLookupContext(this.metaTypeService, localeCode, requireFactorySupport, factoryCapablePids);
    }

    private ObjectClassDefinition findObjectClassDefinitionInBundle(Bundle bundle, String pid, MetaTypeLookupContext lookupContext) {
        if (!isInspectableBundle(bundle)) {
            return null;
        }

        try {
            MetaTypeInformation metaTypeInformation = lookupContext.metaTypeService.getMetaTypeInformation(bundle);
            if (metaTypeInformation == null || !isEligibleMetatypePid(metaTypeInformation, pid,
                    lookupContext.requireFactorySupport, lookupContext.factoryCapablePids)) {
                return null;
            }

            return metaTypeInformation.getObjectClassDefinition(pid, lookupContext.localeCode);
        } catch (IllegalArgumentException e) {
            LOGGER.debug(METATYPE_PID_NOT_FOUND_LOG, pid, bundle.getSymbolicName());
        } catch (Exception e) {
            LOGGER.debug("Unable to read metatype{} for PID {} from bundle {}",
                    lookupContext.requireFactorySupport ? " factory" : "", pid, bundle.getSymbolicName(), e);
        }

        return null;
    }

    private static final class MetaTypeLookupContext {
        private final MetaTypeService metaTypeService;
        private final String localeCode;
        private final boolean requireFactorySupport;
        private final Set<String> factoryCapablePids;

        private MetaTypeLookupContext(MetaTypeService metaTypeService, String localeCode,
                                      boolean requireFactorySupport, Set<String> factoryCapablePids) {
            this.metaTypeService = metaTypeService;
            this.localeCode = localeCode;
            this.requireFactorySupport = requireFactorySupport;
            this.factoryCapablePids = factoryCapablePids;
        }
    }

    private boolean isEligibleMetatypePid(MetaTypeInformation metaTypeInformation, String pid,
                                          boolean requireFactorySupport, Set<String> factoryCapablePids) {
        if (!requireFactorySupport) {
            return true;
        }

        String[] factoryPids = metaTypeInformation.getFactoryPids();
        boolean declaredAsFactory = factoryPids != null && Arrays.stream(factoryPids).anyMatch(pid::equals);
        boolean exposedAsManagedServiceFactory = factoryCapablePids.contains(pid);
        return declaredAsFactory || exposedAsManagedServiceFactory;
    }

    private void ensureFactoryFileCanBeCreated(String factoryPid, String identifier, String filename, boolean isRootUser) throws IOException {
        ensurePidAllowed(factoryPid, isRootUser);
        ensureFilenameAllowed(filename, isRootUser, ACTION_CREATE);
        if (hasExistingFactoryInstanceFile(factoryPid, identifier)) {
            throw new IOException("File already exists: " + filename);
        }
    }

    private String createMetatypeFile(String filename, String content, boolean allowDisabledVariant, boolean isRootUser) throws IOException {
        ensureFilenameAllowed(filename, isRootUser, ACTION_CREATE);
        if (allowDisabledVariant) {
            ensureFilenameAllowed(filename + DISABLED_SUFFIX, isRootUser, ACTION_CREATE);
        }

        Path filePath = resolveConfigPath(filename);
        if (Files.exists(filePath)) {
            throw new IOException("File already exists: " + filename);
        }

        Files.write(filePath, content.getBytes(StandardCharsets.UTF_8));
        return filename;
    }

    // package-private seam for unit testing (SUPPORT-646)
    Path resolveConfigPath(String filename) throws IOException {
        if (karafEtcDir == null) {
            throw new IOException("karaf.etc directory is not configured");
        }

        String validatedFilename = validateFilename(filename);
        Path etcPath = karafEtcDir.toPath().toAbsolutePath().normalize();
        Path resolvedPath = etcPath.resolve(validatedFilename).normalize();
        if (!resolvedPath.startsWith(etcPath)) {
            throw new IOException(INVALID_FILENAME_MESSAGE + filename);
        }

        return resolvedPath;
    }

    // package-private seam for unit testing (SUPPORT-646)
    String validateFilename(String filename) throws IOException {
        if (filename == null || filename.isBlank()) {
            throw new IOException(INVALID_FILENAME_MESSAGE + filename);
        }

        String trimmedFilename = filename.trim();
        if (trimmedFilename.contains("/") || trimmedFilename.contains("\\") || trimmedFilename.contains("..")) {
            throw new IOException(INVALID_FILENAME_MESSAGE + filename);
        }

        try {
            Path candidatePath = Path.of(trimmedFilename).normalize();
            if (candidatePath.isAbsolute() || candidatePath.getNameCount() != 1) {
                throw new IOException(INVALID_FILENAME_MESSAGE + filename);
            }
        } catch (InvalidPathException e) {
            throw new IOException(INVALID_FILENAME_MESSAGE + filename, e);
        }

        if (!isSupportedConfigFilename(trimmedFilename)) {
            throw new IOException(INVALID_FILENAME_MESSAGE + filename);
        }

        return trimmedFilename;
    }

    private boolean configPathExists(String filename) {
        try {
            return Files.exists(resolveConfigPath(filename));
        } catch (IOException e) {
            LOGGER.debug("Ignoring invalid configuration filename candidate {}", filename, e);
            return false;
        }
    }

    private String readConfigStateSafely(Path filePath) {
        try {
            return detectConfigState(filePath);
        } catch (IOException e) {
            LOGGER.debug("Unable to determine configuration state for {}", filePath, e);
            return CONFIG_STATE_USER;
        }
    }

    // package-private seam for unit testing (SUPPORT-646)
    String detectConfigState(Path filePath) throws IOException {
        try (Reader reader = Files.newBufferedReader(filePath, StandardCharsets.UTF_8);
             java.io.BufferedReader bufferedReader = new java.io.BufferedReader(reader)) {
            String line;
            while ((line = bufferedReader.readLine()) != null) {
                String normalizedLine = line.trim().toLowerCase(Locale.ROOT);
                if (normalizedLine.startsWith(DO_NOT_EDIT_PREFIX)) {
                    return CONFIG_STATE_MODULE;
                }
                if (normalizedLine.startsWith(DEFAULT_CONFIGURATION_PREFIX)) {
                    return CONFIG_STATE_MODULE_DEFAULT;
                }
            }
        }

        return CONFIG_STATE_USER;
    }

    private String buildCfgTemplate(String pid, ObjectClassDefinition objectClassDefinition) {
        return buildCfgTemplate(pid, objectClassDefinition, null);
    }

    private String buildCfgTemplate(String pid, ObjectClassDefinition objectClassDefinition, String instanceIdentifier) {
        StringBuilder builder = new StringBuilder();
        Set<String> seenAttributeIds = new LinkedHashSet<>();

        appendCommentLine(builder, objectClassDefinition.getName());
        appendCommentLine(builder, "PID: " + pid);
        if (instanceIdentifier != null && !instanceIdentifier.isBlank()) {
            appendCommentLine(builder, "Instance: " + instanceIdentifier.trim());
        }
        appendCommentLine(builder, objectClassDefinition.getDescription());

        builder.append('\n');

        appendDistinctAttributeDefinitions(objectClassDefinition.getAttributeDefinitions(ObjectClassDefinition.REQUIRED), seenAttributeIds,
                definition -> appendTemplateDefinition(builder, definition));
        builder.append('\n');
        appendDistinctAttributeDefinitions(objectClassDefinition.getAttributeDefinitions(ObjectClassDefinition.OPTIONAL), seenAttributeIds,
                definition -> appendTemplateDefinition(builder, definition));
        builder.append('\n');

        return builder.toString();
    }

    private void appendTemplateDefinition(StringBuilder builder, AttributeDefinition definition) {
        String defaultValue = "";
        String[] defaultValues = definition.getDefaultValue();
        if (defaultValues != null && defaultValues.length > 0) {
            defaultValue = Arrays.stream(defaultValues)
                    .filter(Objects::nonNull)
                    .collect(Collectors.joining(", "));
        }

        builder.append("# ")
                .append(definition.getID())
                .append(" = ")
                .append(defaultValue)
                .append('\n');
    }

    private void appendCommentLine(StringBuilder builder, String text) {
        if (text == null || text.trim().isEmpty()) {
            return;
        }

        String normalizedText = text.replace("\r", "");
        for (String line : normalizedText.split("\n")) {
            if (line.trim().isEmpty()) {
                continue;
            }
            builder.append("# ").append(line.trim()).append('\n');
        }
    }

    private String buildFactoryFilenamePattern(String factoryPid) {
        return factoryPid + "-<id>" + DEFAULT_FACTORY_FILE_EXTENSION;
    }

    // package-private seam for unit testing (SUPPORT-646)
    void validateFactoryIdentifier(String identifier) throws IOException {
        if (identifier.startsWith(".")) {
            throw new IOException("Factory identifier cannot start with '.'");
        }
        if (identifier.contains("/") || identifier.contains("\\") || identifier.contains(":")) {
            throw new IOException("Factory identifier contains invalid path characters");
        }
        if (!identifier.matches(FACTORY_IDENTIFIER_PATTERN)) {
            throw new IOException("Factory identifier must contain only letters, numbers, '.', '_' or '-'");
        }
    }

    static boolean isSupportedConfigFilename(String filename) {
        String lowercaseName = filename.toLowerCase(Locale.ROOT);
        return SUPPORTED_CONFIG_EXTENSIONS.stream().anyMatch(lowercaseName::endsWith);
    }







    // package-private seam for unit testing (SUPPORT-646)
    void ensurePidAllowed(String pid, boolean isRootUser) throws IOException {
        if (isSelfConfigurationPid(pid) && !isRootUser) {
            throw new IOException("Access denied: " + pid + " is reserved for the root user.");
        }
    }

    private void ensureFilenameAllowed(String filename, boolean isRootUser, String action) throws IOException {
        if (!isFilenameAllowed(filename, isRootUser)) {
            String reason = fileFilter.hasActiveWhitelist()
                    ? "is not permitted by the active white list."
                    : "is blacklisted or reserved.";
            throw new IOException(action + " denied: " + filename + " " + reason);
        }
    }

    boolean isFilenameAllowed(String filename, boolean isRootUser) {
        return fileFilter.isFilenameAllowed(filename, isRootUser);
    }

    boolean hasWhitelistedFactoryCandidate(String factoryPid) {
        return fileFilter.hasWhitelistedFactoryCandidate(factoryPid);
    }

    // package-private seam for unit testing (SUPPORT-646)
    boolean isSelfConfigurationPid(String pid) {
        return SELF_CONFIG_PID.equals(pid);
    }


    @SuppressWarnings("unchecked")

    // SUPPORT-646: an upper bound on client-supplied raw content — a config file has no legitimate
    // reason to exceed this, and the cap prevents an unbounded write into karaf/etc.
    private static final int MAX_RAW_CONTENT_BYTES = 5 * 1024 * 1024;


    private void writeEmptyFile(Path filePath) throws IOException {
        try (Writer writer = Files.newBufferedWriter(filePath, StandardCharsets.UTF_8);
             java.io.BufferedWriter bufferedWriter = new java.io.BufferedWriter(writer)) {
            bufferedWriter.write("");
        }
    }



    private String normalizeConfigFilename(String filename) {
        String normalizedName = filename;
        if (normalizedName.endsWith(DISABLED_SUFFIX)) {
            normalizedName = normalizedName.substring(0, normalizedName.length() - DISABLED_SUFFIX.length());
        }
        if (normalizedName.endsWith(".cfg")) {
            return normalizedName.substring(0, normalizedName.length() - ".cfg".length());
        }
        if (normalizedName.endsWith(".yml")) {
            return normalizedName.substring(0, normalizedName.length() - ".yml".length());
        }
        return normalizedName;
    }

    public String encrypt(String value) {
        if (value == null)
            return null;
        return "ENC(" + CryptoEngine.encryptString(value) + ")";
    }

    /**
     * Decrypt a value that is known to belong to a given configuration file.
     *
     * <p>{@link #decrypt(String)} will decrypt anything handed to it, which makes the action that
     * exposes it a decryption oracle: a caller holding an {@code ENC(...)} string obtained anywhere
     * else — a backup, a git history, a log, a screenshot — could have it decrypted regardless of
     * whether they are allowed to see the file it came from. The blacklist/whitelist only gates
     * reading files, not decrypting values.
     *
     * <p>This binds the two together. It runs the same authorization path as
     * {@link #readFile(String, java.util.Locale, boolean)} and then requires the ciphertext to
     * actually appear in that file, so a caller can only decrypt what they could already read.
     */
    public String decryptForFile(String filename, String value, boolean isRootUser) throws IOException {
        if (value == null) {
            return null;
        }

        String safeFilename = validateFilename(filename);
        ensureFilenameAllowed(safeFilename, isRootUser, "Access");

        Path filePath = resolveConfigPath(safeFilename);
        if (!Files.exists(filePath)) {
            throw new IOException("File not found: " + safeFilename);
        }

        String rawContent = Files.readString(filePath, StandardCharsets.UTF_8);
        if (!rawContent.contains(value)) {
            throw new IOException("Encrypted value does not belong to " + safeFilename);
        }

        return decrypt(value);
    }

    public String decrypt(String value) {
        if (value == null)
            return null;
        if (value.startsWith("ENC(") && value.endsWith(")")) {
            String cipherText = value.substring(4, value.length() - 1);
            try {
                return CryptoEngine.decryptString(cipherText);
            } catch (IllegalStateException e) {
                // Decryption is a READ operation, so degrade gracefully: hand back the value
                // untouched instead of failing the request. The SUPPORT-646 hardening made
                // CryptoEngine.decryptString() throw on an undecryptable payload, which is right
                // for the engine but turned this call site into an opaque 500 — a v2 value
                // encrypted with another instance's secret (a config copied between
                // environments) is undecryptable here by design, not a server fault.
                // Encryption stays fail-closed: a secret must never be persisted in clear.
                LOGGER.warn("Could not decrypt configuration value, returning it unchanged", e);
                return value;
            }
        }
        return value;
    }
}
