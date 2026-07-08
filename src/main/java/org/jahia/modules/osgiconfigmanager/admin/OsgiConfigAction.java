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
                    // Read specific file
                    LOGGER.debug("[AUDIT] User: {} | Action: read | File: {}", renderContext.getUser().getName(),
                            filename);
                    Map<String, Object> fileContent = configService.readFile(filename, req.getLocale(), isRootUser);
                    result.put("data", fileContent);
                } else if ("availableMetatypes".equals(req.getParameter(PARAM_ACTION))) {
                    result.put("metatypes", configService.listAvailableMetatypeConfigurations(req.getLocale(), isRootUser));
                } else if ("getPreference".equals(req.getParameter(PARAM_ACTION))) {
                    String key = req.getParameter("key");
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
                // SEC-138: require an application/json Content-Type on state-changing POSTs. This turns a
                // cross-origin request into a non-"simple" CORS request (forcing a preflight the browser
                // blocks), defeating the forged-config-write CSRF that relied on a text/plain body. The SPA
                // already sends application/json, so this is transparent to the admin UI.
                final String contentType = req.getContentType();
                if (contentType == null || !contentType.toLowerCase(java.util.Locale.ROOT).contains("application/json")) {
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

                if ("save".equals(actionType) || "toggle".equals(actionType) || "delete".equals(actionType)
                        || "markAsDefault".equals(actionType)
                        || "create".equals(actionType) || "createFromMetatype".equals(actionType)) {
                    LOGGER.info("[AUDIT] User: {} | Action: {} | File: {}", renderContext.getUser().getName(),
                            actionType, filename);
                } else {
                    LOGGER.info("Received action: {} for filename: {}", actionType, filename);
                }

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

        } catch (Exception e) {
            LOGGER.error("Error in OsgiConfigAction", e);
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            response.setContentType("application/json");
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            mapper.writeValue(response.getWriter(), error);
            return null;
        }
    }
}
