package org.jahia.modules.osgiconfigmanager.graphql;

import org.jahia.modules.graphql.provider.dxm.BaseGqlClientException;

import java.util.Collections;

/**
 * The only exception the GraphQL API lets reach the client. Its message is already sanitised and
 * {@code extensions.code} carries the outcome the HTTP status used to carry on the old Action.
 *
 * <p>Any other exception is rendered by the provider with its raw message, which for this module
 * means absolute server paths, so every failure is translated into this type first (see
 * {@link OsgiConfigGqlSupport#translate}).</p>
 */
public class OsgiConfigGqlException extends BaseGqlClientException {

    private static final long serialVersionUID = 1L;

    static final String FORBIDDEN = "FORBIDDEN";
    static final String NOT_FOUND = "NOT_FOUND";
    static final String CONFLICT = "CONFLICT";
    static final String BAD_REQUEST = "BAD_REQUEST";
    static final String UNSUPPORTED_MEDIA_TYPE = "UNSUPPORTED_MEDIA_TYPE";
    static final String INTERNAL = "INTERNAL";

    OsgiConfigGqlException(String code, String message) {
        super(message, null, Collections.singletonMap("code", code));
    }
}
