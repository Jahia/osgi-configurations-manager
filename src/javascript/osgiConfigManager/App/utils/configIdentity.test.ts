import { configurationStem, filesOfSameConfiguration } from './configIdentity';

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
