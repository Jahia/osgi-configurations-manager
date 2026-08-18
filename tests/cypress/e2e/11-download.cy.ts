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

        // openOsgiFile only waits for the NAME to appear in the header, which happens as soon as
        // the row is clicked — before the content request comes back. The download builds its Blob
        // from rawContent, so clicking too early produced an empty Blob: on a CI runner this failed
        // with "expected '' to equal 'download.marker = present\n'" while passing locally, where
        // the fetch always won the race. Wait for the parsed content to be on screen instead.
        cy.ensureVisualCfgMode();
        cy.get('[data-cy="cfg-key-0"]', {timeout: 30000}).should('have.value', 'download.marker');

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

        // should() retries, then() does not — so the capture is awaited rather than sampled once.
        cy.wrap(captured).should(c => {
            expect(c.downloadName, 'download filename').to.eq(file);
            expect(c.blob, 'download blob').to.exist;
        });

        cy.wrap(captured).then(c => (c.blob as Blob).text()).then(text => {
            expect(text).to.eq(content);
        });
    });
});
