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
import javax.jcr.RepositoryException;
import java.io.BufferedReader;
import java.io.IOException;

/**
 * Action to interact with OsgiConfigService from React
 */
@Component(service = Action.class, immediate = true, property = "actionname=osgiConfigManager")
public class OsgiConfigAction extends Action {

    private static final Logger LOGGER = LoggerFactory.getLogger(OsgiConfigAction.class);
    private static final String PARAM_ACTION = "action";
    private static final String PARAM_FILENAME = "filename";
    private static final String KEY_PROPERTIES = "properties";
    private static final String KEY_STATUS = "status";
    private static final String KEY_VALUE = "value";
    private static final String KEY_RAW_CONTENT = "rawContent";
    private static final String KEY_ERROR = "error";
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

        try {
            Map<String, Object> result = new LinkedHashMap<>();
            if ("GET".equals(method)) {
                handleGet(req, renderContext, session, isRootUser, result);
            } else if ("POST".equals(method)) {
                Boolean handled = handlePost(req, renderContext, session, response, isRootUser, result);
                if (Boolean.FALSE.equals(handled)) {
                    return null;
                }
            }
            writeJson(response, HttpServletResponse.SC_OK, result);
            return null;
        } catch (Exception e) {
            LOGGER.error("Error in OsgiConfigAction", e);
            Map<String, String> error = new HashMap<>();
            error.put(KEY_ERROR, e.getMessage());
            writeError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, error);
            return null;
        }
    }

    private void handleGet(HttpServletRequest req, RenderContext renderContext, JCRSessionWrapper session,
            boolean isRootUser, Map<String, Object> result) throws IOException, RepositoryException {
        String filename = req.getParameter(PARAM_FILENAME);
        String action = req.getParameter(PARAM_ACTION);
        if (filename != null && !filename.isEmpty()) {
            LOGGER.debug("[AUDIT] User: {} | Action: read | File: {}", renderContext.getUser().getName(), filename);
            Map<String, Object> fileContent = configService.readFile(filename, req.getLocale(), isRootUser);
            result.put("data", fileContent);
        } else if ("availableMetatypes".equals(action)) {
            result.put("metatypes", configService.listAvailableMetatypeConfigurations(req.getLocale(), isRootUser));
        } else if ("getPreference".equals(action)) {
            handleGetPreference(req, renderContext, session, result);
        } else {
            handleListFiles(req, isRootUser, result);
        }
    }

    private void handleGetPreference(HttpServletRequest req, RenderContext renderContext, JCRSessionWrapper session,
            Map<String, Object> result) throws RepositoryException {
        String key = req.getParameter("key");
        String userPath = renderContext.getUser().getLocalPath();
        if (session.nodeExists(userPath)) {
            org.jahia.services.content.JCRNodeWrapper userNode = session.getNode(userPath);
            if (userNode.hasProperty(key)) {
                result.put(KEY_VALUE, userNode.getProperty(key).getString());
            }
        }
    }

    private void handleListFiles(HttpServletRequest req, boolean isRootUser, Map<String, Object> result) {
        result.put("uiConfig", configService.getUiConfig());
        List<Map<String, Object>> allFiles = configService.listFiles(isRootUser);
        String search = req.getParameter("search");
        if (search != null && !search.isEmpty()) {
            result.put("files", handleDeepSearch(req, isRootUser, allFiles, search));
        } else {
            result.put("files", allFiles);
        }
    }

    private List<Map<String, Object>> handleDeepSearch(HttpServletRequest req, boolean isRootUser,
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

    /**
     * @return Boolean.FALSE when the request has already been fully written (and the
     *         caller must return null without writing the result map), Boolean.TRUE otherwise.
     */
    private Boolean handlePost(HttpServletRequest req, RenderContext renderContext, JCRSessionWrapper session,
            HttpServletResponse response, boolean isRootUser, Map<String, Object> result) throws IOException, RepositoryException {
        Map<String, Object> payload = mapper.readValue(readRequestBody(req), Map.class);
        String actionType = (String) payload.get(PARAM_ACTION);
        String filename = (String) payload.get(PARAM_FILENAME);
        auditPostAction(renderContext, actionType, filename);

        if ("save".equals(actionType)) {
            handleSave(payload, filename, isRootUser, result);
        } else if ("toggle".equals(actionType)) {
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
            result.put("decryptedValue", configService.decrypt((String) payload.get(KEY_VALUE)));
        } else if ("setPreference".equals(actionType)) {
            handleSetPreference(payload, renderContext, session, result);
        } else {
            Map<String, String> error = new HashMap<>();
            error.put(KEY_ERROR, "Unknown action");
            writeError(response, HttpServletResponse.SC_BAD_REQUEST, error);
            return Boolean.FALSE;
        }
        return Boolean.TRUE;
    }

    private void auditPostAction(RenderContext renderContext, String actionType, String filename) {
        if ("save".equals(actionType) || "toggle".equals(actionType) || "delete".equals(actionType)
                || "markAsDefault".equals(actionType)
                || "create".equals(actionType) || "createFromMetatype".equals(actionType)) {
            LOGGER.info("[AUDIT] User: {} | Action: {} | File: {}", renderContext.getUser().getName(),
                    actionType, filename);
        } else {
            LOGGER.info("Received action: {} for filename: {}", actionType, filename);
        }
    }

    private void handleSave(Map<String, Object> payload, String filename, boolean isRootUser,
            Map<String, Object> result) throws IOException {
        Map<String, Object> contentMap = new LinkedHashMap<>();
        if (payload.containsKey(KEY_PROPERTIES)) {
            contentMap.put(KEY_PROPERTIES, payload.get(KEY_PROPERTIES));
        }
        if (payload.containsKey(KEY_RAW_CONTENT)) {
            contentMap.put(KEY_RAW_CONTENT, payload.get(KEY_RAW_CONTENT));
        }
        configService.saveFile(filename, contentMap, isRootUser);
        result.put(KEY_STATUS, "saved");
    }

    private void handleCreateFromMetatype(HttpServletRequest req, Map<String, Object> payload, boolean isRootUser,
            Map<String, Object> result) throws IOException {
        String pid = (String) payload.get("pid");
        String instanceIdentifier = (String) payload.get("instanceIdentifier");
        String createdFilename = instanceIdentifier != null && !instanceIdentifier.trim().isEmpty()
                ? configService.createFactoryFileFromMetatype(pid, instanceIdentifier, req.getLocale(), isRootUser)
                : configService.createFileFromMetatype(pid, req.getLocale(), isRootUser);
        result.put(KEY_STATUS, STATUS_CREATED);
        result.put(PARAM_FILENAME, createdFilename);
    }

    private void handleSetPreference(Map<String, Object> payload, RenderContext renderContext,
            JCRSessionWrapper session, Map<String, Object> result) throws RepositoryException {
        String key = (String) payload.get("key");
        String value = (String) payload.get(KEY_VALUE);
        String userPath = renderContext.getUser().getLocalPath();
        if (session.nodeExists(userPath)) {
            org.jahia.services.content.JCRNodeWrapper userNode = session.getNode(userPath);
            userNode.setProperty(key, value);
            session.save();
            result.put(KEY_STATUS, "preferenceSaved");
        }
    }

    private String readRequestBody(HttpServletRequest req) throws java.io.IOException {
        StringBuilder buffer = new StringBuilder();
        try (BufferedReader reader = req.getReader()) {
            String line;
            while ((line = reader.readLine()) != null) {
                buffer.append(line);
            }
        }
        return buffer.toString();
    }

    private void writeJson(HttpServletResponse response, int status, Object body) throws java.io.IOException {
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.setStatus(status);
        mapper.writeValue(response.getWriter(), body);
        response.getWriter().flush();
    }

    private void writeError(HttpServletResponse response, int status, Map<String, String> error)
            throws java.io.IOException {
        response.setContentType("application/json");
        response.setStatus(status);
        mapper.writeValue(response.getWriter(), error);
    }
}
