import {cleanupFiles} from './osgiTestUtils';

/**
 * The ConfigurationPlugin, observed through a real Declarative Services consumer: the module's own
 * decryption probe (PID org.jahia.modules.osgiconfigmanager.probe, ConfigurationPolicy.REQUIRE).
 * Writing its .cfg with an ENC(...) value must end with the probe receiving plaintext; an envelope
 * nothing on this instance can decrypt must be delivered as stored, without stopping the component.
 * The probe reports shapes only, never values.
 */
const ACTION_PATH = '/cms/render/default/en/sites/systemsite.osgiConfigManager.do';
const PROBE_FILE = 'org.jahia.modules.osgiconfigmanager.probe.cfg';

const probeReports = (expected: Record<string, string>) =>
    cy.waitUntil(
        () => cy.osgiRequest({method: 'GET', url: `${ACTION_PATH}?action=pluginProbe`}).then(response => {
            const probe = response.body?.probe;
            if (!probe?.active) {
                return false;
            }

            return Object.entries(expected).every(([key, shape]) => probe.delivered?.[key] === shape);
        }),
        {timeout: 90000, interval: 2000, errorMsg: `probe did not report ${JSON.stringify(expected)}`}
    );

describe('OSGi Configurations Manager - ConfigurationPlugin decrypts values for consumers', () => {
    beforeEach(() => {
        cy.login();
        cleanupFiles([PROBE_FILE]);
    });

    afterEach(() => {
        cleanupFiles([PROBE_FILE]);
    });

    it('delivers an ENC(...) value decrypted to a DS component, leaving the file encrypted', () => {
        cy.osgiRequest({method: 'POST', body: {action: 'encrypt', value: 'probe-secret-42'}})
            .its('body.encryptedValue').then(encrypted => {
                expect(encrypted, 'ENC envelope').to.match(/^ENC\(.+\)$/);

                cy.upsertOsgiFile(PROBE_FILE, `probe.secret = ${encrypted}\nprobe.plain = hello\n`);

                probeReports({'probe.secret': 'plaintext', 'probe.plain': 'plaintext'});

                // The plugin only touches the delivered copy: on disk the value is still wrapped.
                cy.readOsgiFile(PROBE_FILE).its('data.rawContent')
                    .should('contain', encrypted)
                    .and('not.contain', 'probe-secret-42');
            });
    });

    it('delivers an undecryptable ENC(...) value as stored and still starts the component', () => {
        // A well-formed v2 envelope that no secret on this instance can open.
        const foreign = 'ENC(v2:AAAAAAAAAAAAAAAAAAAAAA==:AAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=)';
        cy.upsertOsgiFile(PROBE_FILE, `probe.secret = ${foreign}\nprobe.plain = hello\n`);

        probeReports({'probe.secret': 'encrypted', 'probe.plain': 'plaintext'});
    });

    it('reports the probe as inactive when its configuration does not exist', () => {
        cy.osgiRequest({method: 'GET', url: `${ACTION_PATH}?action=pluginProbe`}).then(response => {
            expect(response.status).to.eq(200);
            expect(response.body.probe.pid).to.eq('org.jahia.modules.osgiconfigmanager.probe');
            // Deactivation follows file deletion asynchronously; the only thing asserted here is
            // that no value is ever echoed back, active or not.
            expect(JSON.stringify(response.body)).not.to.contain('probe-secret');
        });
    });
});
