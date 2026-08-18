package org.jahia.modules.osgiconfigmanager.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.jahia.bin.Action;
import org.jahia.bin.ActionResult;
import org.jahia.services.content.JCRSessionWrapper;
import org.jahia.services.render.RenderContext;
import org.jahia.services.render.Resource;
import org.jahia.services.render.URLResolver;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import org.osgi.service.component.annotations.Activate;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Reference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.BufferedReader;

/**
 * Action to interact with OsgiConfigService from React
 */
@Component(service = Action.class, immediate = true, property = "actionname=osgiConfigManager")
public class OsgiConfigAction extends Action {

    private static final Logger LOGGER = LoggerFactory.getLogger(OsgiConfigAction.class);
    private static final String PARAM_ACTION = "action";
    private static final String PARAM_FILENAME = "filename";
    private static final String KEY_PROPERTIES = "properties";
    private static final String KEY_RAW_CONTENT = "rawContent";
    private static final String KEY_STATUS = "status";
    private static final String KEY_VALUE = "value";
    private static final String KEY_KEY = "key";
    private static final String KEY_FILES = "files";
    private static final String MEDIA_TYPE_JSON = "application/json";
    private static final String CSRF_HEADER = "X-Requested-With";
    private static final String STATUS_CREATED = "created";
    private static final String GENERIC_ERROR_MESSAGE =
            "An internal error occurred while processing the request. See server logs for details.";
    private OsgiConfigService configService;
    private final ObjectMapper mapper = new ObjectMapper();

    @Reference(service = OsgiConfigService.class)
    public void setConfigService(OsgiConfigService configService) {
        this.configService = configService;
    }

    @Activate
    public void activate() {
        setName("osgiConfigManager");
        setRequireAuthenticatedUser(true);
        setRequiredMethods("GET,POST");
        setRequiredPermission("admin");
    }

    /**
     * Returned by a handler that completed normally, meaning {@code doExecute} should serialise the
     * accumulated result map. Any other value (including {@code null}, which the error writers
     * return once they have written the body themselves) is propagated to the caller as-is.
     */
    private static final ActionResult CONTINUE = new ActionResult(HttpServletResponse.SC_OK);

