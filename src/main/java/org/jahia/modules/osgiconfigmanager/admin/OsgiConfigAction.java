package org.jahia.modules.osgiconfigmanager.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.jahia.bin.Action;
import org.jahia.bin.ActionResult;
import org.jahia.services.content.JCRNodeWrapper;
import org.jahia.services.content.JCRSessionWrapper;
import org.jahia.services.render.RenderContext;
import org.jahia.services.render.Resource;
import org.jahia.services.render.URLResolver;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.HashMap;
import java.util.Set;
import org.osgi.service.component.annotations.Activate;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Reference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import javax.jcr.RepositoryException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.IOException;

/**
 * Action to interact with {@link OsgiConfigService} from the React UI.
 *
 * <p>{@code doExecute} stays a thin router: it enforces authorization and the CSRF header, then
 * delegates to small per-concern handlers so each method stays simple and individually readable.
 */
@Component(service = Action.class, immediate = true, property = "actionname=osgiConfigManager")
public class OsgiConfigAction extends Action {

    private static final Logger LOGGER = LoggerFactory.getLogger(OsgiConfigAction.class);

    private static final String PARAM_ACTION = "action";
    private static final String PARAM_FILENAME = "filename";
    private static final String PARAM_VALUE = "value";
    private static final String PARAM_KEY = "key";
    private static final String PARAM_PID = "pid";
    private static final String PARAM_INSTANCE_IDENTIFIER = "instanceIdentifier";
    private static final String PARAM_RAW_CONTENT = "rawContent";
    private static final String PARAM_SEARCH = "search";
    private static final String KEY_PROPERTIES = "properties";
    private static final String KEY_STATUS = "status";
    private static final String KEY_DATA = "data";
    private static final String KEY_ERROR = "error";
    private static final String STATUS_CREATED = "created";

    private static final String ACTION_SAVE = "save";
    private static final String ACTION_TOGGLE = "toggle";
    private static final String ACTION_DELETE = "delete";
    private static final String ACTION_MARK_AS_DEFAULT = "markAsDefault";
    private static final String ACTION_CREATE = "create";
    private static final String ACTION_CREATE_FROM_METATYPE = "createFromMetatype";
    private static final String ACTION_ENCRYPT = "encrypt";
    private static final String ACTION_DECRYPT = "decrypt";
    private static final String ACTION_SET_PREFERENCE = "setPreference";
    private static final String ACTION_GET_PREFERENCE = "getPreference";
    private static final String ACTION_AVAILABLE_METATYPES = "availableMetatypes";

    private static final Set<String> AUDITED_FILE_ACTIONS = Set.of(
            ACTION_SAVE, ACTION_TOGGLE, ACTION_DELETE, ACTION_MARK_AS_DEFAULT, ACTION_CREATE, ACTION_CREATE_FROM_METATYPE);
    private static final Set<String> AUDITED_SENSITIVE_ACTIONS = Set.of(
            ACTION_ENCRYPT, ACTION_DECRYPT, ACTION_SET_PREFERENCE);

    // CSRF defense: state-changing requests must carry this custom header. Browsers cannot set a
    // non-safelisted header on a cross-origin request without a CORS preflight (which is not
    // granted), so a forged cross-site POST cannot include it. Same-origin fetch() sets it.
    private static final String CSRF_HEADER = "X-Requested-With";

    // Hard cap on the request body so a hostile/oversized POST is rejected before it is buffered
    // into the heap. Allows the 5 MiB content cap plus modest JSON/protocol overhead.
    private static final int MAX_REQUEST_BYTES = (5 * 1024 * 1024) + (64 * 1024);
    private static final int READ_CHUNK_CHARS = 8192;

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

