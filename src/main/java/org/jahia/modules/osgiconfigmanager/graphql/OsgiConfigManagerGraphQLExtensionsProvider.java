package org.jahia.modules.osgiconfigmanager.graphql;

import org.jahia.modules.graphql.provider.dxm.DXGraphQLExtensionsProvider;
import org.osgi.service.component.annotations.Component;

/**
 * Registers this bundle with the GraphQL provider. The provider scans only this component's
 * package (and below) for {@code @GraphQLTypeExtension} classes, so without it the annotations in
 * this package are never read and the schema silently lacks the module's fields.
 */
@Component(immediate = true)
public class OsgiConfigManagerGraphQLExtensionsProvider implements DXGraphQLExtensionsProvider {
}
