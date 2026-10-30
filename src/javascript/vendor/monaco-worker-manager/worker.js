// Worker half of the monaco-worker-manager replacement (see index.js); imported by monaco-yaml's
// yaml.worker.js. 2.0.1 imported 'monaco-editor/esm/vs/editor/editor.worker.js', a path the exports
// map of Monaco 0.53+ no longer resolves; 'monaco-editor/editor/editor.worker' is the same file
// through that map.
import {initialize as initializeWorker} from 'monaco-editor/editor/editor.worker';

/**
 * Create a web worker proxy.
 *
 * @param fn - The function that creates the web worker.
 */
export function initialize(fn) {
    // The first message only starts the handshake; initializeWorker reads the create data from
    // the second one (see createWorker in index.js).
    self.onmessage = () => {
        initializeWorker((ctx, createData) => Object.create(fn(ctx, createData)));
    };
}
