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
import org.osgi.service.metatype.AttributeDefinition;
import org.osgi.service.metatype.MetaTypeInformation;
import org.osgi.service.metatype.MetaTypeService;
import org.osgi.service.metatype.ObjectClassDefinition;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.yaml.snakeyaml.DumperOptions;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
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
import java.util.stream.Collectors;

/**
 * Service to manage OSGi configuration files in karaf/etc
 */
@Component(service = OsgiConfigService.class, configurationPid = "org.jahia.modules.osgiconfigmanager")
public class OsgiConfigService {

    private static final Logger LOGGER = LoggerFactory.getLogger(OsgiConfigService.class);
    private static final Set<String> SUPPORTED_CONFIG_EXTENSIONS = Set.of(".cfg", ".cfg.disabled", ".yml", ".yml.disabled");
    private static final String DEFAULT_FACTORY_FILE_EXTENSION = ".cfg";
    private static final String FACTORY_IDENTIFIER_PATTERN = "^[A-Za-z0-9._-]+$";
    private static final String KEY_CREATED = "created";
    private static final String KEY_FILENAME = "filename";
    private static final String KEY_PROPERTIES = "properties";
    private static final String METATYPE_PID_NOT_FOUND_LOG = "Metatype PID {} not found in bundle {}";
    private static final String INVALID_FILENAME_MESSAGE = "Invalid configuration filename: ";
    private File karafEtcDir;
    private Set<String> blacklist = new HashSet<>();
    private MetaTypeService metaTypeService;

    private static final String SELF_CONFIG = "org.jahia.modules.osgiconfigmanager.cfg";

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
        // Initial self-protection
        blacklist.add(SELF_CONFIG);
        blacklist.add(SELF_CONFIG + ".disabled");
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
        Set<String> newBlacklist = new HashSet<>();
        newBlacklist.add(SELF_CONFIG);
        newBlacklist.add(SELF_CONFIG + ".disabled");

