export const cleanupFiles = (filenames: Array<string | null | undefined>) => {
    const existingFilenames = filenames.filter((filename): filename is string => Boolean(filename));

    if (existingFilenames.length === 0) {
        return cy.wrap(null, {log: false});
    }

    return cy.cleanupOsgiFiles(existingFilenames);
};

export type MetatypePropertyDefinition = {
    id: string;
};

export type MetatypeDefinition = {
    pid: string;
    filename: string;
    factory?: boolean;
    created?: boolean;
    properties: MetatypePropertyDefinition[];
};

export type OsgiReadResponse = {
    data?: {
        rawContent?: string;
        properties?: unknown;
    };
    error?: string;
};

export const findAvailableMetatype = (
    predicate: (definition: MetatypeDefinition) => boolean,
    description: string
) => {
    // eslint-disable-next-line cypress/unsafe-to-chain-command
    return cy.getAvailableMetatypes().then((definitions: MetatypeDefinition[]) => {
        const definition = definitions.find(predicate);

        expect(definition, description).to.exist;

        return definition as MetatypeDefinition;
    });
};

export const readOsgiFileBody = (filename: string) => {
    return cy.readOsgiFile(filename).then((body: OsgiReadResponse) => body);
};

/**
 * The manager's own configuration file, and the option that shows the visual editor's formatting
 * controls. A spec asserting on those controls must set the option, not assume its default: an
 * instance where someone turned it on failed 06-cfg-visual-editor for reasons unrelated to the code.
 */
const MANAGER_FILE = 'org.jahia.modules.osgiconfigmanager.cfg';
const VISUAL_FORMATTING_KEY = 'visualFormattingControlsEnabled';
// A function, not a shared /g regex: test() on a global regex keeps a lastIndex between calls.
const visualFormattingLines = () => new RegExp(`^[ \\t]*${VISUAL_FORMATTING_KEY}[ \\t]*[=:].*$`, 'gm');

/** The flag a manager file sets, as the server reads it: absent is false, the last line wins. */
const visualFormattingFlagOf = (content: string | null): boolean => {
    const lines = content?.match(visualFormattingLines()) ?? [];
    const value = lines.length ? lines[lines.length - 1].replace(/^[^=:]*[=:]/, '').trim() : '';
    return value.toLowerCase() === 'true';
};

/**
 * The server applies the file only once Felix FileInstall notices it: about a second on Linux, up
 * to ten on macOS. Waits until the API reports the expected value, for up to 30 seconds.
 */
const waitForVisualFormattingControls = (enabled: boolean, attemptsLeft = 30): Cypress.Chainable<Cypress.OsgiGqlResult> => {
    // The next attempt is queued inside then(), so Cypress runs it before the commands that follow.
    return cy.osgiQuery('uiConfig { visualFormattingControlsEnabled }', '', {}, {log: false}).then((result): void => {
        const uiConfig = result.data?.uiConfig as {visualFormattingControlsEnabled?: boolean} | undefined;
        if (Boolean(uiConfig?.visualFormattingControlsEnabled) === enabled) {
            return;
        }

        if (attemptsLeft <= 0) {
            throw new Error(`The server did not apply ${VISUAL_FORMATTING_KEY} = ${enabled} within 30 seconds`);
        }

        // eslint-disable-next-line cypress/no-unnecessary-waiting
        cy.wait(1000, {log: false});
        waitForVisualFormattingControls(enabled, attemptsLeft - 1);
    });
};

/**
 * The manager's configuration as it is now, to restore after the spec. Wrapped in an object:
 * a then() callback returning null yields the previous subject instead.
 */
export type ManagerConfiguration = {content: string | null};

export const readManagerConfiguration = (): Cypress.Chainable<ManagerConfiguration> => {
    return cy.readOsgiFile(MANAGER_FILE).then((read): ManagerConfiguration => {
        if (read.error) {
            if (read.code === 'NOT_FOUND') {
                return {content: null};
            }

            throw new Error(`Unable to read ${MANAGER_FILE}: ${read.error}`);
        }

        return {content: read.data?.rawContent ?? ''};
    });
};

/** Sets the option in the manager's configuration, keeping its other lines, and waits until applied. */
export const setVisualFormattingControls = (enabled: boolean) => {
    return readManagerConfiguration().then(({content: current}) => {
        const line = `${VISUAL_FORMATTING_KEY} = ${enabled}`;
        const base = current ?? '';
        const updated = visualFormattingLines().test(base) ?
            base.replace(visualFormattingLines(), line) :
            `${base}${base && !base.endsWith('\n') ? '\n' : ''}${line}\n`;
        if (current === null || updated !== current) {
            cy.upsertOsgiFile(MANAGER_FILE, updated);
        }

        return waitForVisualFormattingControls(enabled);
    });
};

/** Puts the manager's configuration back as readManagerConfiguration found it, and waits until applied. */
export const restoreManagerConfiguration = (original: ManagerConfiguration | undefined) => {
    if (original === undefined) {
        return cy.wrap(null, {log: false});
    }

    if (original.content === null) {
        cy.osgiMutation('delete(name: $name)', '($name: String!)', {name: MANAGER_FILE});
    } else {
        cy.upsertOsgiFile(MANAGER_FILE, original.content);
    }

    return waitForVisualFormattingControls(visualFormattingFlagOf(original.content));
};
