describe('OSGi Configurations Manager - App shell', () => {
    beforeEach(() => {
        cy.login();
    });

    it('loads the administration application and its sidebar', () => {
        cy.openOsgiConfigManager();

        cy.get('[data-cy="file-search-input"] input').should('be.visible');
        cy.get('[data-cy^="file-row-"]')
            .its('length')
            .should('be.greaterThan', 0);
    });
});
