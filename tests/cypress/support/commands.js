// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })
import 'cypress-wait-until';
import 'cypress-mailpit';

// Helpers down below are added for debugging purposes.
// They should be moved to @jahia/cypress helpers afterwards.

/**
 * Helper function to print cookie details in a structured format
 * @param {*} cookie - The cookie object to print
 * @returns {void}
 */
const printCookieValues = cookie => {
    const cookieType = cookie.expiry ? '🔒 Persistent' : '⏱️  Session';
    const expiryDate = cookie.expiry ? new Date(cookie.expiry * 1000).toISOString() : 'Session only';
    const daysUntilExpiry = cookie.expiry ? Math.round(((cookie.expiry * 1000) - Date.now()) / 1000 / 60 / 60 / 24) : null;

    cy.log('-'.repeat(60));
    cy.log(`Cookie: ${cookie.name}`);
    cy.log('-'.repeat(60));
    cy.log(`Type:       ${cookieType}`);
    cy.log(`Value:      ${cookie.value}`);
    cy.log(`Domain:     ${cookie.domain}`);
    cy.log(`Path:       ${cookie.path}`);
    cy.log(`Secure:     ${cookie.secure ? '✅ Yes' : '❌ No'}`);
    cy.log(`HttpOnly:   ${cookie.httpOnly ? '✅ Yes' : '❌ No'}`);
    cy.log(`SameSite:   ${cookie.sameSite || '(not set)'}`);

    if (cookie.expiry) {
        cy.log(`Expires:    ${expiryDate}`);
        cy.log(`Days left:  ${daysUntilExpiry} days`);
        cy.log(`Unix time:  ${cookie.expiry}`);
    } else {
        cy.log('Expires:    When browser closes (session cookie)');
    }
};

/**
 * Logs all cookies in a detailed format
 */
Cypress.Commands.add('logAllCookies', () => {
    cy.getCookies().then(cookies => {
        if (cookies.length === 0) {
            cy.log('No cookies found');
            cy.log('No cookies found');
            return;
        }

        cy.log('\n' + '='.repeat(60));
        cy.log(`COOKIES REPORT - Total: ${cookies.length}`);
        cy.log('='.repeat(60));

        const sessionCookies = cookies.filter(c => !c.expiry);
        const persistentCookies = cookies.filter(c => c.expiry);

        cy.log(`📊 Session Cookies: ${sessionCookies.length}`);
        cy.log(`📊 Persistent Cookies: ${persistentCookies.length}`);

        cookies.forEach(cookie => {
            printCookieValues(cookie);
        });
    });
});

/**
 * Logs a specific cookie by name in a detailed format
 * @param {string} cookieName - The name of the cookie to log
 * @returns {void}
 */
Cypress.Commands.add('logCookie', cookieName => {
    cy.getCookie(cookieName).then(cookie => {
        if (!cookie) {
            cy.log(`Cookie "${cookieName}" not found`);
            cy.log(`Cookie "${cookieName}" not found`);
            return;
        }

        printCookieValues(cookie);
    });
});

/**
 * Clears cookies based on their type (session or persistent)
 * @param {string} type - The type of cookies to clear ('session' or 'persistent')
 * @returns {void}
 */
Cypress.Commands.add('clearCookiesByType', (type = 'session') => {
    cy.getCookies().then(cookies => {
        let cookiesToClear = cookies.filter(cookie => type.toLowerCase() === 'session' ? !cookie.expiry : cookie.expiry);

        cy.log(`🗑️  Clearing ${cookiesToClear.length} ${type} cookie(s):`);
        cookiesToClear.forEach(cookie => {
            const info = cookie.expiry ? `expires ${new Date(cookie.expiry * 1000).toISOString()}` : 'session only';
            cy.log(`  - ${cookie.name} (${info})`);
            cy.clearCookie(cookie.name);
        });

        cy.log(`Cleared ${cookiesToClear.length} ${type} cookie(s)`);
    });
});

/**
 * Simulates closing the browser by clearing all storage and session cookies
 * @returns {void}
 */
