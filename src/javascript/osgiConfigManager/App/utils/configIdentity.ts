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