        if (properties != null && properties.containsKey("filteredFiles")) {
            String filteredFiles = (String) properties.get("filteredFiles");
            if (filteredFiles != null && !filteredFiles.trim().isEmpty()) {
                for (String f : filteredFiles.split(",")) {
                    String trimmed = f.trim();
                    if (!trimmed.isEmpty()) {
                        newBlacklist.add(trimmed);
                        newBlacklist.add(trimmed + ".disabled");
                    }
                }
            }
        }
        this.blacklist = newBlacklist;
        LOGGER.info("Updated blacklist: {}", blacklist);
    }

    /**
     * List all .cfg and .yml files (including disabled ones)
     */
    public List<Map<String, Object>> listFiles() {
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
            return isConfig && !blacklist.contains(name);
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
                    map.put("enabled", !f.getName().endsWith(".disabled"));
                    map.put("type", getFileType(f.getName()));
                    return map;
                })
                .collect(Collectors.toList());
    }

    public List<Map<String, Object>> listAvailableMetatypeConfigurations(Locale locale) {
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
                    appendMetatypeDefinitions(context, bundle, metaTypeInformation, metaTypeInformation.getPids(), false);
                    appendMetatypeDefinitions(context, bundle, metaTypeInformation, metaTypeInformation.getFactoryPids(), true);
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
                                           MetaTypeInformation metaTypeInformation, String[] pids, boolean factory) {
        if (pids == null) {
            return;
        }

        for (String pid : pids) {
            appendMetatypeDefinition(context, bundle, metaTypeInformation, pid, factory);
        }
    }

    private void appendMetatypeDefinition(MetatypeCollectionContext context, Bundle bundle,
                                          MetaTypeInformation metaTypeInformation, String pid, boolean factory) {
        boolean effectiveFactory = factory || context.factoryCapablePids.contains(pid);
        if (!shouldProcessMetatypePid(context, pid, effectiveFactory)) {
            return;
        }

        String suggestedFilename = effectiveFactory ? buildFactoryFilenamePattern(pid) : pid + DEFAULT_FACTORY_FILE_EXTENSION;
        if (isBlockedSimpleMetatype(suggestedFilename, effectiveFactory)) {
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
                List<Map<String, Object>> instances = getFactoryInstances(pid);
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

    private boolean isBlockedSimpleMetatype(String suggestedFilename, boolean effectiveFactory) {
        return !effectiveFactory && (blacklist.contains(suggestedFilename) || blacklist.contains(suggestedFilename + ".disabled"));
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
        return readFile(filename, null);
    }

    public Map<String, Object> readFile(String filename, Locale locale) throws IOException {
        String safeFilename = validateFilename(filename);
        if (blacklist.contains(safeFilename)) {
            throw new IOException("Access denied: " + safeFilename + " is blacklisted.");
        }

        Path filePath = resolveConfigPath(safeFilename);
        if (!Files.exists(filePath)) {
            throw new IOException("File not found: " + safeFilename);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        String type = getFileType(safeFilename);

        // Always read raw content for Monaco Support
        String rawContent = Files.readString(filePath, StandardCharsets.UTF_8);
        result.put("rawContent", rawContent);

        enrichWithMetatype(result, safeFilename, type, locale);

        if ("cfg".equals(type)) {
            result.put(KEY_PROPERTIES, readCfgProperties(filePath));
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

    private List<Map<String, String>> readCfgProperties(Path filePath) throws IOException {
        List<Map<String, String>> entries = new ArrayList<>();
        try (Reader reader = Files.newBufferedReader(filePath, StandardCharsets.UTF_8);
             java.io.BufferedReader bufferedReader = new java.io.BufferedReader(reader)) {
            String line;
            while ((line = bufferedReader.readLine()) != null) {
                entries.add(parseCfgLine(line));
            }
        }
        return entries;
    }

    private Map<String, String> parseCfgLine(String line) {
        Map<String, String> entry = new HashMap<>();
        String trimmed = line.trim();
        if (trimmed.isEmpty()) {
            entry.put("type", "empty");
            return entry;
        }

        if (trimmed.startsWith("#")) {
            entry.put("type", "comment");
            entry.put("value", line);
            return entry;
        }

        int separatorIndex = findCfgSeparatorIndex(line);
        if (separatorIndex != -1) {
            entry.put("type", "property");
            entry.put("key", line.substring(0, separatorIndex).trim());
            entry.put("value", line.substring(separatorIndex + 1).trim());
            return entry;
        }

        entry.put("type", "comment");
        entry.put("value", line);
        return entry;
    }

    private int findCfgSeparatorIndex(String line) {
        int eqIndex = line.indexOf('=');
        int colIndex = line.indexOf(':');
        if (eqIndex != -1 && colIndex != -1) {
            return Math.min(eqIndex, colIndex);
        }
        if (eqIndex != -1) {
            return eqIndex;
        }
        return colIndex;
    }

    private Object readYamlProperties(Path filePath) throws IOException {
        LoaderOptions loaderOptions = new LoaderOptions();
        Yaml yaml = new Yaml(new SafeConstructor(loaderOptions) {
            @Override
            protected Map<Object, Object> createDefaultMap(int initSize) {
                return new LinkedHashMap<>(initSize);
            }
        });

        try (FileInputStream in = new FileInputStream(filePath.toFile())) {
            return yaml.load(in);
        }
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

    private String findBestFactoryPidMatch(String normalizedConfigurationName, String[] pids,
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

    private List<Map<String, Object>> getFactoryInstances(String factoryPid) {
        if (karafEtcDir == null || factoryPid == null || factoryPid.isEmpty()) {
            return Collections.emptyList();
        }

        String prefix = factoryPid + "-";
        File[] files = karafEtcDir.listFiles((dir, name) -> name.startsWith(prefix) && isSupportedConfigFilename(name) && !blacklist.contains(name));
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
        instance.put("enabled", !file.getName().endsWith(".disabled"));
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
        appendAttributeDefinitions(properties, objectClassDefinition.getAttributeDefinitions(ObjectClassDefinition.REQUIRED), false);
        appendAttributeDefinitions(properties, objectClassDefinition.getAttributeDefinitions(ObjectClassDefinition.OPTIONAL), true);
        metatype.put(KEY_PROPERTIES, properties);
        return metatype;
    }

    private void appendAttributeDefinitions(List<Map<String, Object>> properties, AttributeDefinition[] definitions, boolean optional) {
        if (definitions == null) {
            return;
        }

        for (AttributeDefinition definition : definitions) {
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
            properties.add(property);
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
        String safeFilename = validateFilename(filename);
        if (blacklist.contains(safeFilename)) {
            throw new IOException("Save denied: " + safeFilename + " is blacklisted.");
        }

        Path filePath = resolveConfigPath(safeFilename);

        // Auto-Backup Logic
        if (Files.exists(filePath)) {
            try {
                Path backupPath = filePath.resolveSibling(filePath.getFileName().toString() + ".bak");
                Files.copy(filePath, backupPath, StandardCopyOption.REPLACE_EXISTING);
                LOGGER.info("Created backup for {}: {}", safeFilename, backupPath.getFileName());
            } catch (IOException e) {
                LOGGER.error("Failed to create backup for " + safeFilename, e);
            }
        }

        // Universal Raw Content Handling
        // If the frontend sends "rawContent", we trust it completely and write it to
        // disk.
        // This allows the frontend to handle encryption, formatting, and comments.
        if (content.containsKey("rawContent")) {
            String raw = (String) content.get("rawContent");
            // Ensure we don't write null if specifically sent as null? Frontend should send
            // string.
            if (raw == null)
                raw = "";
            Files.write(filePath, raw.getBytes(StandardCharsets.UTF_8));
            return;
        }

        String type = getFileType(safeFilename);

        if ("cfg".equals(type)) {
            Object propertiesObj = content.get(KEY_PROPERTIES);

            if (propertiesObj == null) {
                // If no rawContent and no properties, we can't save anything meaningful.
                // To avoid NPE, we might warn or write empty.
                LOGGER.warn("No properties or rawContent provided for .cfg save. Writing empty file.");
                try (Writer writer = Files.newBufferedWriter(filePath, StandardCharsets.UTF_8);
                     java.io.BufferedWriter bufferedWriter = new java.io.BufferedWriter(writer)) {
                    bufferedWriter.write("");
                }
                return;
            }

            // Handle legacy map format if for some reason we get it (backward compat)
            if (propertiesObj instanceof Map) {
                Properties props = new Properties();
                props.putAll((Map<String, String>) propertiesObj);
                try (FileOutputStream out = new FileOutputStream(filePath.toFile())) {
                    props.store(out, "Modified by OSGi Configurations Manager");
                }
                return;
            }

            // New List format
            List<Map<String, Object>> entries = (List<Map<String, Object>>) propertiesObj;
            try (Writer writer = Files.newBufferedWriter(filePath, StandardCharsets.UTF_8);
                 java.io.BufferedWriter bufferedWriter = new java.io.BufferedWriter(writer)) {
                for (Map<String, Object> entry : entries) {
                    String entryType = (String) entry.get("type");
                    if ("comment".equals(entryType)) {
                        bufferedWriter.write((String) entry.get("value"));
                        bufferedWriter.newLine();
                    } else if ("empty".equals(entryType)) {
                        bufferedWriter.newLine();
                    } else if ("property".equals(entryType)) {
                        bufferedWriter.write(entry.get("key") + " = " + entry.get("value"));
                        bufferedWriter.newLine();
                    }
                }
            }
        } else if ("yml".equals(type)) {
            // YML fallback if no rawContent sent (unlikely given frontend logic, but good
            // for completeness)
            DumperOptions options = new DumperOptions();
            options.setDefaultFlowStyle(DumperOptions.FlowStyle.BLOCK);
            Yaml yaml = new Yaml(options);
            try (Writer writer = Files.newBufferedWriter(filePath, StandardCharsets.UTF_8)) {
                yaml.dump(content.get(KEY_PROPERTIES), writer);
            }
        }
    }

    public void toggleFileStatus(String filename) throws IOException {
        String safeFilename = validateFilename(filename);
        if (blacklist.contains(safeFilename)) {
            throw new IOException("Toggle denied: " + safeFilename + " is blacklisted.");
        }

        Path filePath = resolveConfigPath(safeFilename);
        if (!Files.exists(filePath)) {
            throw new IOException("File not found: " + safeFilename);
        }

        String newName;
        if (safeFilename.endsWith(".disabled")) {
            newName = safeFilename.substring(0, safeFilename.length() - ".disabled".length());
        } else {
            newName = safeFilename + ".disabled";
        }

        Path newFilePath = resolveConfigPath(newName);
        if (Files.exists(newFilePath)) {
            throw new IOException("Target file already exists: " + newName);
        }

        Files.move(filePath, newFilePath);
    }

    public void deleteFile(String filename) throws IOException {
        String safeFilename = validateFilename(filename);
        if (blacklist.contains(safeFilename)) {
            throw new IOException("Delete denied: " + safeFilename + " is blacklisted.");
        }

        Path filePath = resolveConfigPath(safeFilename);
        if (Files.exists(filePath)) {
            Files.delete(filePath);
        }
    }

    public void createFile(String filename) throws IOException {
        String safeFilename = validateFilename(filename);
        if (blacklist.contains(safeFilename)) {
            throw new IOException("Create denied: " + safeFilename + " is blacklisted.");
        }

        Path filePath = resolveConfigPath(safeFilename);
        if (Files.exists(filePath)) {
            throw new IOException("File already exists: " + safeFilename);
        }
        Files.createFile(filePath);
    }

    public String createFileFromMetatype(String pid, Locale locale) throws IOException {
        if (pid == null || pid.trim().isEmpty()) {
            throw new IOException("PID is required");
        }

        String trimmedPid = pid.trim();
        ObjectClassDefinition objectClassDefinition = findObjectClassDefinition(trimmedPid, locale);
        if (objectClassDefinition == null) {
            throw new IOException("No Metatype definition found for PID: " + trimmedPid);
        }

        return createMetatypeFile(trimmedPid + DEFAULT_FACTORY_FILE_EXTENSION,
                buildCfgTemplate(trimmedPid, objectClassDefinition),
                false);
    }

    public String createFactoryFileFromMetatype(String factoryPid, String identifier, Locale locale) throws IOException {
        if (factoryPid == null || factoryPid.trim().isEmpty()) {
            throw new IOException("Factory PID is required");
        }
        if (identifier == null || identifier.trim().isEmpty()) {
            throw new IOException("Factory identifier is required");
        }

        String trimmedFactoryPid = factoryPid.trim();
        String trimmedIdentifier = identifier.trim();
        validateFactoryIdentifier(trimmedIdentifier);

        String filename = trimmedFactoryPid + "-" + trimmedIdentifier + DEFAULT_FACTORY_FILE_EXTENSION;
        ObjectClassDefinition objectClassDefinition = findFactoryObjectClassDefinition(trimmedFactoryPid, locale);
        if (objectClassDefinition == null) {
            throw new IOException("No Metatype factory definition found for PID: " + trimmedFactoryPid);
        }

        ensureFactoryFileCanBeCreated(trimmedFactoryPid, trimmedIdentifier, filename);
        return createMetatypeFile(filename,
                buildCfgTemplate(trimmedFactoryPid, objectClassDefinition, trimmedIdentifier),
                true);
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

    private void ensureFactoryFileCanBeCreated(String factoryPid, String identifier, String filename) throws IOException {
        if (blacklist.contains(filename) || blacklist.contains(filename + ".disabled")) {
            throw new IOException("Create denied: " + filename + " is blacklisted.");
        }
        if (hasExistingFactoryInstanceFile(factoryPid, identifier)) {
            throw new IOException("File already exists: " + filename);
        }
    }

    private String createMetatypeFile(String filename, String content, boolean allowDisabledVariant) throws IOException {
        if (blacklist.contains(filename) || (allowDisabledVariant && blacklist.contains(filename + ".disabled"))) {
            throw new IOException("Create denied: " + filename + " is blacklisted.");
        }

        Path filePath = resolveConfigPath(filename);
        if (Files.exists(filePath)) {
            throw new IOException("File already exists: " + filename);
        }

        Files.write(filePath, content.getBytes(StandardCharsets.UTF_8));
        return filename;
    }

    private Path resolveConfigPath(String filename) throws IOException {
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

    private String validateFilename(String filename) throws IOException {
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

    private String buildCfgTemplate(String pid, ObjectClassDefinition objectClassDefinition) {
        return buildCfgTemplate(pid, objectClassDefinition, null);
    }

    private String buildCfgTemplate(String pid, ObjectClassDefinition objectClassDefinition, String instanceIdentifier) {
        StringBuilder builder = new StringBuilder();

        appendCommentLine(builder, objectClassDefinition.getName());
        appendCommentLine(builder, "PID: " + pid);
        if (instanceIdentifier != null && !instanceIdentifier.isBlank()) {
            appendCommentLine(builder, "Instance: " + instanceIdentifier.trim());
        }
        appendCommentLine(builder, objectClassDefinition.getDescription());

        builder.append('\n');

        appendTemplateDefinitions(builder, objectClassDefinition.getAttributeDefinitions(ObjectClassDefinition.REQUIRED));
        appendTemplateDefinitions(builder, objectClassDefinition.getAttributeDefinitions(ObjectClassDefinition.OPTIONAL));

        return builder.toString();
    }

    private void appendTemplateDefinitions(StringBuilder builder, AttributeDefinition[] definitions) {
        if (definitions == null) {
            return;
        }

        for (AttributeDefinition definition : definitions) {
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

        builder.append('\n');
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

    private void validateFactoryIdentifier(String identifier) throws IOException {
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

    private boolean isSupportedConfigFilename(String filename) {
        String lowercaseName = filename.toLowerCase(Locale.ROOT);
        return SUPPORTED_CONFIG_EXTENSIONS.stream().anyMatch(lowercaseName::endsWith);
    }

    private String normalizeConfigFilename(String filename) {
        String normalizedName = filename;
        if (normalizedName.endsWith(".disabled")) {
            normalizedName = normalizedName.substring(0, normalizedName.length() - ".disabled".length());
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

    public String decrypt(String value) {
        if (value == null)
            return null;
        if (value.startsWith("ENC(") && value.endsWith(")")) {
            String cipherText = value.substring(4, value.length() - 1);
            return CryptoEngine.decryptString(cipherText);
        }
        return value;
    }
}
