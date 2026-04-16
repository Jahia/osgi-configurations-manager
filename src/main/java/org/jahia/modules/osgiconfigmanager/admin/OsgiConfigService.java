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
import java.util.*;
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
    private File karafEtcDir;
    private Set<String> blacklist = new HashSet<>();
    private volatile MetaTypeService metaTypeService;

    private static final String SELF_CONFIG = "org.jahia.modules.osgiconfigmanager.cfg";

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
        Set<String> factoryCapablePids = getManagedServiceFactoryPids(bundleContext);

        for (Bundle bundle : bundles) {
            if (bundle == null || bundle.getState() < Bundle.STARTING) {
                continue;
            }

            try {
                MetaTypeInformation metaTypeInformation = currentMetaTypeService.getMetaTypeInformation(bundle);
                if (metaTypeInformation == null) {
                    continue;
                }

                String[] pids = metaTypeInformation.getPids();
                appendMetatypeDefinitions(metatypes, seenPids, bundle, metaTypeInformation, pids, localeCode, false, factoryCapablePids);

                String[] factoryPids = metaTypeInformation.getFactoryPids();
                appendMetatypeDefinitions(metatypes, seenPids, bundle, metaTypeInformation, factoryPids, localeCode, true, factoryCapablePids);
            } catch (Exception e) {
                LOGGER.debug("Unable to inspect metatype information for bundle {}", bundle.getSymbolicName(), e);
            }
        }

        metatypes.sort(Comparator
                .comparing((Map<String, Object> definition) -> Boolean.TRUE.equals(definition.get("factory")))
                .thenComparing((Map<String, Object> definition) -> String.valueOf(definition.getOrDefault("created", false)))
                .thenComparing(definition -> String.valueOf(definition.getOrDefault("name", definition.get("pid"))), String.CASE_INSENSITIVE_ORDER)
                .thenComparing(definition -> String.valueOf(definition.get("pid")), String.CASE_INSENSITIVE_ORDER));

        return metatypes;
    }

    private void appendMetatypeDefinitions(List<Map<String, Object>> metatypes, Set<String> seenPids,
                                           Bundle bundle, MetaTypeInformation metaTypeInformation, String[] pids,
                                           String localeCode, boolean factory, Set<String> factoryCapablePids) {
        if (pids == null) {
            return;
        }

        for (String pid : pids) {
            boolean effectiveFactory = factory || factoryCapablePids.contains(pid);
            if (pid == null || pid.isEmpty() || !seenPids.add((effectiveFactory ? "factory:" : "pid:") + pid)) {
                continue;
            }

            String suggestedFilename = effectiveFactory ? buildFactoryFilenamePattern(pid) : pid + DEFAULT_FACTORY_FILE_EXTENSION;
            if (!effectiveFactory && (blacklist.contains(suggestedFilename) || blacklist.contains(suggestedFilename + ".disabled"))) {
                continue;
            }

            try {
                ObjectClassDefinition objectClassDefinition = metaTypeInformation.getObjectClassDefinition(pid, localeCode);
                if (objectClassDefinition == null) {
                    continue;
                }

                Map<String, Object> definition = toMetaTypeMap(pid, objectClassDefinition);
                definition.put("filename", suggestedFilename);
                definition.put("bundleName", getBundleDisplayName(bundle));
                definition.put("bundleSymbolicName", bundle.getSymbolicName());
                definition.put("factory", effectiveFactory);
                if (effectiveFactory) {
                    List<Map<String, Object>> instances = getFactoryInstances(pid);
                    definition.put("instances", instances);
                    definition.put("instanceCount", instances.size());
                    definition.put("created", !instances.isEmpty());
                } else {
                    definition.put("created", hasExistingConfigurationFile(pid));
                }
                metatypes.add(definition);
            } catch (IllegalArgumentException e) {
                LOGGER.debug("Metatype PID {} not found in bundle {}", pid, bundle.getSymbolicName());
            } catch (Exception e) {
                LOGGER.debug("Unable to list metatype PID {} from bundle {}", pid, bundle.getSymbolicName(), e);
            }
        }
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
        if (blacklist.contains(filename)) {
            throw new IOException("Access denied: " + filename + " is blacklisted.");
        }

        File file = new File(karafEtcDir, filename);
        if (!file.exists()) {
            throw new IOException("File not found: " + filename);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        String type = getFileType(filename);

        // Always read raw content for Monaco Support
        String rawContent = new String(java.nio.file.Files.readAllBytes(file.toPath()),
                java.nio.charset.StandardCharsets.UTF_8);
        result.put("rawContent", rawContent);

        if ("cfg".equals(type) || "yml".equals(type)) {
            String pid = resolveMetatypePid(filename, locale);
            result.put("pid", pid);

            Map<String, Object> metaTypeDefinition = getMetaTypeDefinition(pid, locale);
            if (metaTypeDefinition != null) {
                result.put("metatype", metaTypeDefinition);
            }
        }

        if ("cfg".equals(type)) {
            List<Map<String, String>> entries = new ArrayList<>();
            try (java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.FileReader(file))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    Map<String, String> entry = new HashMap<>();
                    String trimmed = line.trim();
                    if (trimmed.isEmpty()) {
                        entry.put("type", "empty");
                    } else if (trimmed.startsWith("#")) {
                        entry.put("type", "comment");
                        entry.put("value", line);
                    } else {
                        // Very basic property parsing (key=value or key:value)
                        int eqIndex = line.indexOf('=');
                        int colIndex = line.indexOf(':');
                        int separatorIndex = -1;
                        if (eqIndex != -1 && colIndex != -1) {
                            separatorIndex = Math.min(eqIndex, colIndex);
                        } else if (eqIndex != -1) {
                            separatorIndex = eqIndex;
                        } else {
                            separatorIndex = colIndex;
                        }

                        if (separatorIndex != -1) {
                            entry.put("type", "property");
                            entry.put("key", line.substring(0, separatorIndex).trim());
                            entry.put("value", line.substring(separatorIndex + 1).trim());
                        } else {
                            // Fallback, treat as comment or weird line
                            entry.put("type", "comment");
                            entry.put("value", line);
                        }
                    }
                    entries.add(entry);
                }
            }
            result.put("properties", entries);
        } else if ("yml".equals(type)) {
            LoaderOptions loaderOptions = new LoaderOptions();
            Yaml yaml = new Yaml(new SafeConstructor(loaderOptions) {
                @Override
                protected Map<Object, Object> createDefaultMap(int initSize) {
                    return new LinkedHashMap<>(initSize);
                }
            });
            try (FileInputStream in = new FileInputStream(file)) {
                Object data = yaml.load(in);
                result.put("properties", data); // structured data
            }
        }
        return result;
    }

    private String getConfigurationPid(String filename) {
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
            if (bundle == null || bundle.getState() < Bundle.STARTING) {
                continue;
            }

            try {
                MetaTypeInformation metaTypeInformation = currentMetaTypeService.getMetaTypeInformation(bundle);
                if (metaTypeInformation == null) {
                    continue;
                }

                bestMatch = findBestFactoryPidMatch(normalizedConfigurationName, metaTypeInformation.getPids(), false, factoryCapablePids, seenFactoryPids, bestMatch);
                bestMatch = findBestFactoryPidMatch(normalizedConfigurationName, metaTypeInformation.getFactoryPids(), true, factoryCapablePids, seenFactoryPids, bestMatch);
            } catch (Exception e) {
                LOGGER.debug("Unable to inspect metatype information for bundle {}", bundle.getSymbolicName(), e);
            }
        }

        return bestMatch;
    }

    private String findBestFactoryPidMatch(String normalizedConfigurationName, String[] pids,
                                           boolean declaredFactory, Set<String> factoryCapablePids, Set<String> seenFactoryPids,
                                           String currentBestMatch) {
        if (pids == null) {
            return currentBestMatch;
        }

        String bestMatch = currentBestMatch;
        for (String pid : pids) {
            if (pid == null || pid.isEmpty() || !seenFactoryPids.add(pid)) {
                continue;
            }

            boolean effectiveFactory = declaredFactory || factoryCapablePids.contains(pid);
            if (!effectiveFactory) {
                continue;
            }

            String prefix = pid + "-";
            if (!normalizedConfigurationName.startsWith(prefix) || normalizedConfigurationName.length() <= prefix.length()) {
                continue;
            }

            if (bestMatch == null || pid.length() > bestMatch.length()) {
                bestMatch = pid;
            }
        }

        return bestMatch;
    }

    private boolean hasExistingConfigurationFile(String pid) {
        if (karafEtcDir == null || pid == null || pid.isEmpty()) {
            return false;
        }

        for (String candidate : getConfigurationFileCandidates(pid)) {
            if (new File(karafEtcDir, candidate).exists()) {
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
                        .thenComparing(instance -> String.valueOf(instance.getOrDefault("filename", "")), String.CASE_INSENSITIVE_ORDER))
                .collect(Collectors.toList());
    }

    private Map<String, Object> toFactoryInstanceMap(String factoryPid, File file) {
        String identifier = extractFactoryIdentifier(factoryPid, file.getName());
        if (identifier == null || identifier.isEmpty()) {
            return null;
        }

        Map<String, Object> instance = new LinkedHashMap<>();
        instance.put("identifier", identifier);
        instance.put("filename", file.getName());
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
            if (new File(karafEtcDir, candidate).exists()) {
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
        MetaTypeService currentMetaTypeService = this.metaTypeService;
        if (currentMetaTypeService == null || pid == null || pid.isEmpty()) {
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

        for (Bundle bundle : bundles) {
            if (bundle == null || bundle.getState() < Bundle.STARTING) {
                continue;
            }

            try {
                MetaTypeInformation metaTypeInformation = currentMetaTypeService.getMetaTypeInformation(bundle);
                if (metaTypeInformation == null) {
                    continue;
                }

                ObjectClassDefinition objectClassDefinition = metaTypeInformation.getObjectClassDefinition(pid, localeCode);
                if (objectClassDefinition != null) {
                    return toMetaTypeMap(pid, objectClassDefinition);
                }
            } catch (IllegalArgumentException e) {
                LOGGER.debug("Metatype PID {} not found in bundle {}", pid, bundle.getSymbolicName());
            } catch (Exception e) {
                LOGGER.debug("Unable to read metatype for PID {} from bundle {}", pid, bundle.getSymbolicName(), e);
            }
        }

        return null;
    }

    private BundleContext getBundleContext() {
        Bundle bundle = FrameworkUtil.getBundle(OsgiConfigService.class);
        return bundle != null ? bundle.getBundleContext() : null;
    }

    private Map<String, Object> toMetaTypeMap(String pid, ObjectClassDefinition objectClassDefinition) {
        Map<String, Object> metatype = new LinkedHashMap<>();
        metatype.put("pid", pid);
        metatype.put("name", objectClassDefinition.getName());
        metatype.put("description", objectClassDefinition.getDescription());

        List<Map<String, Object>> properties = new ArrayList<>();
        appendAttributeDefinitions(properties, objectClassDefinition.getAttributeDefinitions(ObjectClassDefinition.REQUIRED), false);
        appendAttributeDefinitions(properties, objectClassDefinition.getAttributeDefinitions(ObjectClassDefinition.OPTIONAL), true);
        metatype.put("properties", properties);
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
        if (blacklist.contains(filename)) {
            throw new IOException("Save denied: " + filename + " is blacklisted.");
        }

        File file = new File(karafEtcDir, filename);

        // Auto-Backup Logic
        if (file.exists()) {
            try {
                File backupFile = new File(karafEtcDir, filename + ".bak");
                java.nio.file.Files.copy(file.toPath(), backupFile.toPath(),
                        java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                LOGGER.info("Created backup for {}: {}", filename, backupFile.getName());
            } catch (IOException e) {
                LOGGER.error("Failed to create backup for " + filename, e);
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
            java.nio.file.Files.write(file.toPath(), raw.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return;
        }

        String type = getFileType(filename);

        if ("cfg".equals(type)) {
            Object propertiesObj = content.get("properties");

            if (propertiesObj == null) {
                // If no rawContent and no properties, we can't save anything meaningful.
                // To avoid NPE, we might warn or write empty.
                LOGGER.warn("No properties or rawContent provided for .cfg save. Writing empty file.");
                try (java.io.BufferedWriter writer = new java.io.BufferedWriter(new java.io.FileWriter(file))) {
                    writer.write("");
                }
                return;
            }

            // Handle legacy map format if for some reason we get it (backward compat)
            if (propertiesObj instanceof Map) {
                Properties props = new Properties();
                props.putAll((Map<String, String>) propertiesObj);
                try (FileOutputStream out = new FileOutputStream(file)) {
                    props.store(out, "Modified by OSGi Configurations Manager");
                }
                return;
            }

            // New List format
            List<Map<String, Object>> entries = (List<Map<String, Object>>) propertiesObj;
            try (java.io.BufferedWriter writer = new java.io.BufferedWriter(new java.io.FileWriter(file))) {
                for (Map<String, Object> entry : entries) {
                    String entryType = (String) entry.get("type");
                    if ("comment".equals(entryType)) {
                        writer.write((String) entry.get("value"));
                        writer.newLine();
                    } else if ("empty".equals(entryType)) {
                        writer.newLine();
                    } else if ("property".equals(entryType)) {
                        writer.write(entry.get("key") + " = " + entry.get("value"));
                        writer.newLine();
                    }
                }
            }
        } else if ("yml".equals(type)) {
            // YML fallback if no rawContent sent (unlikely given frontend logic, but good
            // for completeness)
            DumperOptions options = new DumperOptions();
            options.setDefaultFlowStyle(DumperOptions.FlowStyle.BLOCK);
            Yaml yaml = new Yaml(options);
            try (java.io.FileWriter writer = new java.io.FileWriter(file)) {
                yaml.dump(content.get("properties"), writer);
            }
        }
    }

    public void toggleFileStatus(String filename) throws IOException {
        if (blacklist.contains(filename)) {
            throw new IOException("Toggle denied: " + filename + " is blacklisted.");
        }

        File file = new File(karafEtcDir, filename);
        if (!file.exists()) {
            throw new IOException("File not found: " + filename);
        }

        String newName;
        if (filename.endsWith(".disabled")) {
            newName = filename.substring(0, filename.length() - ".disabled".length());
        } else {
            newName = filename + ".disabled";
        }

        File newFile = new File(karafEtcDir, newName);
        if (newFile.exists()) {
            throw new IOException("Target file already exists: " + newName);
        }

        if (!file.renameTo(newFile)) {
            throw new IOException("Failed to rename file");
        }
    }

    public void deleteFile(String filename) throws IOException {
        if (blacklist.contains(filename)) {
            throw new IOException("Delete denied: " + filename + " is blacklisted.");
        }

        File file = new File(karafEtcDir, filename);
        if (file.exists()) {
            if (!file.delete()) {
                throw new IOException("Failed to delete file: " + filename);
            }
        }
    }

    public void createFile(String filename) throws IOException {
        if (blacklist.contains(filename)) {
            throw new IOException("Create denied: " + filename + " is blacklisted.");
        }

        File file = new File(karafEtcDir, filename);
        if (file.exists()) {
            throw new IOException("File already exists: " + filename);
        }
        if (!file.createNewFile()) {
            throw new IOException("Failed to create file: " + filename);
        }
    }

    public String createFileFromMetatype(String pid, Locale locale) throws IOException {
        if (pid == null || pid.trim().isEmpty()) {
            throw new IOException("PID is required");
        }

        String trimmedPid = pid.trim();
        String filename = trimmedPid + ".cfg";
        if (blacklist.contains(filename)) {
            throw new IOException("Create denied: " + filename + " is blacklisted.");
        }

        File file = new File(karafEtcDir, filename);
        if (file.exists()) {
            throw new IOException("File already exists: " + filename);
        }

        ObjectClassDefinition objectClassDefinition = findObjectClassDefinition(trimmedPid, locale);
        if (objectClassDefinition == null) {
            throw new IOException("No Metatype definition found for PID: " + trimmedPid);
        }

        String content = buildCfgTemplate(trimmedPid, objectClassDefinition);
        java.nio.file.Files.write(file.toPath(), content.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        return filename;
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
        if (blacklist.contains(filename) || blacklist.contains(filename + ".disabled")) {
            throw new IOException("Create denied: " + filename + " is blacklisted.");
        }
        if (hasExistingFactoryInstanceFile(trimmedFactoryPid, trimmedIdentifier)) {
            throw new IOException("File already exists: " + filename);
        }

        ObjectClassDefinition objectClassDefinition = findFactoryObjectClassDefinition(trimmedFactoryPid, locale);
        if (objectClassDefinition == null) {
            throw new IOException("No Metatype factory definition found for PID: " + trimmedFactoryPid);
        }

        File file = new File(karafEtcDir, filename);
        String content = buildCfgTemplate(trimmedFactoryPid, objectClassDefinition, trimmedIdentifier);
        java.nio.file.Files.write(file.toPath(), content.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        return filename;
    }

    private ObjectClassDefinition findObjectClassDefinition(String pid, Locale locale) {
        MetaTypeService currentMetaTypeService = this.metaTypeService;
        if (currentMetaTypeService == null || pid == null || pid.isEmpty()) {
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

        for (Bundle bundle : bundles) {
            if (bundle == null || bundle.getState() < Bundle.STARTING) {
                continue;
            }

            try {
                MetaTypeInformation metaTypeInformation = currentMetaTypeService.getMetaTypeInformation(bundle);
                if (metaTypeInformation == null) {
                    continue;
                }

                ObjectClassDefinition objectClassDefinition = metaTypeInformation.getObjectClassDefinition(pid, localeCode);
                if (objectClassDefinition != null) {
                    return objectClassDefinition;
                }
            } catch (IllegalArgumentException e) {
                LOGGER.debug("Metatype PID {} not found in bundle {}", pid, bundle.getSymbolicName());
            } catch (Exception e) {
                LOGGER.debug("Unable to read metatype for PID {} from bundle {}", pid, bundle.getSymbolicName(), e);
            }
        }

        return null;
    }

    private ObjectClassDefinition findFactoryObjectClassDefinition(String factoryPid, Locale locale) {
        MetaTypeService currentMetaTypeService = this.metaTypeService;
        if (currentMetaTypeService == null || factoryPid == null || factoryPid.isEmpty()) {
            return null;
        }

        BundleContext bundleContext = getBundleContext();
        if (bundleContext == null) {
            return null;
        }

        String localeCode = locale != null ? locale.toString() : null;
        Set<String> factoryCapablePids = getManagedServiceFactoryPids(bundleContext);
        Bundle[] bundles = bundleContext.getBundles();
        if (bundles == null) {
            return null;
        }

        for (Bundle bundle : bundles) {
            if (bundle == null || bundle.getState() < Bundle.STARTING) {
                continue;
            }

            try {
                MetaTypeInformation metaTypeInformation = currentMetaTypeService.getMetaTypeInformation(bundle);
                if (metaTypeInformation == null) {
                    continue;
                }

                String[] factoryPids = metaTypeInformation.getFactoryPids();
                boolean declaredAsFactory = factoryPids != null && Arrays.stream(factoryPids).anyMatch(factoryPid::equals);
                boolean exposedAsManagedServiceFactory = factoryCapablePids.contains(factoryPid);
                if (!declaredAsFactory && !exposedAsManagedServiceFactory) {
                    continue;
                }

                ObjectClassDefinition objectClassDefinition = metaTypeInformation.getObjectClassDefinition(factoryPid, localeCode);
                if (objectClassDefinition != null) {
                    return objectClassDefinition;
                }
            } catch (IllegalArgumentException e) {
                LOGGER.debug("Metatype factory PID {} not found in bundle {}", factoryPid, bundle.getSymbolicName());
            } catch (Exception e) {
                LOGGER.debug("Unable to read metatype factory for PID {} from bundle {}", factoryPid, bundle.getSymbolicName(), e);
            }
        }

        return null;
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
