import React, { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';
import { configureMonacoYaml } from 'monaco-yaml';
import { Button } from '@jahia/moonstone';
import { Undo, RotateRight, Code, Lock, Unlock, ViewList } from '@jahia/moonstone';
import { useTranslation } from 'react-i18next';
import { osgiService } from '../api/osgiService';

// Define workers for Monaco
if (!window.MonacoEnvironment) {
    window.MonacoEnvironment = {
        getWorker(workerId, label) {
            const basePath = (window.contextJsParameters?.contextPath || '') + '/modules/osgi-configurations-manager/javascript/apps/';
            if (label === 'yaml') {
                return new Worker(basePath + 'yaml.worker.js');
            }
            return new Worker(basePath + 'editor.worker.js');
        },
    };
}

// Configure YAML support once
configureMonacoYaml(monaco, {
    enableSchemaRequest: true,
    hover: true,
    completion: true,
    validate: true,
    format: true,
});

// Explicitly register 'properties' language if not present
const allLanguages = monaco.languages.getLanguages();
if (!allLanguages.some(l => l.id === 'properties')) {
    monaco.languages.register({ id: 'properties' });
}

monaco.languages.setMonarchTokensProvider('properties', {
    tokenizer: {
        root: [
            [/^\s*[#!].*$/, 'comment'],
            // Keys: Any character except separator or newline, at start of line
            [/(^[^=:\n]+)(?=\s*[=:])/, 'key'],
            // Delimiter: switch to 'value' state immediately
            [/[=:]/, { token: 'delimiter', next: '@value' }],
            // Fallback: If no delimiter, treat whole line as key
            [/[^=:\n]+/, 'key']
        ],
        value: [
            // In value state, match everything until end of the line as a string
            [/.*$/, { token: 'string', next: '@pop' }]
        ]
    }
});

// Define custom theme for better properties highlighting
monaco.editor.defineTheme('properties-theme', {
    base: 'vs',
    inherit: true,
    rules: [
        { token: 'key', foreground: '0000FF', fontStyle: 'bold' }, // Blue bold keys
        { token: 'comment', foreground: '008000' }, // Green comments
        { token: 'delimiter', foreground: '000000', fontStyle: 'bold' },
        { token: 'string', foreground: '000000' }
    ],
    colors: {}
});

// Register formatter for properties
try {
    monaco.languages.registerDocumentFormattingEditProvider('properties', {
        provideDocumentFormattingEdits: (model) => {
            const text = model.getValue();
            const lines = text.split('\n');
            const formattedLines = lines.map(line => {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!') || trimmed.indexOf('=') === -1) {
                    return trimmed;
                }
                // Split only on first =
                const parts = trimmed.split('=');
                const key = parts.shift().trim();
                const value = parts.join('=').trim();
                return `${key} = ${value}`;
            });
            const formattedText = formattedLines.join('\n');

            return [
                {
                    range: model.getFullModelRange(),
                    text: formattedText
                }
            ];
        }
    });
} catch (e) {
    // Ignore
}

export const MonacoEditor = ({ value, onChange, onValidate, language = 'yaml', onSwitchMode }) => {
    const { t } = useTranslation('osgi-configurations-manager');
    const containerRef = useRef(null);
    const editorRef = useRef(null);

    useEffect(() => {
        if (containerRef.current) {
            editorRef.current = monaco.editor.create(containerRef.current, {
                value: value,
                language: language,
                theme: language === 'properties' ? 'properties-theme' : 'vs-light',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 14,
                lineNumbers: 'on',
                glyphMargin: true,
                folding: true,
                fixedOverflowWidgets: true, // Allow popups to escape container clipping (e.g. z-index issues with toolbar)
                automaticLayout: false // We use ResizeObserver
            });

            // Explicitly handle resizing
            const resizeObserver = new ResizeObserver(() => {
                if (editorRef.current) {
                    editorRef.current.layout();
                }
            });
            resizeObserver.observe(containerRef.current);

            // Change listener
            const subscription = editorRef.current.onDidChangeModelContent(() => {
                const newValue = editorRef.current.getValue();
                // If language isn't properties, we update here.
                // If it IS properties, we'll override this below to include validation logic.
                // Actually, cleaner is to have a single onChange handler that decides.
                // But since 'subscription' is const, let's keep the override pattern or just manage via if/else.
                // Optimized below.
                onChange(newValue);
            });

            // Validation listener
            let markerSubscription = { dispose: () => { } };

            if (language === 'yaml') {
                markerSubscription = monaco.editor.onDidChangeMarkers(() => {
                    const model = editorRef.current.getModel();
                    if (model) {
                        const markers = monaco.editor.getModelMarkers({ owner: 'yaml', resource: model.uri });
                        const hasErrors = markers.some(marker => marker.severity === monaco.MarkerSeverity.Error);
                        if (onValidate) {
                            onValidate(!hasErrors);
                        }
                    }
                });
            } else if (language === 'properties') {
                // Custom validation for properties
                const validateProperties = () => {
                    const model = editorRef.current.getModel();
                    if (!model) return;

                    const text = model.getValue();
                    const lines = text.split('\n');
                    const markers = [];
                    const seenKeys = new Map(); // key -> lineIndex

                    lines.forEach((line, index) => {
                        const trimmed = line.trim();
                        // Check for lines starting with separator = or : (invalid key)
                        // OR lines without any separator (invalid format, key must have value assignment)
                        // But ignore comments (#, !) and empty lines
                        if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('!')) {
                            if (trimmed.startsWith('=') || trimmed.startsWith(':')) {
                                markers.push({
                                    severity: monaco.MarkerSeverity.Error,
                                    startLineNumber: index + 1,
                                    startColumn: 1,
                                    endLineNumber: index + 1,
                                    endColumn: line.length + 1,
                                    message: 'Property must have a key before the separator',
                                });
                            } else {
                                let key = '';
                                const eqIdx = line.indexOf('=');
                                const colIdx = line.indexOf(':');
                                if (eqIdx === -1 && colIdx === -1) {
                                    markers.push({
                                        severity: monaco.MarkerSeverity.Error,
                                        startLineNumber: index + 1,
                                        startColumn: 1,
                                        endLineNumber: index + 1,
                                        endColumn: line.length + 1,
                                        message: 'Property must include a separator (= or :)',
                                    });
                                } else {
                                    // Extract key
                                    let sepIdx = eqIdx;
                                    if (eqIdx === -1) sepIdx = colIdx;
                                    else if (colIdx !== -1) sepIdx = Math.min(eqIdx, colIdx);

                                    key = line.substring(0, sepIdx).trim();

                                    if (seenKeys.has(key)) {
                                        markers.push({
                                            severity: monaco.MarkerSeverity.Error,
                                            startLineNumber: index + 1,
                                            startColumn: 1,
                                            endLineNumber: index + 1,
                                            endColumn: sepIdx + 1,
                                            message: `Duplicate key '${key}'`,
                                        });
                                    } else {
                                        seenKeys.set(key, index);
                                    }
                                }
                            }
                        }
                    });

                    monaco.editor.setModelMarkers(model, 'properties', markers);

                    if (onValidate) {
                        onValidate(markers.length === 0);
                    }
                };

                // Run initial validation
                validateProperties();

                // Dispose the simple subscription we created above
                subscription.dispose();

                // Create a combined change listener that includes validation
                const changeListener = editorRef.current.onDidChangeModelContent(() => {
                    validateProperties();
                    const newValue = editorRef.current.getValue();
                    onChange(newValue);
                });

                // Assign to markerSubscription for disposal
                markerSubscription = changeListener;
            }

            return () => {
                // subscription was disposed if language===properties
                if (language !== 'properties') {
                    subscription.dispose();
                }
                markerSubscription.dispose();
                resizeObserver.disconnect();
                if (editorRef.current) editorRef.current.dispose();
            };
        }
    }, [language]); // Re-create if language changes (rare)

    // Update editor value if it changes from outside
    useEffect(() => {
        if (editorRef.current && editorRef.current.getValue() !== value) {
            // Check if value is different to avoid cursor jump
            if (editorRef.current.getValue() !== value) {
                editorRef.current.setValue(value);
            }
        }
    }, [value]);

    const handleUndo = () => {
        editorRef.current?.trigger('toolbar', 'undo');
    };

    const handleRedo = () => {
        editorRef.current?.trigger('toolbar', 'redo');
    };

    const handleFormat = () => {
        editorRef.current?.getAction('editor.action.formatDocument').run();
    };

    const handleEncryptSelection = async () => {
        const editor = editorRef.current;
        if (!editor) return;

        const position = editor.getPosition();
        const model = editor.getModel();
        const lineContent = model.getLineContent(position.lineNumber);

        // Smart Logic: Always target the Value of the current line.
        // Regex: (Group 1: Key)(Group 2: Separator)(Group 3: Value)

        const match = lineContent.match(/^([^=:]+?)( ?[=:] ?)(.*)$/);
        // ^ begin
        // ([^=:]+?) lazy capture key
        // ( ?[=:] ?) separator with optional spaces
        // (.*)$ capture rest as value

        if (!match) return;

        const valuePart = match[3];
        if (!valuePart) return; // Empty value

        const valueTrimmed = valuePart.trim();
        if (!valueTrimmed) return; // Whitespace only

        // Prevent double encryption
        if (valueTrimmed.startsWith('ENC(')) return;

        // Calculate Range
        // We want to replace the RAW value part, preserving leading spaces if possible?
        // User said: "encrypter seulement ce qui est apres = et le premier esapce"
        // This suggests preserving the first space after =.
        // My regex ( ?[=:] ?) consumes the first space if present.
        // So 'match[3]' is what follows.

        // Find the start index of match[3] in the line
        // Robust way:
        const fullMatch = match[0];
        const keyAndSep = match[1] + match[2];
        const startColumn = keyAndSep.length + 1; // 1-based
        const endColumn = lineContent.length + 1;

        // But we want to encrypt 'valueTrimmed' or 'valuePart'?
        // Usually we want to encrypt the actual value content.
        // If "key =    secret", we encrypt "secret".
        // Result: "key =    ENC(encrypted...)"
        // This looks cleaner.

        const valStartIndexOffset = valuePart.indexOf(valueTrimmed);
        const actualStartCol = startColumn + valStartIndexOffset;

        const range = new monaco.Range(
            position.lineNumber,
            actualStartCol,
            position.lineNumber,
            actualStartCol + valueTrimmed.length
        );

        try {
            const result = await osgiService.encrypt(valueTrimmed);
            if (result && result.encryptedValue) {
                editor.executeEdits('source', [{
                    range: range,
                    text: result.encryptedValue
                }]);
            }
        } catch (e) {
            console.error("Encryption failed", e);
        }
    };

    const handleDecryptSelection = async () => {
        const editor = editorRef.current;
        if (!editor) return;

        const position = editor.getPosition();
        const model = editor.getModel();
        const lineContent = model.getLineContent(position.lineNumber);

        // Find ENC(...) pattern
        const encStart = lineContent.indexOf('ENC(');
        const encEnd = lineContent.lastIndexOf(')');

        if (encStart === -1 || encEnd === -1 || encEnd <= encStart) return;

        // Extract the ENC string
        const textToDecrypt = lineContent.substring(encStart, encEnd + 1);

        const range = new monaco.Range(
            position.lineNumber,
            encStart + 1, // 1-based
            position.lineNumber,
            encEnd + 2 // inclusive end
        );

        try {
            const result = await osgiService.decrypt(textToDecrypt);
            if (result && result.decryptedValue) {
                editor.executeEdits('source', [{
                    range: range,
                    text: result.decryptedValue
                }]);
            }
        } catch (e) {
            console.error("Decryption failed", e);
        }
    };

    return (
        <div style={{ flex: 1, minHeight: 0, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{
                display: 'flex',
                gap: '8px',
                padding: '8px',
                borderBottom: '1px solid #ddd',
                backgroundColor: '#f9f9f9',
                alignItems: 'center'
            }}>
                <Button label={t('editor.button.undo')} variant="ghost" icon={<Undo />} onClick={handleUndo} title={t('tooltip.undo')} />
                <Button label={t('editor.button.redo')} variant="ghost" icon={<RotateRight />} onClick={handleRedo} title={t('tooltip.redo')} />
                <div style={{ width: '1px', background: '#ccc', margin: '0 4px', height: '20px' }} />
                <Button label={t('editor.button.format')} variant="ghost" icon={<Code />} onClick={handleFormat} title={t('tooltip.format')} />

                {/* Encrypt/Decrypt Buttons for Text Mode */}
                <div style={{ width: '1px', background: '#ccc', margin: '0 4px', height: '20px' }} />
                <Button label={t('editor.button.encrypt')} variant="ghost" icon={<Lock />} onClick={handleEncryptSelection} title={t('tooltip.encryptSelection')} />
                <Button label={t('editor.button.decrypt')} variant="ghost" icon={<Unlock />} onClick={handleDecryptSelection} title={t('tooltip.decryptSelection')} />

                {onSwitchMode && (
                    <>
                        <div style={{ width: '1px', background: '#ccc', margin: '0 4px', height: '20px' }} />
                        <Button
                            label={t('editor.button.modeVisual')}
                            variant="ghost"
                            icon={<ViewList />}
                            onClick={onSwitchMode}
                            title={t('tooltip.modeVisual')}
                        />
                    </>
                )}
            </div>

            <div style={{ flex: 1, position: 'relative' }}>
                <div
                    ref={containerRef}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        overflow: 'hidden'
                    }}
                />
            </div>
        </div>
    );
};

