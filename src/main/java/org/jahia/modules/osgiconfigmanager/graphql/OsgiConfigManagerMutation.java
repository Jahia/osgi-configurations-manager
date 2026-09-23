package org.jahia.modules.osgiconfigmanager.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;
import graphql.annotations.annotationTypes.GraphQLNonNull;
import org.jahia.modules.osgiconfigmanager.admin.OsgiConfigService;
import org.jahia.modules.osgiconfigmanager.admin.PreferenceKeys;
import org.jahia.modules.osgiconfigmanager.admin.UserPreferenceService;

import java.util.Collections;

/**
 * State-changing and secret-touching operations. Only reachable through
 * {@link OsgiConfigManagerMutationExtension}, which has already refused CSRF-shaped requests and
 * authorized {@link #caller}. Every operation is audited with the caller's identity.
 */
@GraphQLName("OsgiConfigManagerMutation")
@GraphQLDescription("OSGi Configurations Manager mutations")
public class OsgiConfigManagerMutation {

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
    @GraphQLDescription("Replace a file's content")
    public Boolean save(@GraphQLName("name") @GraphQLNonNull String name,
                        @GraphQLName("rawContent") @GraphQLNonNull String rawContent) {
        return audited("save", name, () -> {
            service.saveFile(name, Collections.singletonMap("rawContent", rawContent), caller.isRoot());
            return Boolean.TRUE;
        });
    }

    @GraphQLField
    @GraphQLDescription("Enable or disable a file by adding or removing its .disabled suffix")
    public Boolean toggle(@GraphQLName("name") @GraphQLNonNull String name) {
        return audited("toggle", name, () -> {
            service.toggleFileStatus(name, caller.isRoot());
            return Boolean.TRUE;
        });
    }

    @GraphQLField
    @GraphQLDescription("Delete a file")
    public Boolean delete(@GraphQLName("name") @GraphQLNonNull String name) {
        return audited("delete", name, () -> {
            service.deleteFile(name, caller.isRoot());
            return Boolean.TRUE;
        });
    }

    @GraphQLField
    @GraphQLDescription("Mark a file as the module's default configuration")
    public Boolean markAsDefault(@GraphQLName("name") @GraphQLNonNull String name) {
        return audited("markAsDefault", name, () -> {
            service.markAsDefaultConfiguration(name, caller.isRoot());
            return Boolean.TRUE;
        });
    }

    @GraphQLField
    @GraphQLDescription("Create an empty file")
    public Boolean create(@GraphQLName("name") @GraphQLNonNull String name) {
        return audited("create", name, () -> {
            service.createFile(name, caller.isRoot());
            return Boolean.TRUE;
        });
    }

    @GraphQLField
    @GraphQLDescription("Create a file from a metatype definition and return its name")
    public String createFromMetatype(@GraphQLName("pid") @GraphQLNonNull String pid,
                                     @GraphQLName("instanceIdentifier") String instanceIdentifier) {
        return audited("createFromMetatype", pid, () ->
                instanceIdentifier != null && !instanceIdentifier.trim().isEmpty()
                        ? service.createFactoryFileFromMetatype(pid, instanceIdentifier, caller.getLocale(), caller.isRoot())
                        : service.createFileFromMetatype(pid, caller.getLocale(), caller.isRoot()));
    }

    @GraphQLField
    @GraphQLDescription("Encrypt a value into an ENC(...) wrapper")
    public String encrypt(@GraphQLName("value") @GraphQLNonNull String value) {
        return audited("encrypt", null, () -> service.encrypt(value));
    }

    @GraphQLField
    @GraphQLDescription("Decrypt a value, which must occur in the named file")
    public String decrypt(@GraphQLName("name") @GraphQLNonNull String name,
                          @GraphQLName("value") @GraphQLNonNull String value) {
        // File-bound on purpose: the service checks both that the caller may read the file and that
        // the value is really in it. Without that, this would decrypt anything and be an oracle.
        return audited("decrypt", name, () -> service.decryptForFile(name, value, caller.isRoot()));
    }

    @GraphQLField
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