Cypress.Commands.add('simulateBrowserClose', () => {
    cy.log('Simulating browser close...');

    // Clear all storage
    // cy.clearLocalStorage();
    cy.clearAllSessionStorage();

    // Clear session cookies only
    cy.clearCookiesByType('session');

    cy.log('Browser close simulated (storage + session cookies cleared)');
});

/**
 * Logs all session storage items in a structured format
 * @returns {void}
 */
Cypress.Commands.add('logSessionStorage', () => {
    cy.getAllSessionStorage().then(session => {
        cy.log(`sessionStorage: ${JSON.stringify(session)}`);
    });
});

/**
 * Logs all local storage items in a structured format
 * @returns {void}
 */
Cypress.Commands.add('logLocalStorage', () => {
    cy.getAllLocalStorage().then(local => {
        cy.log(`localStorage: ${JSON.stringify(local)}`);
    });
});

const OSGI_ACTION_PATH = '/cms/render/default/en/sites/systemsite.osgiConfigManager.do';
const OSGI_ADMIN_PATH = '/jahia/administration/osgi-configurations-manager';

/**
 * Low-level helper around the module action endpoint.
 * Keeping it in one place makes the spec easier to read and update.
 */
Cypress.Commands.add('osgiRequest', (options = {}) => {
    const {url, headers, ...requestOptions} = options;

    return cy.request({
        url: url || OSGI_ACTION_PATH,
        failOnStatusCode: false,
        ...requestOptions,
        // The action requires this custom header on state-changing requests (CSRF defense),
        // mirroring what the real UI sends. Callers can still override it.
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            ...(headers || {})
        }
    });
});

/**
 * Confirm the review-before-save diff modal that appears after a UI Save when content changed.
 */
Cypress.Commands.add('confirmDiffSave', () => {
    cy.get('[data-cy="diff-modal-confirm"]').should('be.visible').click();
});

/**
 * List files exposed by the OSGi configuration manager backend.
 */
Cypress.Commands.add('listOsgiFiles', () => {
    return cy.osgiRequest({method: 'GET'}).its('body.files');
});

/**
 * Read a single file from the backend API.
 */
Cypress.Commands.add('readOsgiFile', filename => {
    return cy.osgiRequest({
        method: 'GET',
        url: `${OSGI_ACTION_PATH}?filename=${encodeURIComponent(filename)}`
    }).its('body');
});

/**
 * Create or overwrite a test file directly through the backend API.
 * This keeps the setup deterministic and reserves the UI interactions for the behavior we want to validate.
 */
Cypress.Commands.add('upsertOsgiFile', (filename, rawContent = '') => {
    return cy.osgiRequest({
        method: 'POST',
        body: {
            action: 'create',
            filename
        }
    }).then(response => {
        if (![200, 400, 500].includes(response.status)) {
            throw new Error(`Unexpected status while creating ${filename}: ${response.status}`);
        }

        // "File already exists" is now reported as 400 (was 500); treat either as a benign re-create.
        if ([400, 500].includes(response.status) && !String(response.body?.error || '').includes('File already exists')) {
            throw new Error(`Unable to create ${filename}: ${response.body?.error || response.status}`);
        }

        return cy.osgiRequest({
            method: 'POST',
            body: {
                action: 'save',
                filename,
                rawContent
            }
        });
    });
});

/**
 * Delete both the enabled and disabled variants of a file.
 * Cleanup helpers should be tolerant so one failing test does not poison the next one.
 */
Cypress.Commands.add('cleanupOsgiFile', filename => {
    const candidates = [filename];
    if (filename.endsWith('.disabled')) {
        candidates.push(filename.replace(/\.disabled$/, ''));
    } else {
        candidates.push(`${filename}.disabled`);
    }

    return cy.wrap(candidates).each(candidate => {
        cy.osgiRequest({
            method: 'POST',
            body: {
                action: 'delete',
                filename: candidate
            }
        });
    });
});

/**
 * Cleanup multiple files in one call.
 * This keeps setup/teardown concise when specs manage several fixtures.
 */
