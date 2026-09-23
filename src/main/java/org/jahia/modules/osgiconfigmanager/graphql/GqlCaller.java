package org.jahia.modules.osgiconfigmanager.graphql;

import org.jahia.services.content.JCRSessionWrapper;
import org.jahia.services.usermanager.JahiaUser;

import java.util.Locale;

/**
 * An authorized caller, as established once by the namespace field and handed to every nested
 * operation. Only {@link OsgiConfigGqlSupport#authorize} creates one, so holding an instance means
 * the checks there have passed.
 */
final class GqlCaller {

    private final JahiaUser user;
    private final JCRSessionWrapper session;
    private final Locale locale;

    GqlCaller(JahiaUser user, JCRSessionWrapper session, Locale locale) {
        this.user = user;
        this.session = session;
        this.locale = locale;
    }

    JahiaUser getUser() {
        return user;
    }

    /** The caller's own JCR session, never a system one. */
    JCRSessionWrapper getSession() {
        return session;
    }

    Locale getLocale() {
        return locale;
    }

    String getName() {
        return user.getName();
    }

    /** Root alone may see and edit the module's own self-configuration PID. */
    boolean isRoot() {
        return "root".equals(user.getName());
    }
}
