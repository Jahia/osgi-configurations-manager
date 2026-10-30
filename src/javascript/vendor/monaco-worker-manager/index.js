/**
 * @license MIT
 * Based on monaco-worker-manager 2.0.1, Copyright © 2022 Remco Haszing.
 * Distributed under the MIT License; see LICENSE.md in this folder.
 */

// Replaces monaco-worker-manager 2.0.1 (unmaintained since 2022), which monaco-yaml uses to run
// its language service in a web worker. webpack.config.js aliases the package to this folder.
//
// Monaco 0.55 changed monaco.editor.createWebWorker: it now takes the Worker itself
// ({worker, host, keepIdleModels}) instead of {label, moduleId, createData}. Called the old way it
// does not fail: Monaco logs a warning and falls back to a worker on the main thread that has no
// YAML service, so validation, hover and completion silently stop
// (remcohaszing/monaco-worker-manager#3). This copy keeps the 2.0.1 API and lifecycle, and builds
// the worker the way Monaco does for its own languages (vs/internal/common/workers.js): ask
// MonacoEnvironment for it, then post a throwaway message and the create data, which worker.js
// expects in that order.

const createWorker = (label, createData) => {
    const environment = globalThis.MonacoEnvironment;
    let worker;
    if (typeof environment?.getWorker === 'function') {
        worker = environment.getWorker('workerMain.js', label);
    } else if (typeof environment?.getWorkerUrl === 'function') {
        worker = new Worker(environment.getWorkerUrl('workerMain.js', label), {name: label, type: 'module'});
    } else {
        throw new Error('MonacoEnvironment.getWorker or MonacoEnvironment.getWorkerUrl must be defined');
    }

    return Promise.resolve(worker).then(w => {
        w.postMessage('ignore');
        w.postMessage(createData);
        return w;
    });
};

/**
 * Create a worker manager: starts the worker on first use and stops it after an idle period.
 *
 * @param monaco - The Monaco editor module.
 * @param options - {label, createData, interval, stopWhenIdleFor}; moduleId is accepted and ignored.
 * @returns The worker manager.
 */
export function createWorkerManager(monaco, options) {
    let {createData, interval = 30_000, label, stopWhenIdleFor = 120_000} = options;
    let worker;
    let lastUsedTime = 0;
    let disposed = false;

    const stopWorker = () => {
        if (worker) {
            worker.dispose();
            worker = undefined;
        }
    };

    const intervalId = setInterval(() => {
        if (!worker) {
            return;
        }
        if (Date.now() - lastUsedTime > stopWhenIdleFor) {
            stopWorker();
        }
    }, interval);

    return {
        dispose() {
            disposed = true;
            clearInterval(intervalId);
            stopWorker();
        },

        getWorker(...resources) {
            if (disposed) {
                throw new Error('Worker manager has been disposed');
            }
            lastUsedTime = Date.now();
            if (!worker) {
                worker = monaco.editor.createWebWorker({worker: createWorker(label, createData)});
            }
            return worker.withSyncedResources(resources);
        },

        updateCreateData(newCreateData) {
            createData = newCreateData;
            stopWorker();
        }
    };
}