    @Override
    public ActionResult doExecute(HttpServletRequest req, RenderContext renderContext, Resource resource,
            JCRSessionWrapper session, Map<String, List<String>> parameters, URLResolver urlResolver) throws Exception {

        if (!session.getNode("/").hasPermission("canManageOsgiConfigurations")) {
            return new ActionResult(HttpServletResponse.SC_FORBIDDEN);
        }

        HttpServletResponse response = renderContext.getResponse();
        boolean isRootUser = "root".equals(renderContext.getUser().getName());
        boolean isPost = "POST".equals(req.getMethod());

        try {
            if (isPost && req.getHeader(CSRF_HEADER) == null) {
                writeError(response, HttpServletResponse.SC_FORBIDDEN, "Missing required " + CSRF_HEADER + " header");
                return null;
            }

            Map<String, Object> result = isPost
                    ? handlePost(req, renderContext, session, isRootUser, response)
                    : handleGet(req, renderContext, session, isRootUser);

            if (result == null) {
                // A handler already wrote an error response.
                return null;
            }

            writeJson(response, result);
            return null;

        } catch (IOException e) {
            // Domain/validation errors (bad filename, already exists, access denied, ...) carry a
            // safe, user-facing message. Surface it as a 400 and log server-side.
            LOGGER.warn("Configuration operation rejected: {}", e.getMessage());
            writeError(response, HttpServletResponse.SC_BAD_REQUEST, e.getMessage());
            return null;
        } catch (Exception e) {
            // Unexpected failure: log the detail server-side, return a generic message to the client
            // so internal paths/state are never leaked.
            LOGGER.error("Unexpected error in OsgiConfigAction", e);
            writeError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "An internal error occurred");
            return null;
        }
    }

    // ------------------------------------------------------------------ GET

    private Map<String, Object> handleGet(HttpServletRequest req, RenderContext renderContext,
            JCRSessionWrapper session, boolean isRootUser) throws IOException, RepositoryException {
        Map<String, Object> result = new LinkedHashMap<>();
        String filename = req.getParameter(PARAM_FILENAME);
        String actionParam = req.getParameter(PARAM_ACTION);

        if (filename != null && !filename.isEmpty()) {
            LOGGER.debug("[AUDIT] User: {} | Action: read | File: {}", renderContext.getUser().getName(), filename);
            result.put(KEY_DATA, configService.readFile(filename, req.getLocale(), isRootUser));
        } else if (ACTION_AVAILABLE_METATYPES.equals(actionParam)) {
            result.put("metatypes", configService.listAvailableMetatypeConfigurations(req.getLocale(), isRootUser));
        } else if (ACTION_GET_PREFERENCE.equals(actionParam)) {
            readPreference(req, renderContext, session, result);
        } else {
            listFiles(req, isRootUser, result);
        }

        return result;
    }

    private void listFiles(HttpServletRequest req, boolean isRootUser, Map<String, Object> result) {
        result.put("uiConfig", configService.getUiConfig());
        List<Map<String, Object>> allFiles = configService.listFiles(isRootUser);
        String search = req.getParameter(PARAM_SEARCH);

        if (search != null && !search.isEmpty()) {
            result.put("files", searchFiles(allFiles, search, req.getLocale(), isRootUser));
        } else {
            result.put("files", allFiles);
        }
    }

    private List<Map<String, Object>> searchFiles(List<Map<String, Object>> allFiles, String search,
            Locale locale, boolean isRootUser) {
        String lowerSearch = search.toLowerCase(Locale.ROOT);
        List<Map<String, Object>> filtered = new ArrayList<>();

        for (Map<String, Object> file : allFiles) {
            String name = (String) file.get("name");
            try {
                Map<String, Object> content = configService.readFile(name, locale, isRootUser);
                String raw = (String) content.get(PARAM_RAW_CONTENT);
                boolean nameMatch = name.toLowerCase(Locale.ROOT).contains(lowerSearch);
                boolean contentMatch = raw != null && raw.toLowerCase(Locale.ROOT).contains(lowerSearch);
                if (nameMatch || contentMatch) {
                    filtered.add(file);
                }
            } catch (Exception e) {
                LOGGER.warn("Deep Search: Failed to read file {} during search", name, e);
            }
        }

        return filtered;
    }

    private void readPreference(HttpServletRequest req, RenderContext renderContext, JCRSessionWrapper session,
            Map<String, Object> result) throws RepositoryException {
        String key = req.getParameter(PARAM_KEY);
        if (!PreferenceKeys.isAllowed(key)) {
            return;
        }

        LOGGER.info("[AUDIT] User: {} | Action: getPreference | Key: {}", renderContext.getUser().getName(), key);
        String userPath = renderContext.getUser().getLocalPath();
        if (session.nodeExists(userPath)) {
            JCRNodeWrapper userNode = session.getNode(userPath);
            if (userNode.hasProperty(key)) {
                result.put(PARAM_VALUE, userNode.getProperty(key).getString());
            }
        }
    }

    // ----------------------------------------------------------------- POST

    private Map<String, Object> handlePost(HttpServletRequest req, RenderContext renderContext,
            JCRSessionWrapper session, boolean isRootUser, HttpServletResponse response) throws IOException, RepositoryException {
        Map<String, Object> payload = parseBody(req);
        String actionType = (String) payload.get(PARAM_ACTION);
        String filename = (String) payload.get(PARAM_FILENAME);
        auditPost(renderContext, actionType, filename);

        Map<String, Object> result = new LinkedHashMap<>();
        switch (actionType == null ? "" : actionType) {
            case ACTION_SAVE:
                configService.saveFile(filename, buildSaveContent(payload), isRootUser);
                result.put(KEY_STATUS, "saved");
                break;
            case ACTION_TOGGLE:
                configService.toggleFileStatus(filename, isRootUser);
                result.put(KEY_STATUS, "toggled");
                break;
            case ACTION_DELETE:
                configService.deleteFile(filename, isRootUser);
                result.put(KEY_STATUS, "deleted");
                break;
            case ACTION_MARK_AS_DEFAULT:
                configService.markAsDefaultConfiguration(filename, isRootUser);
                result.put(KEY_STATUS, "updated");
                break;
            case ACTION_CREATE:
                configService.createFile(filename, isRootUser);
                result.put(KEY_STATUS, STATUS_CREATED);
                break;
            case ACTION_CREATE_FROM_METATYPE:
                createFromMetatype(payload, req.getLocale(), isRootUser, result);
                break;
            case ACTION_ENCRYPT:
                result.put("encryptedValue", configService.encrypt((String) payload.get(PARAM_VALUE)));
                break;
            case ACTION_DECRYPT:
                result.put("decryptedValue",
                        configService.decryptForFile(filename, (String) payload.get(PARAM_VALUE), isRootUser));
                break;
            case ACTION_SET_PREFERENCE:
                if (!writePreference(payload, renderContext, session, result)) {
                    writeError(response, HttpServletResponse.SC_BAD_REQUEST, "Unsupported preference key");
                    return null;
                }
                break;
            default:
                writeError(response, HttpServletResponse.SC_BAD_REQUEST, "Unknown action");
                return null;
        }

        return result;
    }

    private Map<String, Object> buildSaveContent(Map<String, Object> payload) {
        Map<String, Object> contentMap = new LinkedHashMap<>();
        if (payload.containsKey(KEY_PROPERTIES)) {
            contentMap.put(KEY_PROPERTIES, payload.get(KEY_PROPERTIES));
        }
        if (payload.containsKey(PARAM_RAW_CONTENT)) {
            contentMap.put(PARAM_RAW_CONTENT, payload.get(PARAM_RAW_CONTENT));
        }
        return contentMap;
    }

    private void createFromMetatype(Map<String, Object> payload, Locale locale, boolean isRootUser,
            Map<String, Object> result) throws IOException {
        String pid = (String) payload.get(PARAM_PID);
        String instanceIdentifier = (String) payload.get(PARAM_INSTANCE_IDENTIFIER);
        String createdFilename = instanceIdentifier != null && !instanceIdentifier.trim().isEmpty()
                ? configService.createFactoryFileFromMetatype(pid, instanceIdentifier, locale, isRootUser)
                : configService.createFileFromMetatype(pid, locale, isRootUser);
        result.put(KEY_STATUS, STATUS_CREATED);
        result.put(PARAM_FILENAME, createdFilename);
    }

    /**
     * @return {@code false} when the preference key is not on the allowlist, so the caller can
     *         respond with a 400; {@code true} otherwise.
     */
    private boolean writePreference(Map<String, Object> payload, RenderContext renderContext,
            JCRSessionWrapper session, Map<String, Object> result) throws RepositoryException {
        String key = (String) payload.get(PARAM_KEY);
        if (!PreferenceKeys.isAllowed(key)) {
            return false;
        }

        String value = (String) payload.get(PARAM_VALUE);
        String userPath = renderContext.getUser().getLocalPath();
        if (session.nodeExists(userPath)) {
            JCRNodeWrapper userNode = session.getNode(userPath);
            userNode.setProperty(key, value);
            session.save();
            result.put(KEY_STATUS, "preferenceSaved");
        }
        return true;
    }

    private void auditPost(RenderContext renderContext, String actionType, String filename) {
        String user = renderContext.getUser().getName();
        if (AUDITED_FILE_ACTIONS.contains(actionType)) {
            LOGGER.info("[AUDIT] User: {} | Action: {} | File: {}", user, actionType, filename);
        } else if (AUDITED_SENSITIVE_ACTIONS.contains(actionType)) {
            // Audit sensitive actions, but never log the secret value being processed.
            LOGGER.info("[AUDIT] User: {} | Action: {}", user, actionType);
        } else {
            LOGGER.info("Received action: {} for filename: {}", actionType, filename);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseBody(HttpServletRequest req) throws IOException {
        // Reject obviously-oversized requests up front via the declared Content-Length...
        if (req.getContentLength() > MAX_REQUEST_BYTES) {
            throw new IOException("Request body exceeds the maximum allowed size");
        }
        // ...then enforce the same cap while streaming, since Content-Length may be absent or wrong.
        StringBuilder buffer = new StringBuilder();
        long total = 0;
        try (BufferedReader reader = req.getReader()) {
            char[] chunk = new char[READ_CHUNK_CHARS];
            int read;
            while ((read = reader.read(chunk)) != -1) {
                total += read;
                if (total > MAX_REQUEST_BYTES) {
                    throw new IOException("Request body exceeds the maximum allowed size");
                }
                buffer.append(chunk, 0, read);
            }
        }
        return mapper.readValue(buffer.toString(), Map.class);
    }

    private void writeJson(HttpServletResponse response, Map<String, Object> result) throws IOException {
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        mapper.writeValue(response.getWriter(), result);
        response.getWriter().flush();
    }

    private void writeError(HttpServletResponse response, int status, String message) throws IOException {
        Map<String, String> error = new HashMap<>();
        error.put(KEY_ERROR, message);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.setStatus(status);
        mapper.writeValue(response.getWriter(), error);
    }
}