    @Override
    public ActionResult doExecute(HttpServletRequest req, RenderContext renderContext, Resource resource,
            JCRSessionWrapper session, Map<String, List<String>> parameters, URLResolver urlResolver) throws Exception {

        if (!session.getNode("/").hasPermission("canManageOsgiConfigurations")) {
            return new ActionResult(HttpServletResponse.SC_FORBIDDEN);
        }

        HttpServletResponse response = renderContext.getResponse();
        boolean isRootUser = "root".equals(renderContext.getUser().getName());

        String method = req.getMethod();
        Map<String, Object> result = new LinkedHashMap<>();

        try {
            if ("GET".equals(method)) {
                ActionResult outcome = handleGet(req, renderContext, session, response, isRootUser, result);
                if (outcome != CONTINUE) {
                    return outcome;
                }
            } else if ("POST".equals(method)) {
                ActionResult outcome = handlePost(req, renderContext, session, response, isRootUser, result);
                if (outcome != CONTINUE) {
                    return outcome;
                }
            }

            // Write response manually using Jackson to preserve order
            response.setContentType(MEDIA_TYPE_JSON);
            response.setCharacterEncoding("UTF-8");
            mapper.writeValue(response.getWriter(), result);
            response.getWriter().flush();
            return null;

        } catch (java.io.IOException e) {
            // Controlled service error (validation / authorization / not-found). Keep the actionable
            // reason but strip any absolute filesystem path so server internals are not leaked.
            LOGGER.warn("[AUDIT] Request rejected (action={}): {}", req.getParameter(PARAM_ACTION), e.getMessage());
            return writeError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, sanitizePath(e.getMessage()));
        } catch (Exception e) {
            // SUPPORT-646: any OTHER (unexpected) exception may carry internal detail / filesystem
            // paths / stack context — log it server-side but return only a generic message.
            LOGGER.error("[AUDIT] Error in OsgiConfigAction (action={}, method={})",
                    req.getParameter(PARAM_ACTION), method, e);
            return writeError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, GENERIC_ERROR_MESSAGE);
        }
    }

    // ---- GET ----

    private ActionResult handleGet(HttpServletRequest req, RenderContext renderContext, JCRSessionWrapper session,
            HttpServletResponse response, boolean isRootUser, Map<String, Object> result) throws Exception {
        String filename = req.getParameter(PARAM_FILENAME);
        String action = req.getParameter(PARAM_ACTION);

        if (filename != null && !filename.isEmpty()) {
            // Read specific file — attributed at INFO so reads (which can expose ENC values)
            // are auditable in production, not only when DEBUG logging is enabled (SUPPORT-646).
            LOGGER.info("[AUDIT] User: {} | Action: read | File: {}", renderContext.getUser().getName(), filename);
            result.put("data", configService.readFile(filename, req.getLocale(), isRootUser));
            return CONTINUE;
        }
        if ("availableMetatypes".equals(action)) {
            result.put("metatypes", configService.listAvailableMetatypeConfigurations(req.getLocale(), isRootUser));
            return CONTINUE;
        }
        if ("getPreference".equals(action)) {
            return handleGetPreference(req, renderContext, session, response, result);
        }
        return handleListFiles(req, isRootUser, result);
    }

    private ActionResult handleGetPreference(HttpServletRequest req, RenderContext renderContext,
            JCRSessionWrapper session, HttpServletResponse response, Map<String, Object> result) throws Exception {
        String key = req.getParameter(KEY_KEY);
        if (!PreferenceKeys.isAllowed(key)) {
            return badRequest(response, "Invalid preference key");
        }
        String userPath = renderContext.getUser().getLocalPath();
        if (session.nodeExists(userPath)) {
            org.jahia.services.content.JCRNodeWrapper userNode = session.getNode(userPath);
            if (userNode.hasProperty(key)) {
                result.put(KEY_VALUE, userNode.getProperty(key).getString());
            }
        }
        return CONTINUE;
    }

    private ActionResult handleListFiles(HttpServletRequest req, boolean isRootUser, Map<String, Object> result)
            throws Exception {
        result.put("uiConfig", configService.getUiConfig());
        List<Map<String, Object>> allFiles = configService.listFiles(isRootUser);
        String search = req.getParameter("search");

        if (search != null && !search.isEmpty()) {
            result.put(KEY_FILES, deepSearch(req, isRootUser, allFiles, search));
        } else {
            result.put(KEY_FILES, allFiles);
        }
        return CONTINUE;
    }

    /** Filter the listing on file NAME or file CONTENT, which requires reading each candidate. */
    private List<Map<String, Object>> deepSearch(HttpServletRequest req, boolean isRootUser,
            List<Map<String, Object>> allFiles, String search) {
        LOGGER.debug("Deep Search: Requested search for term '{}'", search);
        String lowerSearch = search.toLowerCase();
        List<Map<String, Object>> filteredFiles = new java.util.ArrayList<>();

        for (Map<String, Object> file : allFiles) {
            String name = (String) file.get("name");
            try {
                Map<String, Object> content = configService.readFile(name, req.getLocale(), isRootUser);
                String raw = (String) content.get(KEY_RAW_CONTENT);

                boolean nameMatch = name.toLowerCase().contains(lowerSearch);
                boolean contentMatch = raw != null && raw.toLowerCase().contains(lowerSearch);

                if (contentMatch) {
                    LOGGER.debug("Deep Search: Match found in content of '{}'", name);
                }
                if (nameMatch || contentMatch) {
                    filteredFiles.add(file);
                }
            } catch (Exception e) {
                LOGGER.warn("Deep Search: Failed to read file {} during search", name, e);
            }
        }
        LOGGER.debug("Deep Search: Found {} matching files", filteredFiles.size());
        return filteredFiles;
    }

    // ---- POST ----

    private ActionResult handlePost(HttpServletRequest req, RenderContext renderContext, JCRSessionWrapper session,
            HttpServletResponse response, boolean isRootUser, Map<String, Object> result) throws Exception {
        // CSRF defense in depth, alongside the application/json requirement below: browsers cannot
        // attach a non-safelisted header to a cross-origin request without a CORS preflight (which
        // is never granted), so a forged cross-site POST cannot carry it. Same-origin fetch() can.
        if (req.getHeader(CSRF_HEADER) == null) {
            LOGGER.warn("[AUDIT] Rejected osgiConfigManager POST without {} header from {}",
                    CSRF_HEADER, req.getRemoteAddr());
            return writeError(response, HttpServletResponse.SC_FORBIDDEN,
                    "Missing required " + CSRF_HEADER + " header");
        }

        if (!isJsonMediaType(req.getContentType())) {
            LOGGER.warn("[AUDIT] Rejected osgiConfigManager POST with non-JSON Content-Type '{}' from {}",
                    req.getContentType(), req.getRemoteAddr());
            return new ActionResult(HttpServletResponse.SC_UNSUPPORTED_MEDIA_TYPE);
        }

        Map<String, Object> payload = readJsonPayload(req);
        String actionType = (String) payload.get(PARAM_ACTION);
        String filename = (String) payload.get(PARAM_FILENAME);

        // SUPPORT-646: attribute EVERY state-changing / secret-touching action (including
        // encrypt/decrypt/setPreference) with the caller identity and the [AUDIT] tag.
        LOGGER.info("[AUDIT] User: {} | Action: {} | File: {}", renderContext.getUser().getName(),
                actionType, filename);

        return dispatchPostAction(actionType, payload, filename, req, renderContext, session, response,
                isRootUser, result);
    }

    /**
     * State-changing POSTs must declare an application/json body — the media type the admin SPA
     * sends. Compare the PARSED media type (the essence before any ';' parameters such as charset),
     * not a substring of the raw header: a value like "text/plain;application/json" is media type
     * text/plain and must be rejected even though the header text contains "application/json".
     */
    private static boolean isJsonMediaType(String contentType) {
        if (contentType == null) {
            return false;
        }
        final int paramIdx = contentType.indexOf(';');
        final String essence = (paramIdx >= 0) ? contentType.substring(0, paramIdx) : contentType;
        return MEDIA_TYPE_JSON.equals(essence.trim().toLowerCase(java.util.Locale.ROOT));
    }

    private Map<String, Object> readJsonPayload(HttpServletRequest req) throws java.io.IOException {
        StringBuilder buffer = new StringBuilder();
        try (BufferedReader reader = req.getReader()) {
            String line;
            while ((line = reader.readLine()) != null) {
                buffer.append(line);
            }
        }
        return mapper.readValue(buffer.toString(), Map.class);
    }

    private ActionResult dispatchPostAction(String actionType, Map<String, Object> payload, String filename,
            HttpServletRequest req, RenderContext renderContext, JCRSessionWrapper session,
            HttpServletResponse response, boolean isRootUser, Map<String, Object> result) throws Exception {
        if ("save".equals(actionType)) {
            configService.saveFile(filename, toContentMap(payload), isRootUser);
            result.put(KEY_STATUS, "saved");
        } else if ("toggle".equals(actionType)) { // Enable/Disable
            configService.toggleFileStatus(filename, isRootUser);
            result.put(KEY_STATUS, "toggled");
        } else if ("delete".equals(actionType)) {
            configService.deleteFile(filename, isRootUser);
            result.put(KEY_STATUS, "deleted");
        } else if ("markAsDefault".equals(actionType)) {
            configService.markAsDefaultConfiguration(filename, isRootUser);
            result.put(KEY_STATUS, "updated");
        } else if ("create".equals(actionType)) {
            configService.createFile(filename, isRootUser);
            result.put(KEY_STATUS, STATUS_CREATED);
        } else if ("createFromMetatype".equals(actionType)) {
            handleCreateFromMetatype(req, payload, isRootUser, result);
        } else if ("encrypt".equals(actionType)) {
            result.put("encryptedValue", configService.encrypt((String) payload.get(KEY_VALUE)));
        } else if ("decrypt".equals(actionType)) {
            // File-bound on purpose: the caller must name the file the ciphertext came from, and the
            // service checks both that they may read it and that the value is really in it. Without
            // that, this action decrypts anything and becomes an oracle.
            result.put("decryptedValue",
                    configService.decryptForFile(filename, (String) payload.get(KEY_VALUE), isRootUser));
        } else if ("setPreference".equals(actionType)) {
            return handleSetPreference(payload, renderContext, session, response, result);
        } else {
            return badRequest(response, "Unknown action");
        }
        return CONTINUE;
    }

    /** Keep only the content-bearing keys the service understands. */
    private Map<String, Object> toContentMap(Map<String, Object> payload) {
        Map<String, Object> contentMap = new LinkedHashMap<>();
        if (payload.containsKey(KEY_PROPERTIES)) {
            contentMap.put(KEY_PROPERTIES, payload.get(KEY_PROPERTIES));
        }
        if (payload.containsKey(KEY_RAW_CONTENT)) {
            contentMap.put(KEY_RAW_CONTENT, payload.get(KEY_RAW_CONTENT));
        }
        return contentMap;
    }

    private void handleCreateFromMetatype(HttpServletRequest req, Map<String, Object> payload, boolean isRootUser,
            Map<String, Object> result) throws Exception {
        String pid = (String) payload.get("pid");
        String instanceIdentifier = (String) payload.get("instanceIdentifier");
        String createdFilename = instanceIdentifier != null && !instanceIdentifier.trim().isEmpty()
                ? configService.createFactoryFileFromMetatype(pid, instanceIdentifier, req.getLocale(), isRootUser)
                : configService.createFileFromMetatype(pid, req.getLocale(), isRootUser);
        result.put(KEY_STATUS, STATUS_CREATED);
        result.put(PARAM_FILENAME, createdFilename);
    }

    private ActionResult handleSetPreference(Map<String, Object> payload, RenderContext renderContext,
            JCRSessionWrapper session, HttpServletResponse response, Map<String, Object> result) throws Exception {
        String key = (String) payload.get(KEY_KEY);
        String value = (String) payload.get(KEY_VALUE);
        if (!PreferenceKeys.isAllowed(key)) {
            return badRequest(response, "Invalid preference key");
        }
        String userPath = renderContext.getUser().getLocalPath();
        if (session.nodeExists(userPath)) {
            org.jahia.services.content.JCRNodeWrapper userNode = session.getNode(userPath);
            userNode.setProperty(key, value);
            session.save();
            result.put(KEY_STATUS, "preferenceSaved");
        }
        return CONTINUE;
    }

    // Absolute unix paths of >=2 segments (e.g. /opt/karaf/etc/x.cfg) and Windows paths (C:\...).
    private static final java.util.regex.Pattern ABSOLUTE_PATH =
            java.util.regex.Pattern.compile("(?:/[\\w.\\-]+){2,}|[A-Za-z]:\\\\[^\\s\"]+");

    /** Remove absolute filesystem paths from a client-bound message, preserving the reason text. */
    private String sanitizePath(String message) {
        if (message == null) {
            return GENERIC_ERROR_MESSAGE;
        }
        return ABSOLUTE_PATH.matcher(message).replaceAll("<path>");
    }

    private ActionResult writeError(HttpServletResponse response, int status, String message) throws java.io.IOException {
        Map<String, String> error = new HashMap<>();
        error.put("error", message);
        response.setContentType("application/json");
        response.setStatus(status);
        mapper.writeValue(response.getWriter(), error);
        return null;
    }

    private ActionResult badRequest(HttpServletResponse response, String message) throws java.io.IOException {
        return writeError(response, HttpServletResponse.SC_BAD_REQUEST, message);
    }
}
