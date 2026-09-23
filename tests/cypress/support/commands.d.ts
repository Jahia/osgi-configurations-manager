declare namespace Cypress {
    /** The raw body /modules/graphql answers with. */
    interface GraphQLBody {
        data?: {osgiConfigManager?: Record<string, unknown> | null} | null;
        errors?: Array<{message: string; extensions?: {code?: string}}>;
    }

    /** A GraphQL answer flattened to the osgiConfigManager namespace data and its first error. */
    interface OsgiGqlResult {
        status: number;
        data: Record<string, unknown> | null;
        error: string | null;
        code: string | null;
    }

    interface Chainable {
        osgiGql(query: string, variables?: Record<string, unknown>, options?: Partial<RequestOptions>): Chainable<Response<GraphQLBody>>;
        osgiQuery(fields: string, params?: string, variables?: Record<string, unknown>, options?: Partial<RequestOptions>): Chainable<OsgiGqlResult>;
        osgiMutation(fields: string, params?: string, variables?: Record<string, unknown>, options?: Partial<RequestOptions>): Chainable<OsgiGqlResult>;
        listOsgiFiles(): Chainable<Array<{name: string; path: string; enabled: boolean}>>;
        readOsgiFile(filename: string): Chainable<{
            data?: {
                rawContent?: string;
                properties?: unknown;
            };
            error?: string;
            code?: string;
        }>;
        upsertOsgiFile(filename: string, rawContent?: string): Chainable<OsgiGqlResult>;
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
        confirmDiffSave(): Chainable<void>;
        getAvailableMetatypes(): Chainable<Array<{
            pid: string;
            filename: string;
            factory?: boolean;
            created?: boolean;
            properties: Array<{id: string}>;
        }>>;
    }
}
