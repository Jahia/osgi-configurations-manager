import type { ContextJsParameters } from '@jahia/ui-extender';

// Sent on every GraphQL call. /modules/graphql is not CSRF-safe on its own, so the server refuses
// a mutation that lacks X-Requested-With or an application/json body: a browser cannot send either
// cross-origin without a CORS preflight, which is never granted.
const JSON_POST_HEADERS = { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' };

interface OsgiFile {
    name: string;
    configState?: 'MODULE' | 'MODULE_DEFAULT' | 'USER';
    [key: string]: any;
}

export interface OsgiMetatypeOption {
    label: string;
    value: string;
}

export interface OsgiMetatypeProperty {
    id: string;
    name?: string;
    description?: string;
    type?: string;
    cardinality?: number;
    optional?: boolean;
    defaultValues?: string[];
    options?: OsgiMetatypeOption[];
}

export interface OsgiMetatypeDefinition {
    pid: string;
    name?: string;
    description?: string;
    properties: OsgiMetatypeProperty[];
}

export interface OsgiAvailableMetatypeDefinition extends OsgiMetatypeDefinition {
    filename: string;
    bundleName?: string;
    bundleSymbolicName?: string;
    created?: boolean;
    factory?: boolean;
    instanceCount?: number;
    instances?: Array<{
        identifier: string;
        filename: string;
        enabled?: boolean;
        type?: string;
    }>;
}

interface OsgiFileData {
    rawContent?: string;
    properties?: any;
    pid?: string;
    metatype?: OsgiMetatypeDefinition;
    configState?: 'MODULE' | 'MODULE_DEFAULT' | 'USER';
}

export type OsgiUsageKind = 'BOUND' | 'COMPONENT' | 'MANAGED_SERVICE' | 'MANAGED_SERVICE_FACTORY' | 'METATYPE';

export interface OsgiBundleUsage {
    symbolicName: string;
    name: string;
    version: string;
    usages: Array<{
        kind: OsgiUsageKind;
        detail?: string | null;
        states: string[];
    }>;
}

/** What an export answers: the sealed archive (base64) and the files whose values stay encrypted in it. */
export interface OsgiArchiveExport {
    archive: string;
    fileName: string;
    files: number;
    warnings: { name: string; undecryptable: number }[];
}

export type OsgiVersionComparison = 'SAME' | 'OLDER' | 'NEWER' | 'DIFFERENT' | 'ABSENT' | 'UNKNOWN';

/** One bundle of a file, as recorded in the archive and found on this instance. */
export interface OsgiArchiveBundleComparison {
    symbolicName: string;
    name?: string | null;
    archiveVersion: string;
    targetVersion?: string;
    targetActive?: boolean;
    comparison: OsgiVersionComparison;
    otherVersions: string[];
}

export type OsgiArchiveRefusal = 'INVALID_NAME' | 'MANAGER_CONFIGURATION' | 'NOT_PERMITTED';

/** What importing one file of the archive would do here. */
export interface OsgiArchiveFilePreview {
    name: string;
    allowed: boolean;
    refusal?: OsgiArchiveRefusal;
    action?: 'CREATE' | 'OVERWRITE';
    sameConfiguration?: string[];
    secrets?: number;
    undecryptable?: number;
    /** USERS: the bundles that use it; METATYPE: none does, the one describing it; NONE: no bundle; UNKNOWN: not recorded. */
    reference?: 'USERS' | 'METATYPE' | 'NONE' | 'UNKNOWN';
    bundles?: OsgiArchiveBundleComparison[];
    unknownKeys?: string[];
    metatypeChecked?: boolean;
    clearSecrets?: string[];
}

export interface OsgiArchivePreview {
    exportedAt?: string | null;
    jahia: { archiveVersion?: string | null; targetVersion?: string | null; comparison: OsgiVersionComparison };
    files: OsgiArchiveFilePreview[];
}

export interface OsgiArchiveImportResult {
    imported: string[];
    failed: { name: string; error: string }[];
}

export interface OsgiUiConfig {
    visualFormattingControlsEnabled?: boolean;
}

interface OsgiServiceResponse {
    files?: OsgiFile[];
    data?: OsgiFileData;
    metatypes?: OsgiAvailableMetatypeDefinition[];
    uiConfig?: OsgiUiConfig;
    error?: string;
    encryptedValue?: string;
    decryptedValue?: string;
    status?: string;
    value?: string;
    filename?: string;
}

interface OsgiPayload {
    action: 'save' | 'delete' | 'create' | 'createFromMetatype' | 'toggle' | 'markAsDefault' | 'encrypt' | 'decrypt' | 'setPreference';
    filename?: string;
    pid?: string;
    instanceIdentifier?: string;
    value?: string;
    key?: string;
    properties?: any;
    rawContent?: string;
}

// @jahia/ui-extender declares window.contextJsParameters itself since 1.3.0. Restating it with a
// different shape is rejected outright — "TS2717: Subsequent property declarations must have the
// same type" — so this declares the SAME type by importing it, which TypeScript accepts.
//
// Dropping the block entirely does not work: the webpack build reads node_modules types and would
// be fine, but Jest's narrower TypeScript config does not pick up ui-extender's global .d.ts, and
// every suite that reaches this file fails with TS2339. Declaring it here satisfies both.
declare global {
    interface Window {
        contextJsParameters: ContextJsParameters;
    }
}

const graphqlUrl = (window.contextJsParameters ? window.contextJsParameters.contextPath : '') + '/modules/graphql';

type Variables = Record<string, unknown>;

/** An error the server reported, with the machine-readable code it carried in extensions.code. */
export class OsgiServiceError extends Error {
    code?: string;

    constructor(message: string, code?: string) {
        super(message);
        this.name = 'OsgiServiceError';
        this.code = code;
    }
}

// Every call, query or mutation, is a JSON POST carrying X-Requested-With: the server refuses a
// mutation without both, and sending the same headers on queries keeps one code path.
const request = async (query: string, variables: Variables = {}): Promise<any> => {
    const res = await fetch(graphqlUrl, {
        method: 'POST',
        headers: JSON_POST_HEADERS,
        body: JSON.stringify({ query, variables })
    });
    let body: any = null;
    try {
        body = await res.json();
    } catch {
        // Not a GraphQL answer at all (a proxy error page, for instance): fall through to the status.
    }
    const firstError = body?.errors?.[0];
    if (firstError) {
        throw new OsgiServiceError(firstError.message, firstError.extensions?.code);
    }
    if (!res.ok || !body?.data) {
        throw new OsgiServiceError(res.statusText || `HTTP ${res.status}`);
    }
    return body.data.osgiConfigManager;
};

const query = (fields: string, params = '', variables: Variables = {}) =>
    request(`query${params} { osgiConfigManager { ${fields} } }`, variables);

const mutation = (fields: string, params: string, variables: Variables) =>
    request(`mutation${params} { osgiConfigManager { ${fields} } }`, variables);

const parseJson = (value: string | null | undefined) => (value == null ? undefined : JSON.parse(value));

/** Drop the keys the server returned as null, as the old endpoint simply left them out. */
const withoutNulls = <T extends object>(value: T): T =>
    Object.fromEntries(Object.entries(value).filter(([, v]) => v !== null && v !== undefined)) as T;

const FILE_FIELDS = 'name path enabled type configState';

export const osgiService = {
    getAll: async (search: string = '', deep: boolean = false): Promise<OsgiServiceResponse> => {
        const result = deep && search
            ? await query(`files(search: $search) { ${FILE_FIELDS} } uiConfig { visualFormattingControlsEnabled }`,
                '($search: String)', { search })
            : await query(`files { ${FILE_FIELDS} } uiConfig { visualFormattingControlsEnabled }`);
        return { files: result.files, uiConfig: result.uiConfig };
    },

    /** The interface options alone, without the file list. */
    getUiConfig: async (): Promise<OsgiUiConfig | undefined> => {
        const { uiConfig } = await query('uiConfig { visualFormattingControlsEnabled }');
        return uiConfig;
    },

    read: async (filename: string): Promise<OsgiServiceResponse> => {
        const { file } = await query('file(name: $name) { configState rawContent pid properties metatype }',
            '($name: String!)', { name: filename });
        if (!file) {
            throw new OsgiServiceError(`File not found: ${filename}`, 'NOT_FOUND');
        }
        return {
            data: withoutNulls({
                ...file,
                properties: parseJson(file.properties),
                metatype: parseJson(file.metatype)
            })
        };
    },

    // Read-only: which bundles use the configuration of this file, behind the same access check as read.
    getBundleUsage: async (filename: string): Promise<OsgiBundleUsage[]> => {
        // A JSON string, not GraphQL types: the module's API scope names its types, and an upgrade
        // does not rewrite that file, so a new type would be refused on existing instances.
        const { bundleUsage } = await query('bundleUsage(name: $name)', '($name: String!)', { name: filename });
        return parseJson(bundleUsage) ?? [];
    },

    /** Seals the files into one archive with the password. The password never leaves this request. */
    exportArchive: async (names: string[], password: string): Promise<OsgiArchiveExport> => {
        const { exportArchive } = await mutation('exportArchive(names: $names, password: $password)',
            '($names: [String!]!, $password: String!)', { names, password });
        return parseJson(exportArchive);
    },

    /** What importing the archive would do here. Writes nothing. */
    previewArchiveImport: async (archive: string, password: string): Promise<OsgiArchivePreview> => {
        const { previewArchiveImport } = await mutation('previewArchiveImport(archive: $archive, password: $password)',
            '($archive: String!, $password: String!)', { archive, password });
        return parseJson(previewArchiveImport);
    },

    importArchive: async (archive: string, password: string, names: string[]): Promise<OsgiArchiveImportResult> => {
        const { importArchive } = await mutation('importArchive(archive: $archive, password: $password, names: $names)',
            '($archive: String!, $password: String!, $names: [String!]!)', { archive, password, names });
        return parseJson(importArchive);
    },

    getAvailableMetatypes: async (): Promise<OsgiServiceResponse> => {
        const { availableMetatypes } = await query('availableMetatypes');
        return { metatypes: parseJson(availableMetatypes) ?? [] };
    },

    save: async (payload: OsgiPayload): Promise<OsgiServiceResponse> => {
        await mutation('save(name: $name, rawContent: $rawContent)', '($name: String!, $rawContent: String!)',
            { name: payload.filename, rawContent: payload.rawContent });
        return { status: 'saved' };
    },

    toggle: async (filename: string): Promise<OsgiServiceResponse> => {
        await mutation('toggle(name: $name)', '($name: String!)', { name: filename });
        return { status: 'toggled' };
    },

    markAsDefault: async (filename: string): Promise<OsgiServiceResponse> => {
        await mutation('markAsDefault(name: $name)', '($name: String!)', { name: filename });
        return { status: 'updated' };
    },

    delete: async (filename: string): Promise<OsgiServiceResponse> => {
        await mutation('delete(name: $name)', '($name: String!)', { name: filename });
        return { status: 'deleted' };
    },

    create: async (filename: string): Promise<OsgiServiceResponse> => {
        await mutation('create(name: $name)', '($name: String!)', { name: filename });
        return { status: 'created' };
    },

    createFromMetatype: async (pid: string, instanceIdentifier?: string): Promise<OsgiServiceResponse> => {
        const result = await mutation('createFromMetatype(pid: $pid, instanceIdentifier: $instanceIdentifier)',
            '($pid: String!, $instanceIdentifier: String)', { pid, instanceIdentifier });
        return { status: 'created', filename: result.createFromMetatype };
    },

    // filename is required: the server only decrypts a value that really belongs to a file the
    // caller may read, so it cannot be used as a decryption oracle for ciphertext found elsewhere.
    decrypt: async (value: string, filename: string): Promise<OsgiServiceResponse> => {
        const result = await mutation('decrypt(name: $name, value: $value)', '($name: String!, $value: String!)',
            { value, name: filename });
        return { decryptedValue: result.decrypt };
    },

    // The envelope is bound to the configuration file it is made for (SEC-603): pass that file.
    encrypt: async (value: string, filename: string): Promise<OsgiServiceResponse> => {
        const result = await mutation('encrypt(value: $value, name: $name)', '($value: String!, $name: String!)', { value, name: filename });
        return { encryptedValue: result.encrypt };
    },

    getPreference: async (key: string): Promise<OsgiServiceResponse> => {
        const { preference } = await query('preference(key: $key)', '($key: String!)', { key });
        return preference == null ? {} : { value: preference };
    },

    setPreference: async (key: string, value: string): Promise<OsgiServiceResponse> => {
        const result = await mutation('setPreference(key: $key, value: $value)', '($key: String!, $value: String)',
            { key, value });
        // Only report success when something was actually stored: with no user node it is a no-op.
        return result.setPreference ? { status: 'preferenceSaved' } : {};
    }
};
