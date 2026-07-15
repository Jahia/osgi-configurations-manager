import {cleanupFiles} from './osgiTestUtils';

/**
 * S52 (G29) — Download a configuration file from the toolbar (F26). The client builds a Blob from
 * the current rawContent and triggers an anchor download (index.jsx handleDownloadSelectedFile).
 * We spy on URL.createObjectURL to capture the Blob and assert its content + the download filename.
 */

describe('OSGi Configurations Manager - Download', () => {
    const file = 'org.jahia.modules.e2e-download.cfg';
    const content = 'download.marker = present\n';

    beforeEach(() => {
        cy.login();
        cleanupFiles([file]);
    });

    afterEach(() => {
        cleanupFiles([file]);
    });

    it('downloads the selected file with its content and filename', () => {
        cy.upsertOsgiFile(file, content);
        cy.openOsgiConfigManager();
        cy.openOsgiFile(file);

        const captured: {blob?: Blob; downloadName?: string} = {};
        cy.window().then(win => {
            cy.stub(win.URL, 'createObjectURL').callsFake((blob: Blob) => {
                captured.blob = blob;
                return 'blob:mock';
            });
            // capture the download attribute set on the transient anchor
            const origCreate = win.document.createElement.bind(win.document);
            cy.stub(win.document, 'createElement').callsFake((tag: string) => {
                const el = origCreate(tag);
                if (tag === 'a') {
                    const setter = Object.getOwnPropertyDescriptor(win.HTMLAnchorElement.prototype, 'download');
                    Object.defineProperty(el, 'download', {
                        set(v) { captured.downloadName = v; setter?.set?.call(this, v); },
                        get() { return captured.downloadName; },
                        configurable: true
                    });
                }
                return el;
            });
        });

        cy.get('[data-cy="download-file-button"]', {timeout: 30000}).click();

        cy.wrap(null).then(() => {
            expect(captured.downloadName, 'download filename').to.eq(file);
            expect(captured.blob, 'download blob').to.exist;
            return (captured.blob as Blob).text();
        }).then(text => {
            expect(text).to.eq(content);
        });
    });
});
