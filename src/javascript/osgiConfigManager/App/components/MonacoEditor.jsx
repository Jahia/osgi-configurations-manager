import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as monaco from 'monaco-editor';
import { configureMonacoYaml } from 'monaco-yaml';
import { Button, Typography } from '@jahia/moonstone';
import { Undo, RotateRight, Code, Lock, Unlock, ViewList } from '@jahia/moonstone';
import { useTranslation } from 'react-i18next';
import { osgiService } from '../api/osgiService';
import { buildPropertyDocumentation, findExactMetatypePropertyMatch, formatDefaultValue, getLocalizedTypeLabel, getPropertyLabel, matchesMetatypePropertyQuery } from '../utils/metatypeUtils';

const isExpectedCancellation = reason => {
    if (!reason) {
        return false;
    }

    if (typeof reason === 'string') {
        return reason === 'Canceled';
    }

    return reason.name === 'Canceled' || reason.message === 'Canceled';
};

if (!window.__osgiConfigManagerIgnoreMonacoCancellation) {
    window.addEventListener('unhandledrejection', event => {
        if (isExpectedCancellation(event.reason)) {
            event.preventDefault();
        }
    });
    window.__osgiConfigManagerIgnoreMonacoCancellation = true;
}

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
            // Rule 1: Empty continuation (just slashes)
            // ^ (Start) (Pairs) \ (End)
            [/^(\\\\)*\\\s*$/, 'string'],

            // Rule 2: Content then continuation
            // .* (Content) [Non-Slash] (Pairs) \ (End)
            [/.*[^\\](\\\\)*\\\s*$/, 'string'],

            // Rule 3: End of value (Pop)
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
            let inContinuation = false;
            let currentIndent = ''; // String of spaces for alignment

            const formattedLines = lines.map(line => {
                const trimmed = line.trim();

                // If comment or empty, preserve line (user might have indentation)
                if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) {
                    // Reset continuation state on empty/comment lines (assuming comments break properties)
                    inContinuation = false;
                    return line;
                }

                // Detection logic:
                // If we are already in a continuation block, we MUST preserve this line AS IS (indentation matters).
                // Or maybe we want to normalize indentation?
                // User requirement: "formatter removes indentation... [in] table mode".
                // Implying they WANT indentation.
                // So if inContinuation, return `line` (raw).

                if (inContinuation) {
                    // Check if THIS line ends continuation?
                    // Count backslashes at end of RAW line or TRIMMED line?
                    // Trimmed line usually safest for checking trailing char.

                    let slashCount = 0;
                    for (let i = trimmed.length - 1; i >= 0; i--) {
                        if (trimmed[i] === '\\') slashCount++;
                        else break;
                    }
                    if (slashCount % 2 === 0) {
                        inContinuation = false;
                    }

                    // Align with the previous line's value start
                    return currentIndent + trimmed;
                }

                // Not in continuation. Is this a new property?
                const hasSeparator = trimmed.indexOf('=') !== -1 || trimmed.indexOf(':') !== -1;

                if (!hasSeparator) {
                    // No separator. Could be key-only property OR a line that should have been continuation but wasn't detected?
                    // Treat as raw line.
                    return line;
                }

                // Check if this line starts a continuation
                let slashCount = 0;
                for (let i = trimmed.length - 1; i >= 0; i--) {
                    if (trimmed[i] === '\\') slashCount++;
                    else break;
                }
                if (slashCount % 2 === 1) {
                    inContinuation = true;
                }

                // Format "Key = Value"
                // Split on first = or :
                const eqIdx = line.indexOf('=');
                const colIdx = line.indexOf(':');
                let sepIdx = eqIdx;
                let sepChar = '=';

                if (eqIdx === -1) { sepIdx = colIdx; sepChar = ':'; }
                else if (colIdx !== -1 && colIdx < eqIdx) { sepIdx = colIdx; sepChar = ':'; }

                const key = line.substring(0, sepIdx).trim();
                const value = line.substring(sepIdx + 1).trim();

                const formattedLine = `${key} ${sepChar} ${value}`;

                // Calculate indent for next lines: length of key + sep + spaces
                // "key = " -> length is key.length + 1 (space) + 1 (sep) + 1 (space)
                // If using tabs? assuming spaces for now.
                const indentLength = key.length + 3; // " = " is 3 chars
                currentIndent = ' '.repeat(indentLength);

                return formattedLine;
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

const countTrailingBackslashes = (str = '') => {
    let count = 0;
    let i = str.length - 1;
    while (i >= 0 && str[i] === '\\') {
        count++;
        i--;
    }

    return count;
};

const extractExistingPropertyKeys = (text = '') => {
    const keys = new Set();
    const lines = text.split('\n');
    let inContinuation = false;

    lines.forEach(line => {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) {
            return;
        }

        if (inContinuation) {
            if (countTrailingBackslashes(line) % 2 === 0) {
                inContinuation = false;
            }

            return;
        }

        const eqIdx = line.indexOf('=');
        const colIdx = line.indexOf(':');
        let separatorIndex = -1;

        if (eqIdx === -1 && colIdx === -1) {
            keys.add(trimmed);
        } else {
            separatorIndex = eqIdx === -1 ? colIdx : (colIdx === -1 ? eqIdx : Math.min(eqIdx, colIdx));
            keys.add(line.substring(0, separatorIndex).trim());
        }

        if (countTrailingBackslashes(line) % 2 === 1) {
            inContinuation = true;
        }
    });

    return keys;
};

