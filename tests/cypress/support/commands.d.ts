declare namespace Cypress {
    interface Chainable {
        osgiRequest(options?: Partial<RequestOptions>): Chainable<Response<unknown>>;
        listOsgiFiles(): Chainable<Array<{name: string; enabled: boolean}>>;
        readOsgiFile(filename: string): Chainable<{
            data?: {
                rawContent?: string;
                properties?: unknown;
            };
            error?: string;
        }>;
        upsertOsgiFile(filename: string, rawContent?: string): Chainable<Response<unknown>>;
        cleanupOsgiFile(filename: string): Chainable<void>;
        openOsgiConfigManager(): Chainable<void>;
        filterOsgiFiles(searchTerm: string): Chainable<void>;
        openOsgiFile(filename: string): Chainable<void>;
        ensureVisualCfgMode(): Chainable<void>;
    }
}
