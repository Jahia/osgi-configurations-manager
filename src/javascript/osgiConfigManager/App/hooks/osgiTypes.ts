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
    onConfirm?: (value?: any) => void;
    onOther?: () => void;
}

export interface DiffConfig {
    isOpen: boolean;
    originalContent: string;
    newContent: string;
    filename: string;
    onConfirm: () => void;
}
