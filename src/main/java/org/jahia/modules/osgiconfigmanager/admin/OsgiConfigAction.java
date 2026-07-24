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
                String filename = req.getParameter(PARAM_FILENAME);
                if (filename != null && !filename.isEmpty()) {
                    // Read specific file — attributed at INFO so reads (which can expose ENC values)
                    // are auditable in production, not only when DEBUG logging is enabled (SUPPORT-646).
                    LOGGER.info("[AUDIT] User: {} | Action: read | File: {}", renderContext.getUser().getName(),
                            filename);
                    Map<String, Object> fileContent = configService.readFile(filename, req.getLocale(), isRootUser);
                    result.put("data", fileContent);
                } else if ("availableMetatypes".equals(req.getParameter(PARAM_ACTION))) {
                    result.put("metatypes", configService.listAvailableMetatypeConfigurations(req.getLocale(), isRootUser));
                } else if ("getPreference".equals(req.getParameter(PARAM_ACTION))) {
                    String key = req.getParameter("key");
                    if (!isValidPreferenceKey(key)) {
                        return badRequest(response, "Invalid preference key");
                    }
                    String userPath = renderContext.getUser().getLocalPath();
                    if (session.nodeExists(userPath)) {
                        org.jahia.services.content.JCRNodeWrapper userNode = session.getNode(userPath);
                        if (userNode.hasProperty(key)) {
                            result.put("value", userNode.getProperty(key).getString());
                        }
                    }
                } else {
                    result.put("uiConfig", configService.getUiConfig());
                    // List all files
                    List<Map<String, Object>> allFiles = configService.listFiles(isRootUser);
                    String search = req.getParameter("search");

                    if (search != null && !search.isEmpty()) {
                        LOGGER.debug("Deep Search: Requested search for term '{}'", search);
                        String lowerSearch = search.toLowerCase();
                        List<Map<String, Object>> filteredFiles = new java.util.ArrayList<>();

                        for (Map<String, Object> file : allFiles) {
                            String name = (String) file.get("name");
                            try {
                                // For search, we need to read the content.
                                Map<String, Object> content = configService.readFile(name, req.getLocale(), isRootUser);
                                String raw = (String) content.get("rawContent");

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
                        result.put("files", filteredFiles);
                    } else {
                        result.put("files", allFiles);
                    }
                }
            } else if ("POST".equals(method)) {
                // State-changing POSTs must declare an application/json body — the media type the admin
                // SPA sends. Compare the PARSED media type (the essence before any ';' parameters such as
                // charset), not a substring of the raw header: a value like "text/plain;application/json"
                // is media type text/plain and must be rejected even though the header text contains
                // "application/json". Only an exact application/json essence is accepted.
                final String contentType = req.getContentType();
                final String mediaType = (contentType == null) ? null
                        : contentType.split(";", 2)[0].trim().toLowerCase(java.util.Locale.ROOT);
                if (!"application/json".equals(mediaType)) {
                    LOGGER.warn("[AUDIT] Rejected osgiConfigManager POST with non-JSON Content-Type '{}' from {}",
                            contentType, req.getRemoteAddr());
                    return new ActionResult(HttpServletResponse.SC_UNSUPPORTED_MEDIA_TYPE);
                }
                StringBuilder buffer = new StringBuilder();
                try (BufferedReader reader = req.getReader()) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        buffer.append(line);
                    }
                }
                Map<String, Object> payload = mapper.readValue(buffer.toString(), Map.class);
                String actionType = (String) payload.get(PARAM_ACTION);
                String filename = (String) payload.get(PARAM_FILENAME);

                // SUPPORT-646: attribute EVERY state-changing / secret-touching action (including
                // encrypt/decrypt/setPreference) with the caller identity and the [AUDIT] tag.
                LOGGER.info("[AUDIT] User: {} | Action: {} | File: {}", renderContext.getUser().getName(),
                        actionType, filename);

                if ("save".equals(actionType)) {
                    Map<String, Object> contentMap = new LinkedHashMap<>();
                    // Convert JSON payload to Map structure
                    if (payload.containsKey(KEY_PROPERTIES)) {
                        contentMap.put(KEY_PROPERTIES, payload.get(KEY_PROPERTIES));
                    }
                    if (payload.containsKey("rawContent")) {
                        contentMap.put("rawContent", payload.get("rawContent"));
                    }
                    configService.saveFile(filename, contentMap, isRootUser);
                    result.put("status", "saved");
                } else if ("toggle".equals(actionType)) { // Enable/Disable
                    configService.toggleFileStatus(filename, isRootUser);
                    result.put("status", "toggled");
                } else if ("delete".equals(actionType)) {
                    configService.deleteFile(filename, isRootUser);
                    result.put("status", "deleted");
                } else if ("markAsDefault".equals(actionType)) {
                    configService.markAsDefaultConfiguration(filename, isRootUser);
                    result.put("status", "updated");
                } else if ("create".equals(actionType)) {
                    configService.createFile(filename, isRootUser);
                    result.put("status", STATUS_CREATED);
                } else if ("createFromMetatype".equals(actionType)) {
                    String pid = (String) payload.get("pid");
                    String instanceIdentifier = (String) payload.get("instanceIdentifier");
                    String createdFilename = instanceIdentifier != null && !instanceIdentifier.trim().isEmpty()
                            ? configService.createFactoryFileFromMetatype(pid, instanceIdentifier, req.getLocale(), isRootUser)
                            : configService.createFileFromMetatype(pid, req.getLocale(), isRootUser);
                    result.put("status", STATUS_CREATED);
                    result.put(PARAM_FILENAME, createdFilename);
                } else if ("encrypt".equals(actionType)) {
                    String value = (String) payload.get("value");
                    result.put("encryptedValue", configService.encrypt(value));
                } else if ("decrypt".equals(actionType)) {
                    String value = (String) payload.get("value");
                    result.put("decryptedValue", configService.decrypt(value));
                } else if ("setPreference".equals(actionType)) {
                    String key = (String) payload.get("key");
                    String value = (String) payload.get("value");
                    if (!isValidPreferenceKey(key)) {
                        return badRequest(response, "Invalid preference key");
                    }
                    String userPath = renderContext.getUser().getLocalPath();
                    if (session.nodeExists(userPath)) {
                        org.jahia.services.content.JCRNodeWrapper userNode = session.getNode(userPath);
                        userNode.setProperty(key, value);
                        session.save();
                        result.put("status", "preferenceSaved");
                    }
                } else {
                    Map<String, String> error = new HashMap<>();
                    error.put("error", "Unknown action");
                    response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                    mapper.writeValue(response.getWriter(), error);
                    return null;
                }
            }

            // Write response manually using Jackson to preserve order
            response.setContentType("application/json");
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

    private static final String PREFERENCE_KEY_PATTERN = "^[A-Za-z][A-Za-z0-9_.]*$";

    /**
     * A preference key is written verbatim as a JCR property on the caller's own node, so it must
     * be a plain, un-namespaced identifier. Rejecting anything containing a namespace separator
     * (":") or other special characters prevents a client from setting internal/system properties
     * (e.g. {@code j:...}, {@code jcr:...}).
     */
    private boolean isValidPreferenceKey(String key) {
        return key != null && !key.isEmpty() && key.length() <= 100 && key.matches(PREFERENCE_KEY_PATTERN);
    }

    private ActionResult badRequest(HttpServletResponse response, String message) throws java.io.IOException {
        return writeError(response, HttpServletResponse.SC_BAD_REQUEST, message);
    }
}
