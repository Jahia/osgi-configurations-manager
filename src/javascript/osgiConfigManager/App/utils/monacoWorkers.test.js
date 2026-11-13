import { createOwnMonacoWorker, ownMonacoWorkerUrl } from './monacoWorkers';

describe('monacoWorkers', () => {
    let OriginalWorker;

    beforeEach(() => {
        OriginalWorker = global.Worker;
        global.Worker = jest.fn(function (url) {
            this.url = url;
        });
    });

    afterEach(() => {
        global.Worker = OriginalWorker;
        delete window.contextJsParameters;
    });

    it('points at the workers this module ships, under the context path', () => {
        window.contextJsParameters = { contextPath: '/ctx' };

        expect(ownMonacoWorkerUrl('yaml')).toBe('/ctx/modules/osgi-configurations-manager/javascript/apps/yaml.worker.js');
        expect(ownMonacoWorkerUrl('editorWorkerService')).toBe('/ctx/modules/osgi-configurations-manager/javascript/apps/editor.worker.js');
    });

    it('starts the worker from that URL', () => {
        expect(createOwnMonacoWorker('yaml').url).toBe('/modules/osgi-configurations-manager/javascript/apps/yaml.worker.js');
    });
});
