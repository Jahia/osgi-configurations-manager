package org.jahia.modules.osgiconfigmanager.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;
import graphql.annotations.annotationTypes.GraphQLNonNull;
import org.jahia.modules.osgiconfigmanager.admin.OsgiConfigService;
import org.jahia.modules.osgiconfigmanager.admin.PreferenceKeys;
import org.jahia.modules.osgiconfigmanager.admin.UserPreferenceService;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * State-changing and secret-touching operations. Only reachable through
 * {@link OsgiConfigManagerMutationExtension}, which has already refused CSRF-shaped requests and
 * authorized {@link #caller}. Every operation is audited with the caller's identity.
 */
@GraphQLName("OsgiConfigManagerMutation")
@GraphQLDescription("OSGi Configurations Manager mutations")
public class OsgiConfigManagerMutation {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final OsgiConfigService service;
    private final GqlCaller caller;

    OsgiConfigManagerMutation(OsgiConfigService service, GqlCaller caller) {
        this.service = service;
        this.caller = caller;
    }

    @FunctionalInterface
    private interface ServiceCall<T> {
        T run() throws Exception;
    }

    private <T> T audited(String action, String filename, ServiceCall<T> call) {
        OsgiConfigGqlSupport.audit(caller, action, filename);
        try {
            return call.run();
        } catch (Exception e) {
            throw OsgiConfigGqlSupport.translate(e);
        }
    }

    @GraphQLField
    @GraphQLName("save")
    @GraphQLDescription("Replace a file's content")
    public Boolean save(@GraphQLName("name") @GraphQLNonNull String name,
                        @GraphQLName("rawContent") @GraphQLNonNull String rawContent) {
        return audited("save", name, () -> {
            service.saveFile(name, Collections.singletonMap("rawContent", rawContent), caller.isRoot());
            return Boolean.TRUE;
        });
    }

    /*
     * The archive operations answer JSON rather than GraphQL types, like the bundleUsage query:
     * Jahia's API scope grants this module's types by name in a default configuration that an
     * upgrade does not rewrite, so a new type would be refused on every existing instance. They are
     * mutations although export and preview write nothing: a mutation is POST-only and passes the
     * CSRF checks, and these calls carry a password.
     */

    @GraphQLField
    @GraphQLName("exportArchive")
    @GraphQLDescription("Seal files into a password-protected archive. JSON: archive (base64), fileName, files, warnings")
    public String exportArchive(@GraphQLName("names") @GraphQLNonNull List<String> names,
                                @GraphQLName("password") @GraphQLNonNull String password) {
        return audited("exportArchive", String.join(",", names), () ->
                MAPPER.writeValueAsString(service.exportArchive(names, password.toCharArray(), caller.isRoot())));
    }

    @GraphQLField
    @GraphQLName("previewArchiveImport")
    @GraphQLDescription("What importing an archive would do, file by file, without writing. JSON")
    public String previewArchiveImport(@GraphQLName("archive") @GraphQLNonNull String archive,
                                       @GraphQLName("password") @GraphQLNonNull String password) {
        return audited("previewArchiveImport", "<archive>", () ->
                MAPPER.writeValueAsString(service.previewArchiveImport(archive, password.toCharArray(), caller.isRoot())));
    }

    @GraphQLField
    @GraphQLName("importArchive")
    @GraphQLDescription("Write the chosen files of an archive. JSON: imported, failed")
    public String importArchive(@GraphQLName("archive") @GraphQLNonNull String archive,
                                @GraphQLName("password") @GraphQLNonNull String password,
                                @GraphQLName("names") @GraphQLNonNull List<String> names) {
        return audited("importArchive", String.join(",", names), () ->
                MAPPER.writeValueAsString(service.importArchive(archive, password.toCharArray(), names, caller.isRoot())));
    }

    @GraphQLField
    @GraphQLName("toggle")
    @GraphQLDescription("Enable or disable a file by adding or removing its .disabled suffix")
    public Boolean toggle(@GraphQLName("name") @GraphQLNonNull String name) {
        return audited("toggle", name, () -> {
            service.toggleFileStatus(name, caller.isRoot());
            return Boolean.TRUE;
        });
    }

    @GraphQLField
    @GraphQLName("delete")
    @GraphQLDescription("Delete a file")
    public Boolean delete(@GraphQLName("name") @GraphQLNonNull String name) {
        return audited("delete", name, () -> {
            service.deleteFile(name, caller.isRoot());
            return Boolean.TRUE;
        });
    }

    @GraphQLField
    @GraphQLName("markAsDefault")
    @GraphQLDescription("Mark a file as the module's default configuration")
    public Boolean markAsDefault(@GraphQLName("name") @GraphQLNonNull String name) {
        return audited("markAsDefault", name, () -> {
            service.markAsDefaultConfiguration(name, caller.isRoot());
            return Boolean.TRUE;
        });
    }

    @GraphQLField
    @GraphQLName("create")
    @GraphQLDescription("Create an empty file")
    public Boolean create(@GraphQLName("name") @GraphQLNonNull String name) {
        return audited("create", name, () -> {
            service.createFile(name, caller.isRoot());
            return Boolean.TRUE;
        });
    }

    @GraphQLField
    @GraphQLName("createFromMetatype")
    @GraphQLDescription("Create a file from a metatype definition and return its name")
    public String createFromMetatype(@GraphQLName("pid") @GraphQLNonNull String pid,
                                     @GraphQLName("instanceIdentifier") String instanceIdentifier) {
        return audited("createFromMetatype", pid, () ->
                instanceIdentifier != null && !instanceIdentifier.trim().isEmpty()
                        ? service.createFactoryFileFromMetatype(pid, instanceIdentifier, caller.getLocale(), caller.isRoot())
                        : service.createFileFromMetatype(pid, caller.getLocale(), caller.isRoot()));
    }

    @GraphQLField
    @GraphQLName("encrypt")
    @GraphQLDescription("Encrypt a value into an ENC(...) wrapper bound to the configuration file `name`: "
            + "the value decrypts in that configuration only")
    public String encrypt(@GraphQLName("value") @GraphQLNonNull String value,
                          @GraphQLName("name") @GraphQLNonNull String name) {
        return audited("encrypt", name, () -> service.encryptForFile(value, name, caller.isRoot()));
    }

    @GraphQLField
    @GraphQLName("decrypt")
    @GraphQLDescription("Decrypt a value, which must occur in the named file")
    public String decrypt(@GraphQLName("name") @GraphQLNonNull String name,
                          @GraphQLName("value") @GraphQLNonNull String value) {
        // File-bound on purpose: the service checks both that the caller may read the file and that
        // the value is really in it. Without that, this would decrypt anything and be an oracle.
        return audited("decrypt", name, () -> service.decryptForFile(name, value, caller.isRoot()));
    }

    @GraphQLField
    @GraphQLName("setPreference")
    @GraphQLDescription("Store one of the caller's UI preferences; false when there is no user node to store it on")
    public Boolean setPreference(@GraphQLName("key") @GraphQLNonNull String key,
                                 @GraphQLName("value") String value) {
        if (!PreferenceKeys.isAllowed(key)) {
            throw new OsgiConfigGqlException(OsgiConfigGqlException.BAD_REQUEST, "Invalid preference key");
        }
        return audited("setPreference", null,
                () -> UserPreferenceService.write(caller.getSession(), caller.getUser(), key, value));
    }
}
