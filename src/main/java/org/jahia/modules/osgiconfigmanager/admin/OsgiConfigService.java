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
@Component(service = OsgiConfigService.class)
public class OsgiConfigService {

    private static final Logger logger = LoggerFactory.getLogger(OsgiConfigService.class);
    private File karafEtcDir;

    public OsgiConfigService() {
        String etcPath = System.getProperty("karaf.etc");
        if (etcPath != null && !etcPath.isEmpty()) {
            karafEtcDir = new File(etcPath);
        } else {
            logger.error("System property 'karaf.etc' not found!");
        }
    }

    /**
     * List all .cfg and .yml files (including disabled ones)
     */
    public List<Map<String, Object>> listFiles() {
        if (karafEtcDir == null) {
            logger.error("karafEtcDir is null. System property 'karaf.etc' was: {}", System.getProperty("karaf.etc"));
            return Collections.emptyList();
        }
        if (!karafEtcDir.exists()) {
            logger.error("karafEtcDir does not exist: {}", karafEtcDir.getAbsolutePath());
            return Collections.emptyList();
        }

        logger.info("Listing configuration files from: {}", karafEtcDir.getAbsolutePath());

        File[] files = karafEtcDir.listFiles((dir, name) -> {
            String lowercaseName = name.toLowerCase();
            return (lowercaseName.endsWith(".cfg") || lowercaseName.endsWith(".yml") ||
                    lowercaseName.endsWith(".cfg.disabled") || lowercaseName.endsWith(".yml.disabled"));
        });

        if (files == null) {
            logger.warn("listFiles returned null (IO error or not a directory?)");
            return Collections.emptyList();
        }

        logger.info("Found {} configuration files.", files.length);

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
        File file = new File(karafEtcDir, filename);
        String type = getFileType(filename);

        if (content.containsKey("rawContent") && "yml".equals(type)) {
            String raw = (String) content.get("rawContent");
            java.nio.file.Files.write(file.toPath(), raw.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return;
        }

        if ("cfg".equals(type)) {
            Object propertiesObj = content.get("properties");

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
            DumperOptions options = new DumperOptions();
            options.setDefaultFlowStyle(DumperOptions.FlowStyle.BLOCK);
            Yaml yaml = new Yaml(options);
            try (java.io.FileWriter writer = new java.io.FileWriter(file)) {
                yaml.dump(content.get("properties"), writer);
            }
        }
    }

    public void toggleFileStatus(String filename) throws IOException {
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
        File file = new File(karafEtcDir, filename);
        if (file.exists()) {
            if (!file.delete()) {
                throw new IOException("Failed to delete file: " + filename);
            }
        }
    }

    public void createFile(String filename) throws IOException {
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
