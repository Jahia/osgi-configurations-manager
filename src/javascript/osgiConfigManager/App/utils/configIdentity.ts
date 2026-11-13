// Karaf applies <pid>.cfg, <pid>.yml, their .disabled copies and any case of them to the same
// configuration. Mirrors ConfigFileFilter.configurationStem on the server (SEC-525, SEC-602): a
// guard that compares one spelling of a file name misses the others.

const SUPPORTED_EXTENSIONS = ['.cfg.disabled', '.yml.disabled', '.cfg', '.yml'];

/** The file name without its longest admitted extension, lower-cased: the PID it configures. */
export const configurationStem = (filename: string): string => {
    const lower = filename.toLowerCase();
    const extension = SUPPORTED_EXTENSIONS.find(candidate => lower.endsWith(candidate));
    return extension ? lower.slice(0, -extension.length) : lower;
};

/**
 * The files among `files` that configure the same PID as `filename`. A factory instance
 * (<pid>-<name>, <pid>~<name>) is another configuration, so the stems must match exactly.
 */
export const filesOfSameConfiguration = <T extends { name: string }>(files: T[], filename: string): T[] => {
    const stem = configurationStem(filename);
    return files.filter(file => configurationStem(file.name) === stem);
};

/**
 * Which editor a file opens in: 'cfg' or 'yml', whatever the case of its extension, or null. The
 * server lists Foo.CFG and Foo.YML, and a case-sensitive test sent them to an editor that showed
 * the parser's internal structure or nothing.
 */
export const configFileKind = (filename: string): 'cfg' | 'yml' | null => {
    const lower = filename.toLowerCase().replace(/\.disabled$/, '');
    if (lower.endsWith('.cfg')) {
        return 'cfg';
    }
    if (lower.endsWith('.yml')) {
        return 'yml';
    }
    return null;
};

/** Whether the file is a disabled copy (<name>.disabled, any case). */
export const isDisabledFile = (filename: string): boolean => filename.toLowerCase().endsWith('.disabled');
