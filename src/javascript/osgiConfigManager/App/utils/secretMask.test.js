import {
    findSecretValues,
    isSecretName,
    isSecretProperty,
    languageOfFile,
    maskSecrets,
    secretKeyTester
} from './secretMask';

const byName = key => isSecretName(key);

describe('isSecretProperty', () => {
    it('follows the Metatype first: a Password attribute is a secret whatever its name', () => {
        expect(isSecretProperty('credential', {type: 'password'})).toBe(true);
        expect(isSecretProperty('connection', {type: 'Password'})).toBe(true);
    });

    it('recognises the usual secret names, like the Felix console does for "password"', () => {
        ['password', 'db.password', 'jiraAdminPassword', 'passwd', 'passphrase', 'slack.token', 'clientSecret',
            'cryptoSecret', 'credential', 'apiKey', 'api_key', 'api.key', 'privateKey', 'private-key'].forEach(key => {
            expect(isSecretProperty(key, undefined)).toBe(true);
        });
    });

    it('leaves other names alone', () => {
        ['url', 'user', 'username', 'enabled', 'timeout', 'host', 'passage'].forEach(key => {
            expect(isSecretProperty(key, undefined)).toBe(false);
        });
    });

    it('never masks a Boolean or a number, whatever its name', () => {
        expect(isSecretProperty('tokenExpiry', {type: 'long'})).toBe(false);
        expect(isSecretProperty('passwordRequired', {type: 'boolean'})).toBe(false);
        expect(isSecretProperty('token', {type: 'string'})).toBe(true);
    });

    it('reads the Metatype of the file through secretKeyTester', () => {
        const isSecret = secretKeyTester({properties: [{id: 'credential', type: 'password'}, {id: 'tokenTtl', type: 'integer'}]});
        expect(isSecret('credential')).toBe(true);
        expect(isSecret('tokenTtl')).toBe(false);
        expect(isSecret('github.token')).toBe(true);
        expect(isSecret('url')).toBe(false);
    });
});

describe('findSecretValues in a .cfg', () => {
    it('finds the value of a secret, with every separator java.util.Properties accepts', () => {
        const text = ['url = https://x', 'password = s3cret', 'token:abc', 'secret  value with spaces', 'user=me'].join('\n');
        expect(findSecretValues(text, 'properties', byName)).toEqual([
            {key: 'password', ranges: [{lineNumber: 2, startColumn: 12, endColumn: 18}]},
            {key: 'token', ranges: [{lineNumber: 3, startColumn: 7, endColumn: 10}]},
            {key: 'secret', ranges: [{lineNumber: 4, startColumn: 9, endColumn: 26}]}
        ]);
    });

    it('leaves ENC(...) envelopes, comments, empty values and other keys visible', () => {
        const text = ['password = ENC(v3:abc)', '# password = in a comment', '! token = old style comment', 'token =', 'user = me'].join('\n');
        expect(findSecretValues(text, 'properties', byName)).toEqual([]);
    });

    it('covers every line of a continued value, but not the backslashes', () => {
        const text = ['password = first \\', '    second \\', '    third', 'user = me'].join('\n');
        expect(findSecretValues(text, 'properties', byName)).toEqual([{
            key: 'password',
            ranges: [
                {lineNumber: 1, startColumn: 12, endColumn: 17},
                {lineNumber: 2, startColumn: 5, endColumn: 11},
                {lineNumber: 3, startColumn: 5, endColumn: 10}
            ]
        }]);
    });

    it('unescapes the key before testing it, and keeps CRLF files aligned', () => {
        const text = 'my\\ password = x\r\nuser = y\r\n';
        expect(findSecretValues(text, 'properties', byName)).toEqual([
            {key: 'my password', ranges: [{lineNumber: 1, startColumn: 16, endColumn: 17}]}
        ]);
    });
});

describe('findSecretValues in a .yml', () => {
    it('finds inline values, nested or quoted keys, and stops at a comment', () => {
        const text = [
            'server:',
            '  url: https://x',
            '  password: s3cret # the admin one',
            '  "api.key": \'quoted value\'',
            '- token: listed',
            'user: me'
        ].join('\n');
        expect(findSecretValues(text, 'yaml', byName)).toEqual([
            {key: 'password', ranges: [{lineNumber: 3, startColumn: 13, endColumn: 19}]},
            {key: 'api.key', ranges: [{lineNumber: 4, startColumn: 14, endColumn: 28}]},
            {key: 'token', ranges: [{lineNumber: 5, startColumn: 10, endColumn: 16}]}
        ]);
    });

    it('covers a block scalar up to the next line that is not indented deeper', () => {
        const text = ['privateKey: |', '  line one', '', '  line two', 'user: me'].join('\n');
        expect(findSecretValues(text, 'yaml', byName)).toEqual([{
            key: 'privateKey',
            ranges: [
                {lineNumber: 2, startColumn: 3, endColumn: 11},
                {lineNumber: 4, startColumn: 3, endColumn: 11}
            ]
        }]);
    });

    it('leaves maps, ENC(...) values and "key:value" scalars alone', () => {
        const text = ['credentials:', '  user: me', 'password: ENC(v3:abc)', 'note: token:not-a-key'].join('\n');
        expect(findSecretValues(text, 'yaml', byName)).toEqual([]);
    });
});

describe('maskSecrets', () => {
    it('replaces the characters of the values and keeps the length of every line', () => {
        const text = 'url = https://x\npassword = s3cret\nuser = me';
        const masked = maskSecrets(text, 'properties', byName);
        expect(masked).toBe('url = https://x\npassword = ••••••\nuser = me');
        expect(masked.length).toBe(text.length);
    });

    it('returns the text as it is when there is no secret', () => {
        expect(maskSecrets('user = me', 'properties', byName)).toBe('user = me');
    });
});

describe('languageOfFile', () => {
    it('reads the language from the extension', () => {
        expect(languageOfFile('a.yml')).toBe('yaml');
        expect(languageOfFile('a.yml.disabled')).toBe('yaml');
        expect(languageOfFile('a.cfg')).toBe('properties');
    });
});
