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

declare global {
    interface Window {
        contextJsParameters: {
            contextPath: string;
        };
    }
}

const apiUrl = (window.contextJsParameters ? window.contextJsParameters.contextPath : '') + '/cms/render/default/en/sites/systemsite.osgiConfigManager.do';

const handleResponse = async (res: Response): Promise<OsgiServiceResponse> => {
    // The backend sometimes returns 500 with a JSON error, or plain text.
    // We should try to parse JSON if possible, or throw text.
    const isJson = res.headers.get('content-type')?.includes('application/json');
    if (!res.ok) {
        if (isJson) {
            const err = await res.json();
            throw new Error(err.error || res.statusText);
        }
        const text = await res.text();
        throw new Error(text || res.statusText);
    }
    return res.json();
};

export const osgiService = {
    url: apiUrl, // Exposed for configUtils if needed

    getAll: async (search: string = '', deep: boolean = false): Promise<OsgiServiceResponse> => {
        let url = apiUrl;
        if (deep && search) {
            url += `?search=${encodeURIComponent(search)}`;
        }
        return handleResponse(await fetch(url));
    },

    read: async (filename: string): Promise<OsgiServiceResponse> => {
        return handleResponse(await fetch(`${apiUrl}?filename=${encodeURIComponent(filename)}`));
    },

    getAvailableMetatypes: async (): Promise<OsgiServiceResponse> => {
        return handleResponse(await fetch(`${apiUrl}?action=availableMetatypes`));
    },

    save: async (payload: OsgiPayload): Promise<OsgiServiceResponse> => {
        return handleResponse(await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }));
    },

    toggle: async (filename: string): Promise<OsgiServiceResponse> => {
        return handleResponse(await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'toggle', filename })
        }));
    },

    markAsDefault: async (filename: string): Promise<OsgiServiceResponse> => {
        return handleResponse(await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'markAsDefault', filename })
        }));
    },

    delete: async (filename: string): Promise<OsgiServiceResponse> => {
        return handleResponse(await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', filename })
        }));
    },

    create: async (filename: string): Promise<OsgiServiceResponse> => {
        return handleResponse(await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create', filename })
        }));
    },

    createFromMetatype: async (pid: string, instanceIdentifier?: string): Promise<OsgiServiceResponse> => {
        return handleResponse(await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'createFromMetatype', pid, instanceIdentifier })
        }));
    },

    decrypt: async (value: string): Promise<OsgiServiceResponse> => {
        return handleResponse(await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'decrypt', value })
        }));
    },

    encrypt: async (value: string): Promise<OsgiServiceResponse> => {
        return handleResponse(await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'encrypt', value })
        }));
    },

    getPreference: async (key: string): Promise<OsgiServiceResponse> => {
        return handleResponse(await fetch(`${apiUrl}?action=getPreference&key=${encodeURIComponent(key)}`));
    },

    setPreference: async (key: string, value: string): Promise<OsgiServiceResponse> => {
        return handleResponse(await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'setPreference', key, value })
        }));
    }
};
