// Starts the Monaco workers this module ships (webpack entries 'yaml.worker' and 'editor.worker').
// They are built against this module's own Monaco, so they must never be swapped for the workers
// of another module that also bundles Monaco: the worker protocol changes between Monaco versions.
export const MODULE_APPS_PATH = '/modules/osgi-configurations-manager/javascript/apps/';

export const ownMonacoWorkerUrl = label => {
    const basePath = (window.contextJsParameters?.contextPath || '') + MODULE_APPS_PATH;
    return basePath + (label === 'yaml' ? 'yaml.worker.js' : 'editor.worker.js');
};

export const createOwnMonacoWorker = label => new Worker(ownMonacoWorkerUrl(label));
