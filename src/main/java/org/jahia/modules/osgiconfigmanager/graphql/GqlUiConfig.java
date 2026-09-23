package org.jahia.modules.osgiconfigmanager.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;

import java.util.Map;

@GraphQLName("OsgiConfigUiConfig")
@GraphQLDescription("UI settings the module's own configuration exposes to the admin app")
public class GqlUiConfig {

    private final Map<String, Object> config;

    GqlUiConfig(Map<String, Object> config) {
        this.config = config;
    }

    @GraphQLField
    @GraphQLName("visualFormattingControlsEnabled")
    @GraphQLDescription("Whether the visual editor offers its formatting controls")
    public Boolean getVisualFormattingControlsEnabled() {
        return (Boolean) config.get("visualFormattingControlsEnabled");
    }
}
