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
