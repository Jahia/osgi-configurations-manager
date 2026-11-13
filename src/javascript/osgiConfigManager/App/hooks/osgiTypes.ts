import { OsgiAvailableMetatypeDefinition } from '../api/osgiService';

export interface OsgiFile {
    name: string;
    enabled?: boolean;
    configState?: 'MODULE' | 'MODULE_DEFAULT' | 'USER';
    [key: string]: any;
}

export interface ModalConfig {
    type: 'confirm' | 'prompt' | 'alert' | 'createConfig';
    severity?: 'warning' | 'info' | 'error';
    title: string;
    message: string;
    defaultValue?: string;
    availableMetatypes?: OsgiAvailableMetatypeDefinition[];
    confirmLabel?: string | null;
    cancelLabel?: string;
    otherLabel?: string;
    deferConfirm?: boolean;
    /**
     * Keep the dialog open until onConfirm resolves, close it only on success, and show a failure
     * in the dialog, next to its field. onUnshownError reports a failure that arrives after the
     * dialog was closed anyway.
     */
    awaitConfirm?: boolean;
    onUnshownError?: (message?: string) => void;
    onConfirm?: (value?: any) => void | Promise<ConfirmResult | void>;
    onOther?: () => void;
}

/** What an awaitConfirm action reports back to its dialog. */
export interface ConfirmResult {
    ok: boolean;
    message?: string;
    field?: 'filename' | 'identifier';
}

export interface DiffConfig {
    isOpen: boolean;
    originalContent: string;
    newContent: string;
    filename: string;
    onConfirm: () => void;
}
