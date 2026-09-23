package org.jahia.modules.osgiconfigmanager.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;

import java.util.Map;

@GraphQLName("OsgiConfigFile")
@GraphQLDescription("A configuration file in karaf/etc")
public class GqlConfigFile {

    private final Map<String, Object> entry;

    GqlConfigFile(Map<String, Object> entry) {
        this.entry = entry;
    }

    @GraphQLField
    @GraphQLDescription("File name, including any .disabled suffix")
    public String getName() {
        return (String) entry.get("name");
    }

    @GraphQLField
    @GraphQLDescription("Absolute path of the file on the server")
    public String getPath() {
        return (String) entry.get("path");
    }

    @GraphQLField
    @GraphQLDescription("False when the file carries the .disabled suffix")
    public Boolean getEnabled() {
        return (Boolean) entry.get("enabled");
    }

    @GraphQLField
    @GraphQLDescription("cfg or yml")
    public String getType() {
        return (String) entry.get("type");
    }

    @GraphQLField
    @GraphQLDescription("MODULE, MODULE_DEFAULT or USER, read from the file's leading comment")
    public String getConfigState() {
        return (String) entry.get("configState");
    }
}