const getYamlTopLevelEntry = (line = '', lineNumber = 1) => {
    const trailingTrimmedLine = line.replace(/\s+$/, '');
    const trimmed = trailingTrimmedLine.trim();

    if (!trimmed || trimmed.startsWith('#')) {
        return null;
    }

    const leadingIndent = trailingTrimmedLine.length - trailingTrimmedLine.trimStart().length;
    if (leadingIndent > 0) {
        return null;
    }

    const content = trailingTrimmedLine.slice(leadingIndent);
    if (content.startsWith('-')) {
        return null;
    }

    const colonIndex = content.indexOf(':');
    if (colonIndex <= 0) {
        return null;
    }

    const key = content.substring(0, colonIndex).trim();
    if (!key) {
        return null;
    }

    return {
        key,
        lineNumber,
        startColumn: leadingIndent + 1,
        endColumn: leadingIndent + key.length + 1,
        separatorColumn: leadingIndent + colonIndex + 1,
        line: trailingTrimmedLine
    };
};

const extractExistingYamlTopLevelKeys = (text = '') => {
    const keys = new Set();
    text.split('\n').forEach((line, index) => {
        const entry = getYamlTopLevelEntry(line, index + 1);
        if (entry?.key) {
            keys.add(entry.key);
        }
    });
    return keys;
};

const getYamlContext = (line, column) => {
    const leadingIndent = line.length - line.trimStart().length;
    const trimmed = line.trim();

    if (trimmed.startsWith('#') || leadingIndent > 0) {
        return null;
    }

    const content = line.slice(leadingIndent);
    if (content.trimStart().startsWith('-')) {
        return null;
    }

    const colonIndex = content.indexOf(':');
    if (trimmed === '' || colonIndex === -1 || column - 1 <= leadingIndent + colonIndex) {
        const keyStart = leadingIndent + 1;
        return {
            kind: 'key',
            key: line.slice(keyStart - 1, Math.max(keyStart - 1, column - 1)).trim(),
            range: {
                startColumn: keyStart,
                endColumn: Math.max(keyStart, column)
            }
        };
    }

    const key = content.substring(0, colonIndex).trim();
    const valuePrefix = content.substring(colonIndex + 1, Math.max(colonIndex + 1, column - leadingIndent - 1));
    const leadingWhitespace = (valuePrefix.match(/^\s*/) || [''])[0].length;
    const valueStartColumn = leadingIndent + colonIndex + leadingWhitespace + 2;

    return {
        kind: 'value',
        key,
        range: {
            startColumn: valueStartColumn,
            endColumn: Math.max(valueStartColumn, column)
        }
    };
};

const getYamlHoverContext = (model, position) => {
    const entry = getYamlTopLevelEntry(model.getLineContent(position.lineNumber), position.lineNumber);
    if (!entry) {
        return null;
    }

    if (position.column < entry.startColumn || position.column > entry.endColumn) {
        return null;
    }

    return {
        key: entry.key,
        range: new monaco.Range(position.lineNumber, entry.startColumn, position.lineNumber, entry.endColumn)
    };
};

