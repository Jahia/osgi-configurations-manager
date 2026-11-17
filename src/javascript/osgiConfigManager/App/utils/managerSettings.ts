import { configFileKind, configurationStem, isDisabledFile } from './configIdentity';

/** The manager's own PID: OsgiConfigService.SELF_CONFIG_PID on the server. */
export const MANAGER_PID = 'org.jahia.modules.osgiconfigmanager';

const VISUAL_FORMATTING_KEY = 'visualFormattingControlsEnabled';

/**
 * The visual formatting flag the server will apply once it has read the saved file, or null when
 * the file is not the manager's active configuration.
 *
 * Saving writes the file; the server applies it only when Felix FileInstall notices the change,
 * which takes up to about ten seconds on macOS. Knowing the value to expect lets the page wait for
 * it instead of asking for several reloads.
 *
 * Mirrors ConfigFileFilter.getBooleanProperty: an absent key is false, and only "true", in any case,
 * is true. When the key is given twice, the last one wins, as in a properties file.
 */
export const expectedVisualFormattingFlag = (filename: string, content: string): boolean | null => {
    if (configurationStem(filename) !== MANAGER_PID || isDisabledFile(filename)) {
        return null;
    }

    const separator = configFileKind(filename) === 'yml' ? ':' : '[=:]';
    const line = new RegExp(`^\\s*${VISUAL_FORMATTING_KEY}\\s*${separator}\\s*(.*)$`);
    let value: string | null = null;
    content.split(/\r?\n/).forEach(text => {
        const match = line.exec(text);
        if (match) {
            value = match[1];
        }
    });

    if (value === null) {
        return false;
    }

    return (value as string).trim().replace(/^(["'])(.*)\1$/, '$2').trim().toLowerCase() === 'true';
};
