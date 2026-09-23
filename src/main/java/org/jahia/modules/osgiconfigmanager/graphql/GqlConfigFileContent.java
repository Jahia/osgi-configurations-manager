package org.jahia.modules.osgiconfigmanager.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;

@GraphQLName("OsgiConfigFileContent")
@GraphQLDescription("The content of one configuration file")
public class GqlConfigFileContent {

    private final String configState;
    private final String rawContent;
    private final String pid;
    private final String properties;
    private final String metatype;

    GqlConfigFileContent(String configState, String rawContent, String pid, String properties, String metatype) {
        this.configState = configState;
        this.rawContent = rawContent;
        this.pid = pid;
        this.properties = properties;
        this.metatype = metatype;
    }

    @GraphQLField
    @GraphQLName("configState")
    @GraphQLDescription("MODULE, MODULE_DEFAULT or USER")
    public String getConfigState() {
        return configState;
    }

    @GraphQLField
    @GraphQLName("rawContent")
    @GraphQLDescription("The file exactly as it is on disk")
    public String getRawContent() {
        return rawContent;
    }

    @GraphQLField
    @GraphQLName("pid")
    @GraphQLDescription("The PID the file configures, when it can be derived")
    public String getPid() {
        return pid;
    }

    @GraphQLField
    @GraphQLName("properties")
    @GraphQLDescription("Parsed properties as a JSON object, in file order. YAML values may nest.")
    public String getProperties() {
        return properties;
    }

    @GraphQLField
    @GraphQLName("metatype")
    @GraphQLDescription("The PID's metatype definition as a JSON object, when one is registered")
    public String getMetatype() {
        return metatype;
    }
}
