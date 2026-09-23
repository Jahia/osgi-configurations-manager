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
 * Adds the single {@code Mutation.osgiConfigManager} namespace field. /modules/graphql is not
 * CSRF-safe by itself, so the request shape is checked first, then the caller is authorized, once,
 * for every nested mutation.
 */
@GraphQLTypeExtension(DXGraphQLProvider.Mutation.class)
@GraphQLDescription("OSGi Configurations Manager mutations")
public class OsgiConfigManagerMutationExtension {

    private OsgiConfigManagerMutationExtension() {
    }

    @GraphQLField
    @GraphQLName("osgiConfigManager")
    @GraphQLNonNull
    @GraphQLRequiresPermission(OsgiConfigGqlSupport.MANAGE_PERMISSION)
    @GraphQLDescription("OSGi Configurations Manager mutation namespace")
    public static OsgiConfigManagerMutation osgiConfigManager(DataFetchingEnvironment environment) {
        HttpServletRequest request = OsgiConfigGqlSupport.request(environment);
        OsgiConfigGqlSupport.requireCsrfSafe(request);
        GqlCaller caller = OsgiConfigGqlSupport.authorize(JCRSessionFactory.getInstance(),
                OsgiConfigGqlSupport.locale(request));
        return new OsgiConfigManagerMutation(OsgiConfigGqlSupport.service(), caller);
    }
}
