import { configFileKind, configurationStem, filesOfSameConfiguration, isDisabledFile } from './configIdentity';

describe('configIdentity', () => {
    it('reduces every spelling of a configuration file to its PID', () => {
        expect(configurationStem('org.example.cfg')).toBe('org.example');
        expect(configurationStem('Org.Example.YML')).toBe('org.example');
        expect(configurationStem('org.example.cfg.disabled')).toBe('org.example');
        expect(configurationStem('org.example.yml.DISABLED')).toBe('org.example');
    });

    // Matching one spelling missed the others: Karaf applies them all to the same PID.
    it('finds the other extension, the disabled copy and another case, but not a factory instance', () => {
        const files = [
            { name: 'org.example.cfg.disabled' },
            { name: 'org.example.yml' },
            { name: 'ORG.EXAMPLE.cfg' },
            { name: 'org.example-instance.cfg' },
            { name: 'org.example~instance.cfg' },
            { name: 'org.other.cfg' }
        ];

        expect(filesOfSameConfiguration(files, 'org.example.cfg').map(file => file.name)).toEqual([
            'org.example.cfg.disabled',
            'org.example.yml',
            'ORG.EXAMPLE.cfg'
        ]);
    });
});

// Foo.CFG and Foo.YML are listed by the server, but a case-sensitive test opened them in a legacy
// editor that showed the parser's structure (.CFG) or nothing (.YML).
describe('configFileKind', () => {
    it('reads the extension in any case, disabled or not', () => {
        expect(configFileKind('org.example.cfg')).toBe('cfg');
        expect(configFileKind('Org.Example.CFG')).toBe('cfg');
        expect(configFileKind('org.example.cfg.DISABLED')).toBe('cfg');
        expect(configFileKind('org.example.YML')).toBe('yml');
        expect(configFileKind('org.example.yml.disabled')).toBe('yml');
        expect(configFileKind('org.example.txt')).toBeNull();
    });

    it('tells a disabled copy in any case', () => {
        expect(isDisabledFile('org.example.cfg.disabled')).toBe(true);
        expect(isDisabledFile('org.example.CFG.DISABLED')).toBe(true);
        expect(isDisabledFile('org.example.cfg')).toBe(false);
    });
});