const getPropertyContext = (line, column) => {
    const linePrefix = line.slice(0, Math.max(0, column - 1));
    const trimmedPrefix = linePrefix.trim();
    if (trimmedPrefix.startsWith('#') || trimmedPrefix.startsWith('!')) {
        return null;
    }

    const eqIdx = line.indexOf('=');
    const colIdx = line.indexOf(':');
    const separatorIndex = eqIdx === -1 ? colIdx : (colIdx === -1 ? eqIdx : Math.min(eqIdx, colIdx));

    if (separatorIndex === -1 || column - 1 <= separatorIndex) {
        const keyStart = (line.match(/^\s*/) || [''])[0].length + 1;
        return {
            kind: 'key',
            key: linePrefix.trim(),
            range: {
                startColumn: keyStart,
                endColumn: Math.max(keyStart, column)
            },
            hasSeparator: separatorIndex !== -1
        };
    }

    const key = line.substring(0, separatorIndex).trim();
    const beforeValue = line.substring(0, separatorIndex + 1);
    const valuePrefix = line.substring(separatorIndex + 1, Math.max(separatorIndex + 1, column - 1));
    const leadingWhitespace = (valuePrefix.match(/^\s*/) || [''])[0].length;

    return {
        kind: 'value',
        key,
        range: {
            startColumn: beforeValue.length + leadingWhitespace + 1,
            endColumn: Math.max(beforeValue.length + leadingWhitespace + 1, column)
        }
    };
};

const getHoverContext = (model, position) => {
    const line = model.getLineContent(position.lineNumber);
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) {
        return null;
    }

    const eqIdx = line.indexOf('=');
    const colIdx = line.indexOf(':');
    const separatorIndex = eqIdx === -1 ? colIdx : (colIdx === -1 ? eqIdx : Math.min(eqIdx, colIdx));
    const keyEnd = separatorIndex === -1 ? line.length : separatorIndex;
    const keyStart = (line.match(/^\s*/) || [''])[0].length;
    const key = line.substring(0, keyEnd).trim();

    if (!key) {
        return null;
    }

    if (position.column - 1 < keyStart || position.column - 1 > keyEnd) {
        return null;
    }

    return {
        key,
        range: new monaco.Range(position.lineNumber, keyStart + 1, position.lineNumber, keyEnd + 1)
    };
};

const getInsertionText = property => {
    const defaultValue = formatDefaultValue(property);
    return `${property.id} = ${defaultValue}`;
};

const formatYamlScalar = (value, property) => {
    if (value === undefined || value === null) {
        return '';
    }

    const stringValue = String(value);
    if (stringValue === '') {
        return "''";
    }

    const type = property?.type;
    if (['boolean', 'byte', 'short', 'integer', 'long', 'float', 'double'].includes(type)) {
        return stringValue;
    }

    if (/^[A-Za-z0-9._/-]+$/.test(stringValue)) {
        return stringValue;
    }

    return JSON.stringify(stringValue);
};

const getYamlInsertionText = property => {
    const defaultValues = Array.isArray(property?.defaultValues) ? property.defaultValues.filter(value => value !== undefined && value !== null) : [];
    const isMultiValued = property?.cardinality !== 0 || defaultValues.length > 1;

    if (isMultiValued) {
        if (defaultValues.length > 0) {
            return `${property.id}:\n${defaultValues.map(value => `  - ${formatYamlScalar(value, property)}`).join('\n')}`;
        }

        return `${property.id}:\n  - `;
    }

    const defaultValue = defaultValues[0];
    return `${property.id}: ${defaultValue !== undefined ? formatYamlScalar(defaultValue, property) : ''}`;
};

const getValueSuggestions = (property, t) => {
    if (!property) {
        return [];
    }

    const suggestions = [];
    const seen = new Set();
    const pushSuggestion = suggestion => {
        const key = `${suggestion.insertText}::${suggestion.detail || ''}`;
        if (!seen.has(key)) {
            seen.add(key);
            suggestions.push({
                documentation: {
                    value: buildPropertyDocumentation(property, t)
                },
                ...suggestion
            });
        }
    };

    if (Array.isArray(property.options) && property.options.length > 0) {
        property.options.forEach(option => {
            pushSuggestion({
                label: option.label || option.value,
                kind: monaco.languages.CompletionItemKind.EnumMember,
                detail: t('editor.metatype.suggestion.allowedValue'),
                insertText: option.value
            });
        });

        return suggestions;
    }

    if (property.type === 'boolean') {
        ['true', 'false'].forEach(option => {
            pushSuggestion({
                label: option,
                kind: monaco.languages.CompletionItemKind.Value,
                detail: getLocalizedTypeLabel(property.type, t),
                insertText: option
            });
        });
    }

    const defaultValues = Array.isArray(property.defaultValues) ? property.defaultValues.filter(Boolean) : [];
    defaultValues.forEach(defaultValue => {
        pushSuggestion({
            label: defaultValue,
            kind: monaco.languages.CompletionItemKind.Value,
            detail: t('editor.metatype.suggestion.defaultValue'),
            insertText: defaultValue
        });
    });

    if (defaultValues.length > 1) {
        const joinedDefaultValue = defaultValues.join(', ');
        pushSuggestion({
            label: joinedDefaultValue,
            kind: monaco.languages.CompletionItemKind.Value,
            detail: t('editor.metatype.suggestion.defaultValues'),
            insertText: joinedDefaultValue
        });
    }

    if (suggestions.length > 0) {
        return suggestions;
    }

    switch (property.type) {
        case 'byte':
        case 'short':
        case 'integer':
        case 'long':
            pushSuggestion({
                label: '0',
                kind: monaco.languages.CompletionItemKind.Value,
                detail: getLocalizedTypeLabel(property.type, t),
                insertText: '0'
            });
            break;
        case 'float':
        case 'double':
            pushSuggestion({
                label: '0.0',
                kind: monaco.languages.CompletionItemKind.Value,
                detail: getLocalizedTypeLabel(property.type, t),
                insertText: '0.0'
            });
            break;
        case 'character':
            pushSuggestion({
                label: 'a',
                kind: monaco.languages.CompletionItemKind.Value,
                detail: getLocalizedTypeLabel(property.type, t),
                insertText: 'a'
            });
            break;
        default:
            break;
    }

    return suggestions;
};

