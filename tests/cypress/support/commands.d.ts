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
        cleanupOsgiFiles(filenames: string[]): Chainable<void>;
        openOsgiConfigManager(): Chainable<void>;
        filterOsgiFiles(searchTerm: string): Chainable<void>;
        openOsgiFile(filename: string): Chainable<void>;
        ensureVisualCfgMode(): Chainable<void>;
        ensureRawCfgMode(): Chainable<void>;
        openCreateConfigDialog(): Chainable<void>;
        confirmModal(): Chainable<void>;
        cancelModal(): Chainable<void>;
        createManualOsgiFile(filename: string): Chainable<void>;
        assertToastContains(message: string): Chainable<void>;
        getAvailableMetatypes(): Chainable<Array<{
            pid: string;
            filename: string;
            factory?: boolean;
            created?: boolean;
            properties: Array<{id: string}>;
        }>>;
    }
}
