package org.jahia.modules.osgiconfigmanager.graphql;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;
import graphql.annotations.annotationTypes.GraphQLNonNull;
import org.jahia.modules.osgiconfigmanager.admin.ConfigurationPluginProbe;
import org.jahia.modules.osgiconfigmanager.admin.OsgiConfigService;
import org.jahia.modules.osgiconfigmanager.admin.PreferenceKeys;
import org.jahia.modules.osgiconfigmanager.admin.UserPreferenceService;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Read operations. Only reachable through {@link OsgiConfigManagerQueryExtension}, which has
 * already authorized {@link #caller}, so no field here re-checks access.
 */
@GraphQLName("OsgiConfigManagerQuery")
@GraphQLDescription("OSGi Configurations Manager queries")
public class OsgiConfigManagerQuery {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final OsgiConfigService service;
    private final GqlCaller caller;
    // Optional: the probe exists only while its configuration file does (ConfigurationPolicy.REQUIRE).
    private final ConfigurationPluginProbe pluginProbe;

    OsgiConfigManagerQuery(OsgiConfigService service, GqlCaller caller) {
        this(service, caller, null);
    }

    OsgiConfigManagerQuery(OsgiConfigService service, GqlCaller caller, ConfigurationPluginProbe pluginProbe) {
        this.service = service;
        this.caller = caller;
        this.pluginProbe = pluginProbe;
    }

    @GraphQLField
    @GraphQLName("files")
    @GraphQLDescription("Configuration files in karaf/etc, optionally filtered on name or content")
    public List<GqlConfigFile> files(@GraphQLName("search") String search) {
        try {
            return service.searchFiles(search == null ? "" : search, caller.getLocale(), caller.isRoot())
                    .stream().map(GqlConfigFile::new).collect(Collectors.toList());
        } catch (Exception e) {
            throw OsgiConfigGqlSupport.translate(e);
        }
    }

    @GraphQLField
    @GraphQLName("uiConfig")
    @GraphQLDescription("UI settings for the admin app")
    public GqlUiConfig uiConfig() {
        try {
            return new GqlUiConfig(service.getUiConfig());
        } catch (Exception e) {
            throw OsgiConfigGqlSupport.translate(e);
        }
    }

    @GraphQLField
    @GraphQLName("file")
    @GraphQLDescription("Read one configuration file")
    public GqlConfigFileContent file(@GraphQLName("name") @GraphQLNonNull String name) {
        // Attributed at INFO so reads, which can expose ENC values, are auditable in production.
        OsgiConfigGqlSupport.audit(caller, "read", name);
        try {
            Map<String, Object> data = service.readFile(name, caller.getLocale(), caller.isRoot());
            return new GqlConfigFileContent((String) data.get("configState"), (String) data.get("rawContent"),
                    (String) data.get("pid"), toJson(data.get("properties")), toJson(data.get("metatype")));
        } catch (Exception e) {
            throw OsgiConfigGqlSupport.translate(e);
        }
    }

    @GraphQLField
    @GraphQLName("availableMetatypes")
    @GraphQLDescription("Metatype definitions a new file can be created from, as a JSON array")
    public String availableMetatypes() {
        try {
            return toJson(service.listAvailableMetatypeConfigurations(caller.getLocale(), caller.isRoot()));
        } catch (Exception e) {
            throw OsgiConfigGqlSupport.translate(e);
        }
    }

    @GraphQLField
    @GraphQLName("preference")
    @GraphQLDescription("One of the caller's stored UI preferences, or null when unset")
    public String preference(@GraphQLName("key") @GraphQLNonNull String key) {
        if (!PreferenceKeys.isAllowed(key)) {
            throw new OsgiConfigGqlException(OsgiConfigGqlException.BAD_REQUEST, "Invalid preference key");
        }
        try {
            return UserPreferenceService.read(caller.getSession(), caller.getUser(), key).orElse(null);
        } catch (Exception e) {
            throw OsgiConfigGqlSupport.translate(e);
        }
    }

    /**
     * What the decryption probe received, by shape only, as JSON: {@code pid}, {@code active} (false
     * while its configuration file does not exist), and when active {@code receivedAt} and
     * {@code delivered} (key to "plaintext" or "encrypted"). No configuration value ever leaves
     * this field: a probe that echoed values would be a decryption oracle.
     */
    @GraphQLField
    @GraphQLName("pluginProbe")
    @GraphQLDescription("What the ConfigurationPlugin decryption probe received, by shape only, as a JSON object")
    public String pluginProbe() {
        Map<String, Object> probe = new LinkedHashMap<>();
        probe.put("pid", ConfigurationPluginProbe.PID);
        probe.put("active", pluginProbe != null);
        if (pluginProbe != null) {
            probe.put("receivedAt", pluginProbe.receivedAt());
            probe.put("delivered", pluginProbe.deliveredShapes());
        }
        try {
            return toJson(probe);
        } catch (Exception e) {
            throw OsgiConfigGqlSupport.translate(e);
        }
    }

    /** Jackson keeps the LinkedHashMap order the service builds, so file order survives. */
    private static String toJson(Object value) throws JsonProcessingException {
        return value == null ? null : MAPPER.writeValueAsString(value);
    }
}
