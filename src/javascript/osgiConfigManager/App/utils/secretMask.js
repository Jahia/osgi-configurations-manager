/**
 * Which property values are secrets, and where they sit in the text of a file, so that the visual
 * editor, the raw editor and the review-before-save diff all mask the same values.
 *
 * The rule is the Felix web console's, extended: a property is a secret when its Metatype attribute
 * is declared as Password, or, for a text attribute or a property without Metatype, when its name
 * looks like one. The console only knows the word "password"; "token", "secret" or "credential"
 * are secrets just as often.
 *
 * Masking is a display matter: it keeps a secret off the screen, off a screen share and off a
 * screenshot. The file keeps the value as it is, and Download gives it as stored. Only ENC(...)
 * protects the stored value, and only for a consumer that reads its configuration through
 * Configuration Admin while this module runs.
 */

const SECRET_NAME = /pass(?:word|wd|phrase)|secret|token|credential|api[._-]?key|private[._-]?key/i;

/** True when a property name looks like a secret. */
export const isSecretName = key => SECRET_NAME.test(String(key ?? ''));

/**
 * True when a property holds a secret: Password in the Metatype, or a secret-looking name on a
 * text attribute or on a property the Metatype does not describe. A Boolean or a number is never
 * a secret, whatever its name ("tokenExpiry", "passwordMinLength").
 */
export const isSecretProperty = (key, definition) => {
    const type = String(definition?.type ?? '').toLowerCase();
    if (type === 'password') {
        return true;
    }
    if (type && type !== 'string') {
        return false;
    }
    return isSecretName(key);
};

/** A tester for one file: `key => boolean`, with the Metatype of that file. */
export const secretKeyTester = metatypeDefinition => {
    const definitions = new Map();
    (metatypeDefinition?.properties || []).forEach(property => {
        if (property?.id) {
            definitions.set(property.id, property);
        }
    });
    return key => isSecretProperty(key, definitions.get(key));
};

// An ENC(...) envelope is ciphertext: it gives nothing away and shows that the value is protected.
const isEnvelope = value => value.trimStart().startsWith('ENC(');

const countTrailingBackslashes = line => {
    let count = 0;
    for (let i = line.length - 1; i >= 0 && line[i] === '\\'; i--) {
        count++;
    }
    return count;
};

const isContinued = line => countTrailingBackslashes(line) % 2 === 1;

const isBlank = char => char === ' ' || char === '\t' || char === '\f';

/**
 * The key of a .properties line and the index where its value starts, following
 * java.util.Properties: the key ends at the first unescaped '=', ':' or blank, then blanks and one
 * separator are skipped. Null for a blank line or a comment.
 */
const parsePropertyLine = line => {
    let i = 0;
    while (i < line.length && isBlank(line[i])) {
        i++;
    }
    if (i === line.length || line[i] === '#' || line[i] === '!') {
        return null;
    }
    const keyStart = i;
    while (i < line.length && !(line[i] === '=' || line[i] === ':' || isBlank(line[i]))) {
        i += line[i] === '\\' ? 2 : 1;
    }
    const key = line.slice(keyStart, Math.min(i, line.length)).replace(/\\(.)/g, '$1');
    while (i < line.length && isBlank(line[i])) {
        i++;
    }
    if (i < line.length && (line[i] === '=' || line[i] === ':')) {
        i++;
    }
    while (i < line.length && isBlank(line[i])) {
        i++;
    }
    return {key, valueStart: i};
};

/**
 * A range over [start, end) of a line, in Monaco coordinates (1-based, end exclusive). The trailing
 * backslash of a continued line is syntax, not value, and stays visible.
 */
const rangeOf = (line, lineNumber, start) => {
    let end = line.length;
    if (isContinued(line)) {
        end--;
    }
    while (end > start && isBlank(line[end - 1])) {
        end--;
    }
    return end > start ? {lineNumber, startColumn: start + 1, endColumn: end + 1} : null;
};

const firstNonBlank = line => {
    let i = 0;
    while (i < line.length && isBlank(line[i])) {
        i++;
    }
    return i;
};

