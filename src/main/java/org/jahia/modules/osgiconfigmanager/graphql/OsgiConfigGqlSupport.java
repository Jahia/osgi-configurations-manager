package org.jahia.modules.osgiconfigmanager.graphql;

import com.fasterxml.jackson.core.JsonProcessingException;
import graphql.schema.DataFetchingEnvironment;
import org.jahia.modules.graphql.provider.dxm.util.ContextUtil;
import org.jahia.modules.osgiconfigmanager.admin.ConfigAccessDeniedException;
import org.jahia.modules.osgiconfigmanager.admin.ConfigConflictException;
import org.jahia.modules.osgiconfigmanager.admin.ConfigNotFoundException;
import org.jahia.modules.osgiconfigmanager.admin.OsgiConfigService;
import org.jahia.osgi.BundleUtils;
import org.jahia.services.content.JCRSessionFactory;
import org.jahia.services.content.JCRSessionWrapper;
import org.jahia.services.usermanager.JahiaUser;
import org.jahia.services.usermanager.JahiaUserManagerService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.jcr.RepositoryException;
import javax.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Authorization, CSRF and error handling shared by the query and mutation namespaces.
 */
final class OsgiConfigGqlSupport {

    private static final Logger LOGGER = LoggerFactory.getLogger(OsgiConfigGqlSupport.class);

    static final String MANAGE_PERMISSION = "canManageOsgiConfigurations";
    static final String ADMIN_PERMISSION = "admin";
    static final String SYSTEM_SITE_PATH = "/sites/systemsite";

    private static final String CSRF_HEADER = "X-Requested-With";
    private static final String MEDIA_TYPE_JSON = "application/json";
    private static final String ACCESS_DENIED = "Access denied";
    private static final String GENERIC_ERROR_MESSAGE =
            "An internal error occurred while processing the request. See server logs for details.";

    // Absolute unix paths of >=2 segments (e.g. /opt/karaf/etc/x.cfg), whatever characters a segment
    // uses (non-ASCII included), and Windows paths (C:\...).
    private static final Pattern ABSOLUTE_PATH = Pattern.compile("(?:/[^/\\s\"'<>]+){2,}|[A-Za-z]:\\\\[^\\s\"]+");
    private static final Pattern CONTROL_CHARACTERS = Pattern.compile("\\p{Cntrl}");

    private OsgiConfigGqlSupport() {
    }

    /**
     * Establish who is calling and refuse anyone the old Action refused. The checks run on the
     * caller's own session: a system session answers true to every hasPermission call, which is
     * exactly how SEC-138 bypassed the Action, so one is refused outright.
     *
     * <p>Both of the Action's requirements are kept: {@code canManageOsgiConfigurations} on the
     * root node, and {@code admin} on systemsite, the resource the Action was bound to.</p>
     */
    static GqlCaller authorize(JCRSessionFactory factory, Locale locale) {
        JahiaUser user = factory.getCurrentUser();
        if (JahiaUserManagerService.isGuest(user)) {
            throw deny("anonymous caller", user);
        }
        try {
            JCRSessionWrapper session = factory.getCurrentUserSession();
            if (session.isSystem()) {
                throw deny("system session", user);
            }
            if (!session.getNode("/").hasPermission(MANAGE_PERMISSION)) {
                throw deny("missing " + MANAGE_PERMISSION, user);
            }
            if (!session.getNode(SYSTEM_SITE_PATH).hasPermission(ADMIN_PERMISSION)) {
                throw deny("missing " + ADMIN_PERMISSION + " on " + SYSTEM_SITE_PATH, user);
            }
            return new GqlCaller(user, session, locale != null ? locale : Locale.ENGLISH);
        } catch (OsgiConfigGqlException e) {
            throw e;
        } catch (RepositoryException | RuntimeException e) {
            // Fail closed: an error while checking access must never let the call through, nor
            // reach the client with its raw message.
            LOGGER.warn("[AUDIT] osgiConfigManager authorization failed for {}", user.getName(), e);
            throw new OsgiConfigGqlException(OsgiConfigGqlException.FORBIDDEN, ACCESS_DENIED);
        }
    }

    private static OsgiConfigGqlException deny(String reason, JahiaUser user) {
        LOGGER.warn("[AUDIT] Rejected osgiConfigManager GraphQL call (user={}): {}",
                user == null ? null : user.getName(), reason);
        return new OsgiConfigGqlException(OsgiConfigGqlException.FORBIDDEN, ACCESS_DENIED);
    }