const getYamlValueSuggestions = (property, t) => (
    getValueSuggestions(property, t).map(suggestion => ({
        ...suggestion,
        insertText: formatYamlScalar(suggestion.insertText, property)
    }))
);

export const MonacoEditor = ({ value, onChange, onValidate, language = 'yaml', onSwitchMode, metatypeDefinition, filename }) => {
    const { t } = useTranslation('osgi-configurations-manager');
    const containerRef = useRef(null);
    const editorRef = useRef(null);
    const validatePropertiesRef = useRef(() => {});
    const [showPropertyPanel, setShowPropertyPanel] = useState(false);
    const [propertySearch, setPropertySearch] = useState('');
    const supportsMetatypeAssistance = (language === 'properties' || language === 'yaml') &&
        Array.isArray(metatypeDefinition?.properties) &&
        metatypeDefinition.properties.length > 0;
    const propertyMap = useMemo(() => {
        const entries = Array.isArray(metatypeDefinition?.properties)
            ? metatypeDefinition.properties.map(property => [property.id, property])
            : [];
        return new Map(entries);
    }, [metatypeDefinition]);
    const propertyMapRef = useRef(propertyMap);
    const hasMetatypeRef = useRef(supportsMetatypeAssistance);
    const existingKeys = useMemo(() => (
        language === 'yaml' ? extractExistingYamlTopLevelKeys(value) : extractExistingPropertyKeys(value)
    ), [language, value]);
    const filteredProperties = useMemo(() => {
        if (!supportsMetatypeAssistance) {
            return [];
        }

        const search = propertySearch.trim().toLowerCase();
        const properties = metatypeDefinition.properties || [];
        if (!search) {
            return properties;
        }

        return properties.filter(property => matchesMetatypePropertyQuery(property, search));
    }, [supportsMetatypeAssistance, metatypeDefinition, propertySearch]);
    const exactSearchMatch = useMemo(() => (
        findExactMetatypePropertyMatch(metatypeDefinition?.properties || [], propertySearch)
    ), [metatypeDefinition, propertySearch]);

    useEffect(() => {
        setPropertySearch('');
        setShowPropertyPanel(false);
    }, [filename]);

    useEffect(() => {
        propertyMapRef.current = propertyMap;
        hasMetatypeRef.current = supportsMetatypeAssistance;

        if ((language === 'properties' || language === 'yaml') && editorRef.current) {
            validatePropertiesRef.current();
        }
    }, [supportsMetatypeAssistance, language, propertyMap, t]);

    useEffect(() => {
        if (!editorRef.current) {
            return;
        }

        editorRef.current.updateOptions({
            wordBasedSuggestions: (language === 'properties' || (language === 'yaml' && supportsMetatypeAssistance)) ? 'off' : 'matchingDocuments'
        });
    }, [language, supportsMetatypeAssistance]);

    useEffect(() => {
        if (containerRef.current) {
            editorRef.current = monaco.editor.create(containerRef.current, {
                value: value,
                language: language,
                theme: language === 'properties' ? 'properties-theme' : 'vs-light',
                wordBasedSuggestions: language === 'properties' ? 'off' : 'matchingDocuments',
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
                const validateYamlMetatype = () => {
                    const model = editorRef.current?.getModel();
                    if (!model) {
                        return;
                    }

                    const currentPropertyMap = propertyMapRef.current;
                    const currentHasMetatype = hasMetatypeRef.current;
                    const markers = [];
                    const seenKeys = new Map();

                    if (currentHasMetatype) {
                        model.getValue().split('\n').forEach((line, index) => {
                            const entry = getYamlTopLevelEntry(line, index + 1);
                            if (!entry) {
                                return;
                            }

                            if (seenKeys.has(entry.key)) {
                                markers.push({
                                    severity: monaco.MarkerSeverity.Warning,
                                    startLineNumber: entry.lineNumber,
                                    startColumn: entry.startColumn,
                                    endLineNumber: entry.lineNumber,
                                    endColumn: line.length + 1,
                                    message: t('editor.validation.duplicateKey', { key: entry.key })
                                });
                            } else {
                                seenKeys.set(entry.key, entry.lineNumber);
                            }

                            if (!currentPropertyMap.has(entry.key)) {
                                markers.push({
                                    severity: monaco.MarkerSeverity.Warning,
                                    startLineNumber: entry.lineNumber,
                                    startColumn: entry.startColumn,
                                    endLineNumber: entry.lineNumber,
                                    endColumn: line.length + 1,
                                    message: t('editor.validation.unknownMetatypeProperty', { key: entry.key })
                                });
                            }
                        });
                    }

                    monaco.editor.setModelMarkers(model, 'yaml-metatype', markers);

                    if (onValidate) {
                        const allMarkers = monaco.editor.getModelMarkers({ resource: model.uri });
                        const hasErrors = allMarkers.some(marker => marker.severity === monaco.MarkerSeverity.Error);
                        onValidate(!hasErrors);
                    }
                };

                validatePropertiesRef.current = validateYamlMetatype;
                validateYamlMetatype();

                subscription.dispose();

                const changeListener = editorRef.current.onDidChangeModelContent(() => {
                    validateYamlMetatype();
                    const newValue = editorRef.current.getValue();
                    onChange(newValue);
                });

                const yamlMarkersListener = monaco.editor.onDidChangeMarkers(changedResources => {
                    const model = editorRef.current?.getModel();
                    if (!model) {
                        return;
                    }

                    const currentUri = model.uri.toString();
                    const isCurrentModelUpdated = changedResources.some(resource => resource.toString() === currentUri);
                    if (!isCurrentModelUpdated || !onValidate) {
                        return;
                    }

                    const markers = monaco.editor.getModelMarkers({ resource: model.uri });
                    const hasErrors = markers.some(marker => marker.severity === monaco.MarkerSeverity.Error);
                    onValidate(!hasErrors);
                });

                markerSubscription = {
                    dispose: () => {
                        changeListener.dispose();
                        yamlMarkersListener.dispose();
                    }
                };
            } else if (language === 'properties') {
                // Custom validation for properties
                const validateProperties = () => {
                    const model = editorRef.current.getModel();
                    if (!model) return;

                    const text = model.getValue();
                    const lines = text.split('\n');
                    const markers = [];
                    const seenKeys = new Map(); // key -> lineIndex
                    const currentPropertyMap = propertyMapRef.current;
                    const currentHasMetatype = hasMetatypeRef.current;

                    const countTrailingBackslashes = (str) => {
                        let count = 0;
                        let i = str.length - 1;
                        while (i >= 0 && str[i] === '\\') {
                            count++;
                            i--;
                        }
                        return count;
                    };

                    let inContinuation = false;

                    lines.forEach((line, index) => {
                        const trimmed = line.trim();

                        // Comments are ignored and do not interrupt continuation logic in standard java properties,
                        // assuming they are removed from the stream.
                        if (trimmed && (trimmed.startsWith('#') || trimmed.startsWith('!'))) {
                            return;
                        }

                        if (!trimmed) {
                            return;
                        }

                        if (inContinuation) {
                            // Check if this line continues
                            const slashCount = countTrailingBackslashes(line);
                            if (slashCount % 2 === 0) {
                                inContinuation = false;
                            }
                            // No validation needed for continuation line content
                            return;
                        }

                        // Check for lines starting with separator = or : (invalid key)
                        // OR lines without any separator (invalid format, key must have value assignment)
                        // But ignore comments (#, !) and empty lines
                        if (trimmed.startsWith('=') || trimmed.startsWith(':')) {
                            markers.push({
                                severity: monaco.MarkerSeverity.Error,
                                startLineNumber: index + 1,
                                startColumn: 1,
                                endLineNumber: index + 1,
                                endColumn: line.length + 1,
                                message: t('editor.validation.missingKey'),
                            });
                        } else {
                            let key = '';
                            const eqIdx = line.indexOf('=');
                            const colIdx = line.indexOf(':');
                            if (eqIdx === -1 && colIdx === -1) {
                                // key with empty value (technically valid per spec 4.4)
                                key = trimmed;
                            } else {
                                // Extract key
                                let sepIdx = eqIdx;
                                if (eqIdx === -1) sepIdx = colIdx;
                                else if (colIdx !== -1) sepIdx = Math.min(eqIdx, colIdx);

                                key = line.substring(0, sepIdx).trim();
                            }

                            if (seenKeys.has(key)) {
                                markers.push({
                                    severity: monaco.MarkerSeverity.Warning,
                                    startLineNumber: index + 1,
                                    startColumn: 1,
                                    endLineNumber: index + 1,
                                    endColumn: line.length + 1,
                                    message: t('editor.validation.duplicateKey', { key }),
                                });
                            } else {
                                seenKeys.set(key, index);
                            }

                            if (currentHasMetatype && key && !currentPropertyMap.has(key)) {
                                markers.push({
                                    severity: monaco.MarkerSeverity.Warning,
                                    startLineNumber: index + 1,
                                    startColumn: 1,
                                    endLineNumber: index + 1,
                                    endColumn: line.length + 1,
                                    message: t('editor.validation.unknownMetatypeProperty', { key }),
                                });
                            }

                            // Check if this new property initiates a continuation
                            const slashCount = countTrailingBackslashes(line);
                            if (slashCount % 2 === 1) {
                                inContinuation = true;
                            }
                        }
                    });

                    monaco.editor.setModelMarkers(model, 'properties', markers);

                    if (onValidate) {
                        const hasErrors = markers.some(marker => marker.severity === monaco.MarkerSeverity.Error);
                        onValidate(!hasErrors);
                    }
                };

                validatePropertiesRef.current = validateProperties;

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
                // subscription is disposed manually for properties/yaml custom listeners
                if (language !== 'properties' && language !== 'yaml') {
                    subscription.dispose();
                }
                validatePropertiesRef.current = () => {};
                markerSubscription.dispose();
                resizeObserver.disconnect();
                if (editorRef.current) editorRef.current.dispose();
            };
        }
    }, [language]); // Re-create if language changes (rare)

    useEffect(() => {
        if ((language !== 'properties' && language !== 'yaml') || !editorRef.current) {
            return;
        }

        const editor = editorRef.current;
        const completionProvider = monaco.languages.registerCompletionItemProvider(language, {
            triggerCharacters: language === 'yaml' ? [':', ' '] : ['=', ':', ' '],
            provideCompletionItems: (model, position) => {
                if (!supportsMetatypeAssistance) {
                    return { suggestions: [] };
                }

                const line = model.getLineContent(position.lineNumber);
                const context = language === 'yaml'
                    ? getYamlContext(line, position.column)
                    : getPropertyContext(line, position.column);
                if (!context) {
                    return { suggestions: [] };
                }

                if (context.kind === 'key') {
                    const showFullLineInsert = line.trim() === '';
                    const suggestions = (metatypeDefinition.properties || []).map(property => ({
                        label: property.id,
                        kind: monaco.languages.CompletionItemKind.Property,
                        detail: property.type ? getLocalizedTypeLabel(property.type, t) : getPropertyLabel(property),
                        documentation: {
                            value: buildPropertyDocumentation(property, t)
                        },
                        insertText: showFullLineInsert
                            ? (language === 'yaml' ? getYamlInsertionText(property) : getInsertionText(property))
                            : property.id,
                        range: new monaco.Range(
                            position.lineNumber,
                            context.range.startColumn,
                            position.lineNumber,
                            context.range.endColumn
                        )
                    }));

                    return { suggestions };
                }

                const property = propertyMap.get(context.key);
                if (!property) {
                    return { suggestions: [] };
                }

                const valueSuggestions = language === 'yaml'
                    ? getYamlValueSuggestions(property, t)
                    : getValueSuggestions(property, t);

                return {
                    suggestions: valueSuggestions.map(suggestion => ({
                        ...suggestion,
                        range: new monaco.Range(
                            position.lineNumber,
                            context.range.startColumn,
                            position.lineNumber,
                            context.range.endColumn
                        )
                    }))
                };
            }
        });

        const hoverProvider = monaco.languages.registerHoverProvider(language, {
            provideHover: (model, position) => {
                if (!supportsMetatypeAssistance) {
                    return null;
                }

                const hoverContext = language === 'yaml'
                    ? getYamlHoverContext(model, position)
                    : getHoverContext(model, position);
                if (!hoverContext) {
                    return null;
                }

                const property = propertyMap.get(hoverContext.key);
                if (!property) {
                    return null;
                }

                return {
                    range: hoverContext.range,
                    contents: [{ value: buildPropertyDocumentation(property, t) }]
                };
            }
        });

        const autoSuggestOnNewLine = editor.onDidChangeModelContent(event => {
            if (!supportsMetatypeAssistance || !event.changes.some(change => change.text.includes('\n'))) {
                return;
            }

            const model = editor.getModel();
            const position = editor.getPosition();
            if (!model || !position) {
                return;
            }

            const line = model.getLineContent(position.lineNumber);
            if (line.trim() === '') {
                window.requestAnimationFrame(() => editor.trigger('metatype', 'editor.action.triggerSuggest', {}));
            }
        });

        return () => {
            completionProvider.dispose();
            hoverProvider.dispose();
            autoSuggestOnNewLine.dispose();
        };
    }, [supportsMetatypeAssistance, language, metatypeDefinition, propertyMap, t]);

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

    const insertProperty = property => {
        const editor = editorRef.current;
        if (!editor || !property) {
            return;
        }

        const model = editor.getModel();
        const position = editor.getPosition();
        if (!model || !position) {
            return;
        }

        const currentLine = model.getLineContent(position.lineNumber);
        const insertionText = language === 'yaml' ? getYamlInsertionText(property) : getInsertionText(property);
        const lineIsEmpty = currentLine.trim() === '';
        const text = lineIsEmpty ? insertionText : `\n${insertionText}`;
        const range = lineIsEmpty
            ? new monaco.Range(position.lineNumber, 1, position.lineNumber, currentLine.length + 1)
            : new monaco.Range(position.lineNumber, currentLine.length + 1, position.lineNumber, currentLine.length + 1);

        editor.executeEdits('metatype', [{ range, text }]);
        editor.focus();
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
                <Button label={t('editor.button.undo')} variant="ghost" icon={<Undo style={{ width: '16px', height: '16px' }} />} onClick={handleUndo} title={t('tooltip.undo')} />
                <Button label={t('editor.button.redo')} variant="ghost" icon={<RotateRight style={{ width: '16px', height: '16px' }} />} onClick={handleRedo} title={t('tooltip.redo')} />
                <div style={{ width: '1px', background: '#ccc', margin: '0 4px', height: '20px' }} />
                <Button label={t('editor.button.format')} variant="ghost" icon={<Code style={{ width: '16px', height: '16px' }} />} onClick={handleFormat} title={t('tooltip.format')} />

                {/* Encrypt/Decrypt Buttons for Text Mode */}
                <div style={{ width: '1px', background: '#ccc', margin: '0 4px', height: '20px' }} />
                <Button label={t('editor.button.encrypt')} variant="ghost" icon={<Lock style={{ width: '16px', height: '16px' }} />} onClick={handleEncryptSelection} title={t('tooltip.encryptSelection')} />
                <Button label={t('editor.button.decrypt')} variant="ghost" icon={<Unlock style={{ width: '16px', height: '16px' }} />} onClick={handleDecryptSelection} title={t('tooltip.decryptSelection')} />

                {(language === 'properties' || language === 'yaml') && (
                    <>
                        <div style={{ width: '1px', background: '#ccc', margin: '0 4px', height: '20px' }} />
                        <Button
                            data-cy="editor-add-metatype-property"
                            label={t('editor.button.addMetatypeProperty')}
                            variant="ghost"
                            onClick={() => supportsMetatypeAssistance && setShowPropertyPanel(true)}
                            disabled={!supportsMetatypeAssistance}
                            title={supportsMetatypeAssistance ? t('tooltip.addMetatypeProperty') : t('tooltip.addMetatypePropertyDisabled')}
                        />
                    </>
                )}

                {onSwitchMode && (
                    <>
                        <div style={{ width: '1px', background: '#ccc', margin: '0 4px', height: '20px' }} />
                        <Button
                            label={t('editor.button.modeVisual')}
                            variant="ghost"
                            icon={<ViewList style={{ width: '16px', height: '16px' }} />}
                            onClick={onSwitchMode}
                            title={t('tooltip.modeVisual')}
                        />
                    </>
                )}
            </div>

            <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: '12px' }}>
                <div
                    style={{
                        flex: '1 1 auto',
                        position: 'relative',
                        minWidth: 0
                    }}
                >
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

                {showPropertyPanel && supportsMetatypeAssistance && (
                    <div data-cy="metatype-property-panel" style={{
                        flex: '0 0 340px',
                        width: '340px',
                        borderLeft: '1px solid var(--color-gray_light40)',
                        paddingLeft: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 0
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                            <div style={{ minWidth: 0 }}>
                                <Typography variant="body" weight="bold">{t('editor.metatype.availableProperties')}</Typography>
                                {metatypeDefinition?.name && (
                                    <Typography variant="caption" color="textSecondary">{metatypeDefinition.name}</Typography>
                                )}
                            </div>
                            <Button
                                label={t('editor.button.hideAvailableProperties')}
                                variant="ghost"
                                onClick={() => setShowPropertyPanel(false)}
                            />
                        </div>

                        {metatypeDefinition?.description && (
                            <Typography variant="caption" color="textSecondary" style={{ marginBottom: '12px' }}>
                                {metatypeDefinition.description}
                            </Typography>
                        )}

                        <input
                            value={propertySearch}
                            onChange={event => setPropertySearch(event.target.value)}
                            onKeyDown={event => {
                                if (event.key !== 'Enter') {
                                    return;
                                }

                                if (exactSearchMatch) {
                                    insertProperty(exactSearchMatch);
                                } else if (filteredProperties.length === 1) {
                                    insertProperty(filteredProperties[0]);
                                }
                            }}
                            placeholder={t('editor.metatype.searchPlaceholder')}
                            style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                border: '1px solid var(--color-gray_light40)',
                                borderRadius: '4px',
                                padding: '8px 10px',
                                marginBottom: '12px'
                            }}
                        />

                        <div style={{ overflow: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {filteredProperties.length === 0 && (
                                <Typography variant="caption" color="textSecondary">
                                    {t('editor.metatype.noResults')}
                                </Typography>
                            )}

                            {filteredProperties.map(property => {
                                const alreadyPresent = existingKeys.has(property.id);
                                const defaultValue = formatDefaultValue(property);

                                return (
                                    <div data-cy={`metatype-property-card-${encodeURIComponent(property.id)}`} key={property.id} style={{
                                        border: '1px solid var(--color-gray_light40)',
                                        borderRadius: '6px',
                                        padding: '10px',
                                        background: alreadyPresent ? 'var(--color-gray_light20)' : '#fff'
                                    }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div
                                                style={{ minWidth: 0, cursor: alreadyPresent ? 'default' : 'pointer' }}
                                                onDoubleClick={() => {
                                                    if (!alreadyPresent) {
                                                        insertProperty(property);
                                                    }
                                                }}
                                            >
                                                <Typography
                                                    variant="body"
                                                    weight="bold"
                                                    style={{ display: 'block', overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                                                >
                                                    {property.id}
                                                </Typography>
                                                {property.name && property.name !== property.id && (
                                                    <Typography
                                                        variant="caption"
                                                        color="textSecondary"
                                                        style={{ display: 'block', overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                                                    >
                                                        {property.name}
                                                    </Typography>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                <Button
                                                    data-cy={`metatype-property-insert-${encodeURIComponent(property.id)}`}
                                                    label={alreadyPresent ? t('editor.metatype.alreadyPresent') : t('editor.metatype.insert')}
                                                    variant="ghost"
                                                    disabled={alreadyPresent}
                                                    onClick={() => insertProperty(property)}
                                                />
                                            </div>
                                        </div>

                                        {property.description && (
                                            <Typography variant="caption" style={{ display: 'block', marginTop: '8px' }}>
                                                {property.description}
                                            </Typography>
                                        )}

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                                            {property.type && (
                                                <Typography variant="caption" color="textSecondary">
                                                    {t('editor.metatype.type')}: {property.type}
                                                </Typography>
                                            )}
                                            <Typography variant="caption" color="textSecondary">
                                                {t('editor.metatype.optional')}: {property.optional ? t('editor.metatype.yes') : t('editor.metatype.no')}
                                            </Typography>
                                            {defaultValue && (
                                                <Typography variant="caption" color="textSecondary">
                                                    {t('editor.metatype.default')}: {defaultValue}
                                                </Typography>
                                            )}
                                            {Array.isArray(property.options) && property.options.length > 0 && (
                                                <Typography variant="caption" color="textSecondary">
                                                    {t('editor.metatype.values')}: {property.options.map(option => option.label || option.value).join(', ')}
                                                </Typography>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
