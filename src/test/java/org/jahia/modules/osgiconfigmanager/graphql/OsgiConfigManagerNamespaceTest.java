package org.jahia.modules.osgiconfigmanager.graphql;

import graphql.GraphQLContext;
import graphql.annotations.annotationTypes.GraphQLName;
import graphql.annotations.annotationTypes.GraphQLTypeExtension;
import graphql.schema.DataFetchingEnvironment;
import org.jahia.modules.graphql.provider.dxm.DXGraphQLProvider;
import org.jahia.modules.graphql.provider.dxm.security.GraphQLRequiresPermission;
import org.jahia.modules.graphql.provider.dxm.util.ContextUtil;
import org.jahia.modules.osgiconfigmanager.admin.OsgiConfigService;
import org.jahia.osgi.BundleUtils;
import org.jahia.services.content.JCRNodeWrapper;
import org.jahia.services.content.JCRSessionFactory;
import org.jahia.services.content.JCRSessionWrapper;
import org.jahia.services.usermanager.JahiaUser;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;

import javax.servlet.http.HttpServletRequest;
import java.lang.reflect.Method;
import java.util.Locale;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * The two root fields are the only way into the API, so they carry every access decision: the
 * containers behind them trust the caller they are given.
 */
class OsgiConfigManagerNamespaceTest {

    private MockedStatic<ContextUtil> contextUtil;
    private MockedStatic<JCRSessionFactory> sessionFactoryStatic;
    private MockedStatic<BundleUtils> bundleUtils;
    private JCRSessionFactory factory;
    private HttpServletRequest request;
    private DataFetchingEnvironment env;
    private JCRNodeWrapper rootNode;

    @BeforeEach
    void setUp() throws Exception {
        env = mock(DataFetchingEnvironment.class);
        GraphQLContext context = GraphQLContext.newContext().build();
        lenient().when(env.getGraphQlContext()).thenReturn(context);
        request = mock(HttpServletRequest.class);
        lenient().when(request.getLocale()).thenReturn(Locale.ITALIAN);

        factory = mock(JCRSessionFactory.class);
        JahiaUser user = mock(JahiaUser.class);
        lenient().when(user.getName()).thenReturn("alice");
        JCRSessionWrapper session = mock(JCRSessionWrapper.class);
        rootNode = mock(JCRNodeWrapper.class);
        JCRNodeWrapper systemSite = mock(JCRNodeWrapper.class);
        lenient().when(factory.getCurrentUser()).thenReturn(user);
        lenient().when(factory.getCurrentUserSession()).thenReturn(session);
        lenient().when(session.getNode("/")).thenReturn(rootNode);
        lenient().when(session.getNode("/sites/systemsite")).thenReturn(systemSite);
        lenient().when(rootNode.hasPermission("canManageOsgiConfigurations")).thenReturn(true);
        lenient().when(systemSite.hasPermission("admin")).thenReturn(true);

        contextUtil = mockStatic(ContextUtil.class);
        contextUtil.when(() -> ContextUtil.getHttpServletRequest(any())).thenReturn(request);
        sessionFactoryStatic = mockStatic(JCRSessionFactory.class);
        sessionFactoryStatic.when(JCRSessionFactory::getInstance).thenReturn(factory);
        bundleUtils = mockStatic(BundleUtils.class);
        bundleUtils.when(() -> BundleUtils.getOsgiService(OsgiConfigService.class, null))
                .thenReturn(mock(OsgiConfigService.class));
    }

    @AfterEach
    void tearDown() {
        contextUtil.close();
        sessionFactoryStatic.close();
        bundleUtils.close();
    }

    private void jsonMutationRequest() {
        lenient().when(request.getHeader("X-Requested-With")).thenReturn("XMLHttpRequest");
        lenient().when(request.getContentType()).thenReturn("application/json");
    }

    @Test
    @DisplayName("the query namespace returns a container for an authorized caller")
    void query_authorized_returnsContainer() {
        assertNotNull(OsgiConfigManagerQueryExtension.osgiConfigManager(env));
    }

    @Test
    @DisplayName("the query namespace refuses an unauthorized caller")
    void query_unauthorized_isForbidden() {
        lenient().when(rootNode.hasPermission("canManageOsgiConfigurations")).thenReturn(false);

        OsgiConfigGqlException e = assertThrows(OsgiConfigGqlException.class,
                () -> OsgiConfigManagerQueryExtension.osgiConfigManager(env));
        assertEquals("FORBIDDEN", e.getExtensions().get("code"));
    }

