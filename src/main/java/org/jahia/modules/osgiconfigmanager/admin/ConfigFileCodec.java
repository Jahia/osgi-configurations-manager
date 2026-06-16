package org.jahia.modules.osgiconfigmanager.admin;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.yaml.snakeyaml.DumperOptions;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.InputStream;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;

/**
 * Reads and writes the on-disk representation of {@code .cfg} (Karaf properties, comment/empty-line
 * aware) and {@code .yml} configuration files. Pure file-codec logic with no filtering or metatype
 * concerns, extracted from {@link OsgiConfigService}.
 */
final class ConfigFileCodec {

    private static final Logger LOGGER = LoggerFactory.getLogger(ConfigFileCodec.class);
    private static final String ENTRY_VALUE = "value";
    private static final String ENTRY_TYPE_COMMENT = "comment";

    private ConfigFileCodec() {
        // Utility class
    }

    /** Parses a {@code .cfg} file into ordered property/comment/empty-line entries. */
    static List<Map<String, String>> readCfgProperties(Path filePath) throws IOException {
        List<Map<String, String>> entries = new ArrayList<>();
        try (BufferedReader bufferedReader = Files.newBufferedReader(filePath, StandardCharsets.UTF_8)) {
            String line;
            while ((line = bufferedReader.readLine()) != null) {
                entries.add(parseCfgLine(line));
            }
        }
        return entries;
    }

    private static Map<String, String> parseCfgLine(String line) {
        Map<String, String> entry = new HashMap<>();
        String trimmed = line.trim();
        if (trimmed.isEmpty()) {
            entry.put("type", "empty");
            return entry;
        }

        if (trimmed.startsWith("#")) {
            entry.put("type", ENTRY_TYPE_COMMENT);
            entry.put(ENTRY_VALUE, line);
            return entry;
        }

        int separatorIndex = findCfgSeparatorIndex(line);
        if (separatorIndex != -1) {
            entry.put("type", "property");
            entry.put("key", line.substring(0, separatorIndex).trim());
            entry.put(ENTRY_VALUE, line.substring(separatorIndex + 1).trim());
            return entry;
        }

        entry.put("type", ENTRY_TYPE_COMMENT);
        entry.put(ENTRY_VALUE, line);
        return entry;
    }

    private static int findCfgSeparatorIndex(String line) {
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

    static Object readYamlProperties(Path filePath) throws IOException {
        LoaderOptions loaderOptions = new LoaderOptions();
        Yaml yaml = new Yaml(new SafeConstructor(loaderOptions) {
            @Override
            protected Map<Object, Object> createDefaultMap(int initSize) {
                return new LinkedHashMap<>(initSize);
            }
        });

        try (InputStream in = Files.newInputStream(filePath)) {
            return yaml.load(in);
        }
    }

    static void writeRawContent(Path filePath, String raw) throws IOException {
        Files.write(filePath, (raw == null ? "" : raw).getBytes(StandardCharsets.UTF_8));
    }

    /** Serializes structured {@code .cfg} content: either ordered entries or a legacy flat map. */
    @SuppressWarnings("unchecked")
    static void saveCfgContent(Path filePath, Object propertiesObj) throws IOException {
        if (propertiesObj == null) {
            LOGGER.warn("No properties or rawContent provided for .cfg save. Writing empty file.");
            Files.write(filePath, new byte[0]);
            return;
        }

        if (propertiesObj instanceof Map) {
            saveLegacyCfgProperties(filePath, (Map<String, String>) propertiesObj);
            return;
        }

        saveCfgEntries(filePath, (List<Map<String, Object>>) propertiesObj);
    }

    private static void saveLegacyCfgProperties(Path filePath, Map<String, String> properties) throws IOException {
        Properties props = new Properties();
        props.putAll(properties);
        // Store through a UTF-8 writer (Properties.store(OutputStream) would write ISO-8859-1,
        // inconsistent with how the file is read back).
        try (BufferedWriter writer = Files.newBufferedWriter(filePath, StandardCharsets.UTF_8)) {
            props.store(writer, "Modified by OSGi Configurations Manager");
        }
    }

    private static void saveCfgEntries(Path filePath, List<Map<String, Object>> entries) throws IOException {
        try (BufferedWriter bufferedWriter = Files.newBufferedWriter(filePath, StandardCharsets.UTF_8)) {
            for (Map<String, Object> entry : entries) {
                String entryType = (String) entry.get("type");
                if (ENTRY_TYPE_COMMENT.equals(entryType)) {
                    bufferedWriter.write((String) entry.get(ENTRY_VALUE));
                    bufferedWriter.newLine();
                } else if ("empty".equals(entryType)) {
                    bufferedWriter.newLine();
                } else if ("property".equals(entryType)) {
                    bufferedWriter.write(entry.get("key") + " = " + entry.get(ENTRY_VALUE));
                    bufferedWriter.newLine();
                }
            }
        }
    }

    /** Serializes a YAML document tree in block style (fallback when no rawContent is supplied). */
    static void saveYaml(Path filePath, Object data) throws IOException {
        DumperOptions options = new DumperOptions();
        options.setDefaultFlowStyle(DumperOptions.FlowStyle.BLOCK);
        Yaml yaml = new Yaml(options);
        try (Writer writer = Files.newBufferedWriter(filePath, StandardCharsets.UTF_8)) {
            yaml.dump(data, writer);
        }
    }
}
