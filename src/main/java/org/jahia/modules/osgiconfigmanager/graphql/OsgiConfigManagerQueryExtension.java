package org.jahia.modules.osgiconfigmanager.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;
import graphql.annotations.annotationTypes.GraphQLNonNull;
import graphql.annotations.annotationTypes.GraphQLTypeExtension;
import graphql.schema.DataFetchingEnvironment;
import org.jahia.modules.graphql.provider.dxm.DXGraphQLProvider;
import org.jahia.modules.graphql.provider.dxm.security.GraphQLRequiresPermission;
import org.jahia.services.content.JCRSessionFactory;

import javax.servlet.http.HttpServletRequest;

/**
 * Adds the single {@code Query.osgiConfigManager} namespace field. Authorization happens here,
 * once, so every nested query inherits it.
 */
@GraphQLTypeExtension(DXGraphQLProvider.Query.class)
@GraphQLDescription("OSGi Configurations Manager queries")
public class OsgiConfigManagerQueryExtension {

    private OsgiConfigManagerQueryExtension() {
    }

    @GraphQLField
    @GraphQLName("osgiConfigManager")
    @GraphQLNonNull
    @GraphQLRequiresPermission(OsgiConfigGqlSupport.MANAGE_PERMISSION)
    @GraphQLDescription("OSGi Configurations Manager query namespace")
    public static OsgiConfigManagerQuery osgiConfigManager(DataFetchingEnvironment environment) {
        HttpServletRequest request = OsgiConfigGqlSupport.request(environment);
        GqlCaller caller = OsgiConfigGqlSupport.authorize(JCRSessionFactory.getInstance(),
                OsgiConfigGqlSupport.locale(request));
        return new OsgiConfigManagerQuery(OsgiConfigGqlSupport.service(), caller);
    }
}