    @Test
    @DisplayName("the mutation namespace returns a container for an authorized JSON request")
    void mutation_authorizedJson_returnsContainer() {
        jsonMutationRequest();

        assertNotNull(OsgiConfigManagerMutationExtension.osgiConfigManager(env));
    }

    @Test
    @DisplayName("the mutation namespace refuses a CSRF-shaped request before touching the repository")
    void mutation_formPost_isRefusedFirst() throws Exception {
        lenient().when(request.getHeader("X-Requested-With")).thenReturn("XMLHttpRequest");
        lenient().when(request.getContentType()).thenReturn("multipart/form-data; boundary=x");

        OsgiConfigGqlException e = assertThrows(OsgiConfigGqlException.class,
                () -> OsgiConfigManagerMutationExtension.osgiConfigManager(env));
        assertEquals("UNSUPPORTED_MEDIA_TYPE", e.getExtensions().get("code"));
        verify(factory, never()).getCurrentUserSession();
    }

    @Test
    @DisplayName("the mutation namespace still authorizes after the CSRF check")
    void mutation_unauthorized_isForbidden() {
        jsonMutationRequest();
        lenient().when(rootNode.hasPermission("canManageOsgiConfigurations")).thenReturn(false);

        OsgiConfigGqlException e = assertThrows(OsgiConfigGqlException.class,
                () -> OsgiConfigManagerMutationExtension.osgiConfigManager(env));
        assertEquals("FORBIDDEN", e.getExtensions().get("code"));
    }

    @Test
    @DisplayName("an unavailable service is reported as INTERNAL, not a null container")
    void query_serviceMissing_isInternal() {
        bundleUtils.when(() -> BundleUtils.getOsgiService(OsgiConfigService.class, null)).thenReturn(null);

        OsgiConfigGqlException e = assertThrows(OsgiConfigGqlException.class,
                () -> OsgiConfigManagerQueryExtension.osgiConfigManager(env));
        assertEquals("INTERNAL", e.getExtensions().get("code"));
    }

    @Test
    @DisplayName("every field names itself: the annotation library would turn setPreference() into 'preference'")
    void everyField_hasAnExplicitName() {
        for (Class<?> type : new Class<?>[]{OsgiConfigManagerQuery.class, OsgiConfigManagerMutation.class,
                GqlConfigFile.class, GqlUiConfig.class, GqlConfigFileContent.class}) {
            java.util.Arrays.stream(type.getMethods())
                    .filter(m -> m.getAnnotation(graphql.annotations.annotationTypes.GraphQLField.class) != null)
                    .forEach(m -> {
                        GraphQLName name = m.getAnnotation(GraphQLName.class);
                        assertNotNull(name, type.getSimpleName() + "." + m.getName() + " has no @GraphQLName");
                        String expected = m.getName().startsWith("get")
                                ? Character.toLowerCase(m.getName().charAt(3)) + m.getName().substring(4)
                                : m.getName();
                        assertEquals(expected, name.value(), type.getSimpleName() + "." + m.getName());
                    });
        }
    }

    @Test
    @DisplayName("both root fields live in ONE osgiConfigManager namespace, each declaring the permission")
    void rootFields_areOneNamespaceWithPermission() throws Exception {
        for (Class<?> extension : new Class<?>[]{OsgiConfigManagerQueryExtension.class,
                OsgiConfigManagerMutationExtension.class}) {
            Method field = extension.getMethod("osgiConfigManager", DataFetchingEnvironment.class);
            assertEquals("osgiConfigManager", field.getAnnotation(GraphQLName.class).value());
            assertEquals("canManageOsgiConfigurations", field.getAnnotation(GraphQLRequiresPermission.class).value());
            assertEquals(1, java.util.Arrays.stream(extension.getMethods())
                    .filter(m -> m.getAnnotation(graphql.annotations.annotationTypes.GraphQLField.class) != null)
                    .count(), extension.getSimpleName() + " must add exactly one root field");
        }
        assertEquals(DXGraphQLProvider.Query.class,
                OsgiConfigManagerQueryExtension.class.getAnnotation(GraphQLTypeExtension.class).value());
        assertEquals(DXGraphQLProvider.Mutation.class,
                OsgiConfigManagerMutationExtension.class.getAnnotation(GraphQLTypeExtension.class).value());
    }
}
