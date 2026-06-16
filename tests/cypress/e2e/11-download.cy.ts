import {cleanupFiles} from './osgiTestUtils';

describe('OSGi Configurations Manager - Download', () => {
    const downloadFile = 'org.jahia.modules.e2e-download.cfg';

    beforeEach(() => {
        cy.login();
        cleanupFiles([downloadFile]);
    });

    afterEach(() => {
        cleanupFiles([downloadFile]);
    });

    it('downloads the raw content of the selected file', () => {
        // Arrange
        cy.upsertOsgiFile(downloadFile, 'download.key = download value\n');
        cy.openOsgiConfigManager();
        cy.openOsgiFile(downloadFile);

        // The download is a pure client-side Blob + object-URL + synthetic anchor click (no toast,
        // no network round-trip). We stub URL.createObjectURL so we can assert the file was actually
        // serialized to a downloadable Blob without depending on the browser's download sandbox.
        cy.window().then(win => {
            cy.stub(win.URL, 'createObjectURL').returns('blob:stub-download').as('createObjectURL');
        });

        // Act
        cy.get('[data-cy="download-file-button"] button', {timeout: 30000})
            .should('not.be.disabled')
            .click();

        // Assert: a Blob was created from the file content for download.
        cy.get('@createObjectURL').should('have.been.calledOnce');
        cy.get('@createObjectURL').its('firstCall.args.0').should('be.instanceOf', Blob);
    });
});
