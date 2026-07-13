// S42 (G25) prerequisite: a jsdom-safe stand-in for `monaco-editor`. The real editor cannot run
// in jsdom, so we expose just enough of the API surface that MonacoEditor.jsx mounts and round-trips
// content. Deep editor behaviour (syntax highlight, markers) stays in Cypress (S50).
//
// The most recently created editor is tracked as `__lastEditor` and a helper `__fireChange(text)`
// lets a test simulate the user typing so `onChange` fires.

let lastEditor = null;

class Range {
    constructor(sl, sc, el, ec) {
        this.startLineNumber = sl;
        this.startColumn = sc;
        this.endLineNumber = el;
        this.endColumn = ec;
    }
}

const disposable = () => ({ dispose: () => {} });

function createEditor(container, options = {}) {
    let value = options.value || '';
    const changeListeners = [];

    const model = {
        getValue: () => value,
        setValue: (v) => { value = v; },
        getLineContent: () => '',
        getFullModelRange: () => new Range(1, 1, 1, 1),
        uri: { toString: () => 'inmemory://model/1' }
    };

    const editor = {
        getValue: () => value,
        setValue: (v) => { value = v; },
        getModel: () => model,
        getPosition: () => ({ lineNumber: 1, column: 1 }),
        onDidChangeModelContent: (cb) => {
            changeListeners.push(cb);
            return { dispose: () => {
                const i = changeListeners.indexOf(cb);
                if (i >= 0) changeListeners.splice(i, 1);
            } };
        },
        updateOptions: () => {},
        layout: () => {},
        trigger: () => {},
        getAction: () => ({ run: () => {} }),
        executeEdits: () => {},
        focus: () => {},
        dispose: () => {},
        // test helper: simulate a user edit
        __fireChange: (text) => {
            value = text;
            changeListeners.slice().forEach(cb => cb({ changes: [{ text }] }));
        }
    };

    lastEditor = editor;
    return editor;
}

const MarkerSeverity = { Hint: 1, Info: 2, Warning: 4, Error: 8 };

const languages = {
    getLanguages: () => [],
    register: () => {},
    setMonarchTokensProvider: () => {},
    registerDocumentFormattingEditProvider: () => disposable(),
    registerCompletionItemProvider: () => disposable(),
    registerHoverProvider: () => disposable(),
    CompletionItemKind: { Property: 1, Value: 2, EnumMember: 3 }
};

const editor = {
    create: createEditor,
    defineTheme: () => {},
    setModelMarkers: () => {},
    getModelMarkers: () => [],
    onDidChangeMarkers: () => disposable()
};

module.exports = {
    editor,
    languages,
    Range,
    MarkerSeverity,
    Uri: { parse: (s) => ({ toString: () => s }) },
    __getLastEditor: () => lastEditor
};
