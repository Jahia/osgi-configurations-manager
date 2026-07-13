// jsdom-safe stand-in for `monaco-yaml` (see monaco-editor.js). MonacoEditor.jsx calls
// configureMonacoYaml(monaco, options) at module load; the stub is a no-op.
module.exports = {
    configureMonacoYaml: () => ({ dispose: () => {} })
};
