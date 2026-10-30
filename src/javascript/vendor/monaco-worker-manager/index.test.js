import path from 'path';
import webpackConfig from '../../../../webpack.config';
import { createWorkerManager } from './index';

const fakeMonaco = () => {
    const webWorker = { dispose: jest.fn(), withSyncedResources: jest.fn(() => Promise.resolve('proxy')) };
    return { webWorker, monaco: { editor: { createWebWorker: jest.fn(() => webWorker) } } };
};

describe('monaco-worker-manager replacement', () => {
    let worker;

    beforeEach(() => {
        worker = { postMessage: jest.fn() };
        global.MonacoEnvironment = { getWorker: jest.fn(() => worker) };
    });

    afterEach(() => {
        delete global.MonacoEnvironment;
    });

    it('hands Monaco the worker itself, as the 0.55+ createWebWorker expects', async () => {
        const { monaco } = fakeMonaco();
        const manager = createWorkerManager(monaco, { label: 'yaml', moduleId: 'monaco-yaml/yaml.worker', createData: { a: 1 } });

        await expect(manager.getWorker('inmemory://model/1')).resolves.toBe('proxy');

        expect(global.MonacoEnvironment.getWorker).toHaveBeenCalledWith('workerMain.js', 'yaml');
        const options = monaco.editor.createWebWorker.mock.calls[0][0];
        // Passing {label, moduleId, createData} instead silently falls back to a main-thread
        // worker without the YAML service.
        expect(Object.keys(options)).toEqual(['worker']);
        await expect(options.worker).resolves.toBe(worker);
        expect(worker.postMessage.mock.calls).toEqual([['ignore'], [{ a: 1 }]]);
        manager.dispose();
    });

    it('starts the worker once, and again with new create data', async () => {
        const { monaco, webWorker } = fakeMonaco();
        const manager = createWorkerManager(monaco, { label: 'yaml', createData: { a: 1 } });

        await manager.getWorker();
        await manager.getWorker();
        expect(monaco.editor.createWebWorker).toHaveBeenCalledTimes(1);

        manager.updateCreateData({ a: 2 });
        expect(webWorker.dispose).toHaveBeenCalledTimes(1);
        await manager.getWorker();
        expect(monaco.editor.createWebWorker).toHaveBeenCalledTimes(2);
        await monaco.editor.createWebWorker.mock.calls[1][0].worker;
        expect(worker.postMessage).toHaveBeenLastCalledWith({ a: 2 });

        manager.dispose();
        expect(() => manager.getWorker()).toThrow('Worker manager has been disposed');
    });

    it('stops an idle worker', async () => {
        jest.useFakeTimers();
        try {
            const { monaco, webWorker } = fakeMonaco();
            const manager = createWorkerManager(monaco, { label: 'yaml', interval: 10, stopWhenIdleFor: 50 });
            manager.getWorker();

            jest.advanceTimersByTime(100);

            expect(webWorker.dispose).toHaveBeenCalledTimes(1);
            manager.dispose();
        } finally {
            jest.useRealTimers();
        }
    });

    it('is what webpack resolves monaco-worker-manager to', () => {
        const { alias } = webpackConfig({}, { mode: 'production' }).resolve;

        expect(alias['monaco-worker-manager$']).toBe(path.resolve(__dirname, 'index.js'));
        expect(alias['monaco-worker-manager/worker$']).toBe(path.resolve(__dirname, 'worker.js'));
    });
});
