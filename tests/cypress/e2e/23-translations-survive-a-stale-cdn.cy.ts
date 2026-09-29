import {cleanupFiles} from './osgiTestUtils';

/**
 * Jahia fetches the translations from /modules/osgi-configurations-manager/javascript/locales/<lng>.json,
 * the same URL in every version. After the 1.2.1 upgrade, the CDN in front of an instance kept serving
 * the 1.2.0 file to the new interface, whose new labels then showed as their keys
 * ("editor.button.showSecrets"). The interface now loads the translations built with it, so a stale
 * file changes nothing. This spec plays the stale CDN: the locale files come back without the keys
 * added since.
 */
const FILE = 'org.jahia.modules.e2e-stale-translations.cfg';

describe('OSGi Configurations Manager - Translations survive a stale CDN', () => {
    beforeEach(() => {
        cy.login();
        cleanupFiles([FILE]);
        cy.upsertOsgiFile(FILE, 'api.token = clear-value\n').its('status').should('eq', 200);
    });

    afterEach(() => {
        cleanupFiles([FILE]);
    });

    it('shows the labels of this version when the locale files served are those of an older one', () => {
        cy.intercept('GET', '**/osgi-configurations-manager/javascript/locales/*.json*', req => {
            req.continue(res => {
                const translations = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
                // What 1.2.0 shipped: no label for the secrets toggle.
                delete translations.editor.button.showSecrets;
                delete translations.editor.button.hideSecrets;
                delete translations.tooltip.showSecrets;
                res.send(translations);
            });
        }).as('staleLocale');

        cy.openOsgiConfigManager();
        cy.wait('@staleLocale');
        cy.openOsgiFile(FILE);
        cy.ensureRawCfgMode();

        cy.get('[data-cy="raw-editor-toggle-secrets"] button', {timeout: 30000})
            .should('not.contain.text', 'editor.button')
            .and('contain.text', '(1)');
    });
});
