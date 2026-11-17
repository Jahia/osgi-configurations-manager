import { expectedVisualFormattingFlag } from './managerSettings';

describe('expectedVisualFormattingFlag', () => {
    const CFG = 'org.jahia.modules.osgiconfigmanager.cfg';

    it('reads the flag from the manager configuration', () => {
        expect(expectedVisualFormattingFlag(CFG, 'filteredFiles = a\nvisualFormattingControlsEnabled = true\n')).toBe(true);
        expect(expectedVisualFormattingFlag(CFG, 'visualFormattingControlsEnabled=false')).toBe(false);
        expect(expectedVisualFormattingFlag(CFG, 'visualFormattingControlsEnabled : TRUE')).toBe(true);
    });

    // ConfigFileFilter.getBooleanProperty: absent is false, anything but "true" is false.
    it('follows the server rule for absent and unusual values', () => {
        expect(expectedVisualFormattingFlag(CFG, 'filteredFiles = a\n')).toBe(false);
        expect(expectedVisualFormattingFlag(CFG, 'visualFormattingControlsEnabled = yes')).toBe(false);
        expect(expectedVisualFormattingFlag(CFG, 'visualFormattingControlsEnabled = "true"')).toBe(true);
    });

    it('takes the last occurrence and ignores comments', () => {
        expect(expectedVisualFormattingFlag(CFG, 'visualFormattingControlsEnabled = true\nvisualFormattingControlsEnabled = false')).toBe(false);
        expect(expectedVisualFormattingFlag(CFG, '# visualFormattingControlsEnabled = true\n')).toBe(false);
    });

    it('recognises any spelling of the manager file, and its YAML form', () => {
        expect(expectedVisualFormattingFlag('ORG.Jahia.Modules.OsgiConfigManager.CFG', 'visualFormattingControlsEnabled = true')).toBe(true);
        expect(expectedVisualFormattingFlag('org.jahia.modules.osgiconfigmanager.yml', 'visualFormattingControlsEnabled: true')).toBe(true);
    });

    it('returns null for other files, disabled copies and factory instances', () => {
        expect(expectedVisualFormattingFlag('org.example.cfg', 'visualFormattingControlsEnabled = true')).toBeNull();
        expect(expectedVisualFormattingFlag(`${CFG}.disabled`, 'visualFormattingControlsEnabled = true')).toBeNull();
        expect(expectedVisualFormattingFlag('org.jahia.modules.osgiconfigmanager-other.cfg', 'visualFormattingControlsEnabled = true')).toBeNull();
    });
});
