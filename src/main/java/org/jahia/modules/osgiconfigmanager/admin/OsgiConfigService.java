package org.jahia.modules.osgiconfigmanager.admin;

import org.osgi.service.component.annotations.Component;
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
    private File karafEtcDir;
    private Set<String> blacklist = new HashSet<>();

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

    private String getFileType(String filename) {
        if (filename.contains(".cfg"))
            return "cfg";
        if (filename.contains(".yml"))
            return "yml";
        return "unknown";
    }

    public Map<String, Object> readFile(String filename) throws IOException {
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