const propertiesSecrets = (lines, isSecretKey) => {
    const secrets = [];
    let i = 0;
    while (i < lines.length) {
        const parsed = parsePropertyLine(lines[i]);
        if (!parsed) {
            i++;
            continue;
        }
        let last = i;
        while (isContinued(lines[last]) && last + 1 < lines.length) {
            last++;
        }
        if (isSecretKey(parsed.key) && !isEnvelope(lines[i].slice(parsed.valueStart))) {
            const ranges = [rangeOf(lines[i], i + 1, parsed.valueStart)];
            for (let n = i + 1; n <= last; n++) {
                ranges.push(rangeOf(lines[n], n + 1, firstNonBlank(lines[n])));
            }
            const kept = ranges.filter(Boolean);
            if (kept.length > 0) {
                secrets.push({key: parsed.key, ranges: kept});
            }
        }
        i = last + 1;
    }
    return secrets;
};

// "key: value", "- key: value", quoted keys; the value is absent for a nested map or a list.
const YAML_ENTRY = /^(\s*)(?:-\s+)?("[^"]*"|'[^']*'|[^\s#'"-][^:#]*?|-[^\s:#][^:#]*?)\s*:(?:(\s+)(.*))?$/;
const YAML_BLOCK_SCALAR = /^[|>][-+0-9]*\s*(?:#.*)?$/;

const yamlSecrets = (lines, isSecretKey) => {
    const secrets = [];
    for (let i = 0; i < lines.length; i++) {
        const match = YAML_ENTRY.exec(lines[i]);
        if (!match || match[4] === undefined || match[4].trim() === '') {
            continue;
        }
        const key = match[2].replace(/^(["'])(.*)\1$/, '$2');
        const value = match[4];
        if (!isSecretKey(key) || isEnvelope(value)) {
            continue;
        }
        const valueStart = lines[i].length - value.length;
        if (YAML_BLOCK_SCALAR.test(value.trim())) {
            // A literal or folded block: the value is every following line indented deeper.
            const indent = match[1].length;
            const ranges = [];
            let n = i + 1;
            for (; n < lines.length; n++) {
                const line = lines[n];
                if (line.trim() === '') {
                    continue;
                }
                const start = firstNonBlank(line);
                if (start <= indent) {
                    break;
                }
                ranges.push({lineNumber: n + 1, startColumn: start + 1, endColumn: line.trimEnd().length + 1});
            }
            if (ranges.length > 0) {
                secrets.push({key, ranges});
            }
            i = n - 1;
            continue;
        }
        // An unquoted scalar ends at a " #" comment; a quoted one runs to its closing quote.
        let end = value.length;
        if (!value.startsWith('"') && !value.startsWith("'")) {
            const comment = value.search(/\s#/);
            if (comment !== -1) {
                end = comment;
            }
        }
        const range = rangeOf(lines[i].slice(0, valueStart + end), i + 1, valueStart);
        if (range) {
            secrets.push({key, ranges: [range]});
        }
    }
    return secrets;
};

/**
 * The secret values of a file: `[{key, ranges: [{lineNumber, startColumn, endColumn}]}]`, one entry
 * per property, one range per line its value spans. ENC(...) values are left out.
 *
 * @param {string} text the content of the file
 * @param {'properties'|'yaml'} language
 * @param {(key: string) => boolean} isSecretKey from {@link secretKeyTester}
 */
export const findSecretValues = (text, language, isSecretKey) => {
    const lines = String(text ?? '').split('\n').map(line => (line.endsWith('\r') ? line.slice(0, -1) : line));
    return language === 'yaml' ? yamlSecrets(lines, isSecretKey) : propertiesSecrets(lines, isSecretKey);
};

export const MASK_CHARACTER = '•';

/**
 * The text with every character of every secret value replaced by a bullet. The length of every
 * line is kept, so a slice of the masked text lines up with the same slice of the original.
 */
export const maskSecrets = (text, language, isSecretKey) => {
    const source = String(text ?? '');
    const secrets = findSecretValues(source, language, isSecretKey);
    if (secrets.length === 0) {
        return source;
    }
    const lines = source.split('\n');
    secrets.forEach(secret => secret.ranges.forEach(({lineNumber, startColumn, endColumn}) => {
        const line = lines[lineNumber - 1];
        lines[lineNumber - 1] = line.slice(0, startColumn - 1)
            + MASK_CHARACTER.repeat(endColumn - startColumn)
            + line.slice(endColumn - 1);
    }));
    return lines.join('\n');
};

/** The editor language of a file, from its name. */
export const languageOfFile = filename => (/\.yml(\.disabled)?$/i.test(String(filename ?? '')) ? 'yaml' : 'properties');