    /**
     * /modules/graphql is not CSRF-safe on its own, so a mutation must look like a same-origin
     * fetch(): it must carry X-Requested-With, which a browser cannot add cross-origin without a
     * preflight that is never granted, and it must declare an application/json body. The media
     * type is compared on its parsed essence: "text/plain;application/json" is text/plain, a
     * CORS-simple type, and must not pass just because the header text contains the words.
     */
    static void requireCsrfSafe(HttpServletRequest request) {
        if (request == null) {
            LOGGER.warn("[AUDIT] Rejected osgiConfigManager mutation with no HTTP request");
            throw new OsgiConfigGqlException(OsgiConfigGqlException.FORBIDDEN, ACCESS_DENIED);
        }
        if (request.getHeader(CSRF_HEADER) == null) {
            LOGGER.warn("[AUDIT] Rejected osgiConfigManager mutation without {} header from {}",
                    CSRF_HEADER, request.getRemoteAddr());
            throw new OsgiConfigGqlException(OsgiConfigGqlException.FORBIDDEN,
                    "Missing required " + CSRF_HEADER + " header");
        }
        if (!isJsonMediaType(request.getContentType())) {
            LOGGER.warn("[AUDIT] Rejected osgiConfigManager mutation with non-JSON Content-Type '{}' from {}",
                    request.getContentType(), request.getRemoteAddr());
            throw new OsgiConfigGqlException(OsgiConfigGqlException.UNSUPPORTED_MEDIA_TYPE,
                    "Mutations require an " + MEDIA_TYPE_JSON + " body");
        }
    }

    private static boolean isJsonMediaType(String contentType) {
        if (contentType == null) {
            return false;
        }
        int paramIdx = contentType.indexOf(';');
        String essence = paramIdx >= 0 ? contentType.substring(0, paramIdx) : contentType;
        return MEDIA_TYPE_JSON.equals(essence.trim().toLowerCase(Locale.ROOT));
    }

    /**
     * Turn any failure into the one exception type the client may see. Controlled service errors
     * keep their reason, minus absolute paths; anything unexpected is logged and reported
     * generically, because its message may carry internal detail.
     */
    static OsgiConfigGqlException translate(Exception e) {
        if (e instanceof OsgiConfigGqlException) {
            return (OsgiConfigGqlException) e;
        }
        if (e instanceof ConfigNotFoundException) {
            return new OsgiConfigGqlException(OsgiConfigGqlException.NOT_FOUND, sanitizePath(e.getMessage()));
        }
        if (e instanceof ConfigConflictException) {
            return new OsgiConfigGqlException(OsgiConfigGqlException.CONFLICT, sanitizePath(e.getMessage()));
        }
        if (e instanceof ConfigAccessDeniedException) {
            LOGGER.warn("[AUDIT] Access denied: {}", e.getMessage());
            return new OsgiConfigGqlException(OsgiConfigGqlException.FORBIDDEN, sanitizePath(e.getMessage()));
        }
        if (e instanceof IOException && !(e instanceof JsonProcessingException)) {
            LOGGER.warn("[AUDIT] Request rejected: {}", e.getMessage());
            return new OsgiConfigGqlException(OsgiConfigGqlException.BAD_REQUEST, sanitizePath(e.getMessage()));
        }
        LOGGER.error("[AUDIT] Error in osgiConfigManager GraphQL API", e);
        return new OsgiConfigGqlException(OsgiConfigGqlException.INTERNAL, GENERIC_ERROR_MESSAGE);
    }

    /** Remove absolute filesystem paths from a client-bound message, preserving the reason text. */
    static String sanitizePath(String message) {
        if (message == null) {
            return GENERIC_ERROR_MESSAGE;
        }
        return ABSOLUTE_PATH.matcher(message).replaceAll("<path>");
    }

    /** The request behind a GraphQL call, or null when there is none (e.g. a websocket). */
    static HttpServletRequest request(DataFetchingEnvironment environment) {
        return ContextUtil.getHttpServletRequest(environment.getGraphQlContext());
    }

    static Locale locale(HttpServletRequest request) {
        return request != null ? request.getLocale() : null;
    }

    static OsgiConfigService service() {
        OsgiConfigService service = BundleUtils.getOsgiService(OsgiConfigService.class, null);
        if (service == null) {
            LOGGER.error("OsgiConfigService is not available");
            throw new OsgiConfigGqlException(OsgiConfigGqlException.INTERNAL, GENERIC_ERROR_MESSAGE);
        }
        return service;
    }

    /**
     * The file name and PID are the caller's own input, logged before the service validates them, so
     * a line break in one could forge a whole [AUDIT] line. Control characters are replaced.
     */
    static String auditValue(String value) {
        return value == null ? null : CONTROL_CHARACTERS.matcher(value).replaceAll("_");
    }

    static void audit(GqlCaller caller, String action, String filename) {
        LOGGER.info("[AUDIT] User: {} | Action: {} | File: {}", caller.getName(), action, auditValue(filename));
    }
}