Cypress.Commands.add('cleanupOsgiFiles', filenames => {
    return cy.wrap(filenames).each(filename => cy.cleanupOsgiFile(filename));
});

/**
 * Open the administration application through its canonical route.
 * Purpose: keep the test independent from translated labels and menu visibility rules.
 */
Cypress.Commands.add('openOsgiConfigManager', () => {
    cy.visit(OSGI_ADMIN_PATH, {failOnStatusCode: false});

    cy.get('[data-cy="osgi-config-manager"]', {timeout: 60000}).should('be.visible');
});

/**
 * Narrow the sidebar to a single file to keep the spec readable and avoid accidental clicks.
 */
Cypress.Commands.add('filterOsgiFiles', searchTerm => {
    cy.get('[data-cy="file-search-input"] input', {timeout: 30000})
        .clear()
        .type(searchTerm);
});

/**
 * Select a file from the sidebar after filtering it.
 */
Cypress.Commands.add('openOsgiFile', filename => {
    cy.filterOsgiFiles(filename);
    cy.contains('[data-cy^="file-row-"]', filename, {timeout: 30000}).click();
    cy.get('[data-cy="selected-file-name"]', {timeout: 30000}).should('contain', filename);
});

/**
 * Switch the CFG editor to visual mode when needed.
 */
Cypress.Commands.add('ensureVisualCfgMode', () => {
    cy.get('[data-cy="editor-mode-toggle"]', {timeout: 30000}).then($toggle => {
        if ($toggle.attr('data-mode') !== 'visual') {
            cy.wrap($toggle).find('[role="listbox"]').click();
            cy.contains('.moonstone-menuItem', 'Visual Edit', {timeout: 30000}).click({force: true});
        }
    });

    cy.get('[data-cy="editor-mode-toggle"]').should('have.attr', 'data-mode', 'visual');
});

/**
 * Switch the CFG editor to raw mode when needed.
 */
Cypress.Commands.add('ensureRawCfgMode', () => {
    cy.get('[data-cy="editor-mode-toggle"]', {timeout: 30000}).then($toggle => {
        if ($toggle.attr('data-mode') !== 'raw') {
            cy.wrap($toggle).find('[role="listbox"]').click();
            cy.contains('.moonstone-menuItem', 'Raw Edit', {timeout: 30000}).click({force: true});
        }
    });

    cy.get('[data-cy="editor-mode-toggle"]').should('have.attr', 'data-mode', 'raw');
});

/**
 * Open the create configuration dialog and wait for it to be ready.
 */
Cypress.Commands.add('openCreateConfigDialog', () => {
    cy.get('[data-cy="create-file-button"] button', {timeout: 30000}).click();
    cy.get('[data-cy="modal-dialog"]', {timeout: 30000}).should('be.visible');
});

/**
 * Confirm the currently opened modal.
 */
Cypress.Commands.add('confirmModal', () => {
    cy.get('[data-cy="modal-confirm-button"] button', {timeout: 30000}).click();
});

/**
 * Cancel the currently opened modal.
 */
Cypress.Commands.add('cancelModal', () => {
    cy.get('[data-cy="modal-cancel-button"] button', {timeout: 30000}).click();
});

/**
 * Create a new configuration through the manual tab of the dialog.
 */
Cypress.Commands.add('createManualOsgiFile', filename => {
    cy.openCreateConfigDialog();
    cy.get('[data-cy="modal-create-manual-input"]', {timeout: 30000}).clear().type(filename);
    cy.confirmModal();
    cy.get('[data-cy="selected-file-name"]', {timeout: 30000}).should('contain', filename);
});

/**
 * Assert the standard toast feedback emitted by the application.
 */
Cypress.Commands.add('assertToastContains', message => {
    cy.get('[data-cy="toast-message"]', {timeout: 30000}).should('contain', message);
});

/**
 * Fetch the metatype catalog exposed by the backend.
 */
Cypress.Commands.add('getAvailableMetatypes', () => {
    return cy.osgiRequest({
        method: 'GET',
        url: '/cms/render/default/en/sites/systemsite.osgiConfigManager.do?action=availableMetatypes'
    }).its('body.metatypes');
});
