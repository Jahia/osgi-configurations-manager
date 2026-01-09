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

    private static final Logger logger = LoggerFactory.getLogger(OsgiConfigAction.class);
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

        HttpServletResponse response = renderContext.getResponse();

        String method = req.getMethod();
        Map<String, Object> result = new LinkedHashMap<>();

        try {
            if ("GET".equals(method)) {
                String filename = req.getParameter("filename");
                if (filename != null && !filename.isEmpty()) {
                    // Read specific file
                    Map<String, Object> fileContent = configService.readFile(filename);
                    result.put("data", fileContent);
                } else {
                    // List all files
                    List<Map<String, Object>> allFiles = configService.listFiles();
                    String search = req.getParameter("search");

                    if (search != null && !search.isEmpty()) {
                        logger.debug("Deep Search: Requested search for term '{}'", search);
                        String lowerSearch = search.toLowerCase();
                        List<Map<String, Object>> filteredFiles = new java.util.ArrayList<>();

                        for (Map<String, Object> file : allFiles) {
                            String name = (String) file.get("name");
                            try {
                                // For search, we need to read the content.
                                Map<String, Object> content = configService.readFile(name);
                                String raw = (String) content.get("rawContent");

                                boolean nameMatch = name.toLowerCase().contains(lowerSearch);
                                boolean contentMatch = raw != null && raw.toLowerCase().contains(lowerSearch);

                                if (contentMatch) {
                                    logger.debug("Deep Search: Match found in content of '{}'", name);
                                }

                                if (nameMatch || contentMatch) {
                                    filteredFiles.add(file);
                                }
                            } catch (Exception e) {
                                logger.warn("Deep Search: Failed to read file {} during search", name, e);
                            }
                        }
                        logger.debug("Deep Search: Found {} matching files", filteredFiles.size());
                        result.put("files", filteredFiles);
                    } else {
                        result.put("files", allFiles);
                    }
                }
            } else if ("POST".equals(method)) {
                StringBuilder buffer = new StringBuilder();
                try (BufferedReader reader = req.getReader()) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        buffer.append(line);
                    }
                }
                Map<String, Object> payload = mapper.readValue(buffer.toString(), Map.class);
                String actionType = (String) payload.get("action");
                String filename = (String) payload.get("filename");

                logger.info("Received action: {} for filename: {}", actionType, filename);

                if ("save".equals(actionType)) {
                    Map<String, Object> contentMap = new LinkedHashMap<>();
                    // Convert JSON payload to Map structure
                    if (payload.containsKey("properties")) {
                        contentMap.put("properties", payload.get("properties"));
                    }
                    if (payload.containsKey("rawContent")) {
                        contentMap.put("rawContent", payload.get("rawContent"));
                    }
                    configService.saveFile(filename, contentMap);
                    result.put("status", "saved");
                } else if ("toggle".equals(actionType)) { // Enable/Disable
                    configService.toggleFileStatus(filename);
                    result.put("status", "toggled");
                } else if ("delete".equals(actionType)) {
                    configService.deleteFile(filename);
                    result.put("status", "deleted");
                } else if ("create".equals(actionType)) {
                    configService.createFile(filename);
                    result.put("status", "created");
                } else if ("encrypt".equals(actionType)) {
                    String value = (String) payload.get("value");
                    result.put("encryptedValue", configService.encrypt(value));
                } else if ("decrypt".equals(actionType)) {
                    String value = (String) payload.get("value");
                    result.put("decryptedValue", configService.decrypt(value));
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
            logger.error("Error in OsgiConfigAction", e);
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            response.setContentType("application/json");
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            mapper.writeValue(response.getWriter(), error);
            return null;
        }
    }
}
