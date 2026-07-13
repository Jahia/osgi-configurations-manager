/*
 * SUPPORT-646 / D5 — TEST-ONLY provisioning of the scoped users needed by the authorization
 * negatives (Cypress 08-authorization.cy.ts / 09-path-traversal.cy.ts, specs S22 / S48).
 *
 * This is NOT a product change. The module deliberately ships NO roles.xml (that binding is a
 * Stage-7 product decision); it ships only permissions.xml declaring `canManageOsgiConfigurations`.
 * Out of the box only root holds that permission, so no test could otherwise tell an authorized
 * user apart from an unauthorized one.
 *
 * It provisions:
 *   - osgi-authorized   : a server administrator who is ALSO granted a role carrying
 *                         `canManageOsgiConfigurations`  -> the tool must ACCEPT them.
 *   - osgi-plain-admin  : a server administrator WITHOUT that permission
 *                         -> passes the Action's required "admin" permission, but the in-code
 *                            `hasPermission("canManageOsgiConfigurations")` gate must REJECT them (403).
 *
 * Password for both: "password" (matches OSGI_SCOPED_PWD in the specs).
 *
 * ============================ STAGE-6 VERIFICATION REQUIRED ============================
 * The user-creation below uses stable Jahia APIs. The ROLE creation + permission grant could NOT
 * be validated in Stage 5 (no Docker / no running Jahia). Stage 6 MUST confirm that:
 *   (1) a role actually carrying `canManageOsgiConfigurations` exists, and
 *   (2) it is granted to osgi-authorized on "/" so that
 *       session.getNode("/").hasPermission("canManageOsgiConfigurations") == true for that user
 *       and == false for osgi-plain-admin.
 * If the Jahia role model differs from the attempt below, adjust HERE (test harness only) — do NOT
 * ship a roles.xml and do NOT weaken the Cypress assertions.
 * ======================================================================================
 */
import org.jahia.registries.ServicesRegistry
import org.jahia.services.content.JCRCallback
import org.jahia.services.content.JCRNodeWrapper
import org.jahia.services.content.JCRSessionWrapper
import org.jahia.services.content.JCRTemplate
import org.jahia.services.usermanager.JahiaUserManagerService

import javax.jcr.RepositoryException
import java.util.Properties

final String AUTHORIZED = "osgi-authorized"
final String NEGATIVE = "osgi-plain-admin"
final String PASSWORD = "password"
final String ROLE_NAME = "osgi-config-manager"
final String PERMISSION = "canManageOsgiConfigurations"
final String SERVER_ADMIN_ROLE = "server-administrator"

JahiaUserManagerService userManager = ServicesRegistry.getInstance().getJahiaUserManagerService()

// --- 1. users (stable API) ---
JCRTemplate.getInstance().doExecuteWithSystemSession({ JCRSessionWrapper session ->
    [AUTHORIZED, NEGATIVE].each { String name ->
        if (userManager.lookupUser(name, session) == null) {
            userManager.createUser(name, PASSWORD, new Properties(), session)
        }
    }
    session.save()
    return null
} as JCRCallback)

// --- 2. both users are server administrators (so both pass the Action's required "admin") ---
//     grant the built-in server-administrator role on "/" to both.
JCRTemplate.getInstance().doExecuteWithSystemSession({ JCRSessionWrapper session ->
    JCRNodeWrapper root = session.getNode("/")
    [AUTHORIZED, NEGATIVE].each { String name ->
        root.grantRoles("u:" + name, Collections.singleton(SERVER_ADMIN_ROLE))
    }
    session.save()
    return null
} as JCRCallback)

// --- 3. STAGE-6 VERIFY: a role carrying canManageOsgiConfigurations, granted only to AUTHORIZED ---
//     The precise role model (jnt:role node under /roles + j:permissionNames referencing the
//     permission node under /permissions) must be confirmed against the running instance.
try {
    JCRTemplate.getInstance().doExecuteWithSystemSession({ JCRSessionWrapper session ->
        JCRNodeWrapper roles = session.getNode("/roles")
        JCRNodeWrapper role = roles.hasNode(ROLE_NAME) ? roles.getNode(ROLE_NAME)
                : roles.addNode(ROLE_NAME, "jnt:role")
        // Attach the permission to the role. TODO(Stage-6): verify this is the correct binding
        // mechanism for this Jahia version (may need a jnt:externalPermissions child or
        // j:permissionNames weakreference to /permissions/.../canManageOsgiConfigurations).
        JCRNodeWrapper permNode = null
        session.getWorkspace().getQueryManager()
        // Best-effort: locate the permission node by name.
        def q = session.getWorkspace().getQueryManager().createQuery(
                "SELECT * FROM [jnt:permission] WHERE localname() = '" + PERMISSION + "'", "JCR-SQL2")
        def it = q.execute().getNodes()
        if (it.hasNext()) {
            permNode = (JCRNodeWrapper) it.nextNode()
            def existing = role.hasProperty("j:permissionNames") ?
                    role.getProperty("j:permissionNames").getValues().collect { it.getString() } : []
            if (!existing.contains(PERMISSION)) {
                existing.add(PERMISSION)
                role.setProperty("j:permissionNames", existing as String[])
            }
        }
        session.save()

        // grant the custom role to AUTHORIZED only, on "/"
        JCRNodeWrapper root = session.getNode("/")
        root.grantRoles("u:" + AUTHORIZED, Collections.singleton(ROLE_NAME))
        session.save()
        return null
    } as JCRCallback)
    log.info("[SUPPORT-646] scoped users provisioned (role grant attempted — Stage-6 to verify)")
} catch (Exception e) {
    log.warn("[SUPPORT-646] role/permission grant needs Stage-6 attention: " + e.getMessage(), e)
}
