import React from 'react';
import {
    Button,
    Checkbox,
    Close,
    Input,
    Modal,
    ModalBody,
    ModalFooter,
    ModalHeader,
    Typography
} from '@jahia/moonstone';
import {useTranslation} from 'react-i18next';
import {CHROME_TOKENS, VISUALLY_HIDDEN_STYLE} from './AppChrome';
import {MIN_ARCHIVE_PASSWORD_LENGTH} from '../utils/archiveFile';

const STACK_STYLE = {display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0};
const FIELD_STYLE = {display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0};
const ROW_STYLE = {display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap'};
const ERROR_STYLE = {color: 'var(--color-danger_dark)'};
const HINT_STYLE = {color: CHROME_TOKENS.subtleTextColor};
const PLAIN_LIST_STYLE = {listStyle: 'none', margin: 0, padding: 0};
// A focusable region: a list longer than its box scrolls with the keyboard too (WCAG 2.1.1).
const SCROLL_LIST_STYLE = {
    ...PLAIN_LIST_STYLE,
    maxHeight: '40vh',
    overflowY: 'auto',
    border: `1px solid ${CHROME_TOKENS.panelBorderColor}`,
    borderRadius: '4px',
    padding: '4px 8px'
};
const CHECK_ROW_STYLE = {display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '6px 0', minHeight: '24px'};
const WRAP_STYLE = {overflowWrap: 'anywhere', wordBreak: 'break-word'};
const DETAILS_STYLE = {margin: '4px 0 0', paddingLeft: '20px', color: CHROME_TOKENS.subtleTextColor};
const CLOSE_BUTTON_STYLE = {position: 'absolute', top: 'var(--spacing-medium)', right: 'var(--spacing-medium)', zIndex: 1};
const COUNT_DELAY_MS = 400;

/**
 * The focus goes back to what opened the dialog when it closes: Moonstone's Modal gave it to <body>
 * (WCAG 2.4.3). Read while rendering, before the Modal moves the focus in; restored on the next
 * frame, so that the Enter that closed it does not activate the opener again.
 */
const useReturnFocus = isOpen => {
    const openerRef = React.useRef(null);
    if (isOpen && !openerRef.current && typeof document !== 'undefined') {
        openerRef.current = document.activeElement;
    }
    React.useEffect(() => {
        if (isOpen) {
            return;
        }
        const opener = openerRef.current;
        openerRef.current = null;
        window.requestAnimationFrame(() => {
            if (opener && opener !== document.body && opener.isConnected && typeof opener.focus === 'function'
                && (!document.activeElement || document.activeElement === document.body)) {
                opener.focus();
            }
        });
    }, [isOpen]);
};

/**
 * Moves the focus once the render that shows an error is done: focusing before it, the Modal's own
 * update could take the focus back to its first field. request(getElement) asks for it.
 */
const useFocusAfterRender = () => {
    const [request, setRequest] = React.useState(null);
    React.useEffect(() => {
        request?.getElement()?.focus();
    }, [request]);
    return React.useCallback(getElement => setRequest({getElement}), []);
};

/**
 * A count said a moment after the last change, not at every click (WCAG 4.1.3), and only once the
 * user changed something: said at opening, it cut off the dialog's own name.
 */
const useSettledText = (text, isActive) => {
    const [settled, setSettled] = React.useState('');
    React.useEffect(() => {
        if (!isActive) {
            setSettled('');
            return undefined;
        }
        const timer = window.setTimeout(() => setSettled(text), COUNT_DELAY_MS);
        return () => window.clearTimeout(timer);
    }, [text, isActive]);
    return settled;
};

/** A visible progress line, also announced: the button keeps its name while it works. */
const BusyStatus = ({text}) => (
    <div role="status">
        {text ? <Typography variant="caption" style={HINT_STYLE}>{text}</Typography> : null}
    </div>
);

const DialogFrame = ({dataCy, titleId, describedBy, title, children, footer, onClose}) => {
    const {t} = useTranslation('osgi-configurations-manager');
    return (
        <Modal
            data-cy={dataCy}
            // Named by its title only: Moonstone names the dialog by its whole content otherwise.
            aria-labelledby={titleId}
            aria-describedby={describedBy}
            isOpen
            size="large"
            onOpenChange={open => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <>
                <div style={{position: 'relative'}}>
                    <ModalHeader title={<span id={titleId}>{title}</span>}/>
                </div>
                <ModalBody>{children}</ModalBody>
                <ModalFooter>{footer}</ModalFooter>
                {/* Last in the DOM, drawn top right: the dialog's first control is its content. */}
                <div style={CLOSE_BUTTON_STYLE} data-cy={`${dataCy}-close`}>
                    <Button aria-label={t('modal.close')} icon={<Close/>} size="small" variant="ghost" onClick={onClose}/>
                </div>
            </>
        </Modal>
    );
};

const FieldError = ({id, children}) => (
    <Typography id={id} variant="caption" style={ERROR_STYLE}>
        <span aria-hidden="true">⚠ </span>{children}
    </Typography>
);

/**
 * Choose files and a password, and get one sealed archive. The secrets are in it in clear, under
 * the password: the dialog says so before anything is exported.
 */
export const ExportArchiveDialog = ({isOpen, files, onClose, onExport}) => {
    const {t} = useTranslation('osgi-configurations-manager');
    useReturnFocus(isOpen);
    const titleId = React.useId();
    const introId = React.useId();
    const filterId = React.useId();
    const listLabelId = React.useId();
    const selectionErrorId = React.useId();
    const passwordId = React.useId();
    const passwordHintId = React.useId();
    const passwordErrorId = React.useId();
    const confirmId = React.useId();
    const confirmErrorId = React.useId();
    const [filter, setFilter] = React.useState('');
    const [selected, setSelected] = React.useState(() => new Set());
    const [password, setPassword] = React.useState('');
    const [confirm, setConfirm] = React.useState('');
    const [errors, setErrors] = React.useState({});
    const [submitError, setSubmitError] = React.useState('');
    const [isExporting, setIsExporting] = React.useState(false);
    const [hasChanged, setHasChanged] = React.useState(false);
    const exportingRef = React.useRef(false);
    const focusAfterRender = useFocusAfterRender();

    React.useEffect(() => {
        if (!isOpen) {
            // The password does not outlive the dialog.
            setFilter('');
            setSelected(new Set());
            setPassword('');
            setConfirm('');
            setErrors({});
            setSubmitError('');
            setIsExporting(false);
            setHasChanged(false);
            exportingRef.current = false;
        }
    }, [isOpen]);

    const shown = React.useMemo(() => {
        const search = filter.trim().toLowerCase();
        return search ? files.filter(file => file.name.toLowerCase().includes(search)) : files;
    }, [files, filter]);

    const countText = t('archive.export.listCount', {shown: shown.length, count: selected.size, total: files.length});
    const settledCount = useSettledText(countText, isOpen && hasChanged);

    if (!isOpen) {
        return null;
    }

    const toggle = name => {
        setHasChanged(true);
        setSelected(previous => {
            const next = new Set(previous);
            if (next.has(name)) {
                next.delete(name);
            } else {
                next.add(name);
            }
            return next;
        });
        setErrors(previous => ({...previous, selection: undefined}));
    };

    const handleExport = async () => {
        if (exportingRef.current) {
            return;
        }
        const nextErrors = {};
        if (selected.size === 0) {
            nextErrors.selection = t('archive.export.errorNoSelection');
        }
        if (password.length < MIN_ARCHIVE_PASSWORD_LENGTH) {
            nextErrors.password = t('archive.password.errorTooShort', {count: MIN_ARCHIVE_PASSWORD_LENGTH});
        } else if (confirm !== password) {
            nextErrors.confirm = t('archive.password.errorMismatch');
        }
        setErrors(nextErrors);
        setSubmitError('');
        // The focus goes to the first field in error, which reads its message (WCAG 3.3.1).
        // The list itself, which is named and described by the error: its first checkbox is not.
        if (nextErrors.selection) {
            focusAfterRender(() => document.querySelector('[data-cy="archive-export-list"]'));
            return;
        }
        if (nextErrors.password || nextErrors.confirm) {
            focusAfterRender(() => document.getElementById(nextErrors.password ? passwordId : confirmId));
            return;
        }
        exportingRef.current = true;
        setIsExporting(true);
        try {
            // In the files' order, not the order they were ticked.
            await onExport(files.map(file => file.name).filter(name => selected.has(name)), password);
        } catch (e) {
            setSubmitError(e?.message ? String(e.message) : String(e));
        } finally {
            exportingRef.current = false;
            setIsExporting(false);
        }
    };

    const footer = (
        <>
            <div data-cy="archive-export-cancel">
                <Button label={t('modal.cancel')} size="big" variant="ghost" onClick={onClose}/>
            </div>
            <div data-cy="archive-export-confirm">
                {/* aria-disabled while it runs: a disabled button would drop the focus to <body>. */}
                <Button
                    color="accent"
                    size="big"
                    label={t('archive.export.confirm')}
                    aria-disabled={isExporting || undefined}
                    onClick={handleExport}
                />
            </div>
        </>
    );

    return (
        <DialogFrame
            dataCy="archive-export-dialog"
            titleId={titleId}
            describedBy={introId}
            title={t('archive.export.title')}
            footer={footer}
            onClose={onClose}
        >
            <div style={STACK_STYLE}>
                <Typography id={introId} variant="body">{t('archive.export.intro')}</Typography>

                <div style={FIELD_STYLE}>
                    <label htmlFor={filterId}><Typography variant="body" weight="bold" component="span">{t('archive.export.filterLabel')}</Typography></label>
                    <Input
                        data-cy="archive-export-filter"
                        id={filterId}
                        value={filter}
                        variant="outlined"
                        onChange={event => {
                            setFilter(event.target.value);
                            setHasChanged(true);
                        }}
                    />
                </div>

                <div style={FIELD_STYLE}>
                    <div style={{...ROW_STYLE, justifyContent: 'space-between'}}>
                        <Typography id={listLabelId} variant="body" weight="bold">{t('archive.export.listLabel')}</Typography>
                        <div style={ROW_STYLE}>
                            <Button
                                data-cy="archive-export-select-shown"
                                label={t('archive.export.selectShown')}
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                    setHasChanged(true);
                                    setSelected(previous => new Set([...previous, ...shown.map(file => file.name)]));
                                    setErrors(previous => ({...previous, selection: undefined}));
                                }}
                            />
                            <Button
                                data-cy="archive-export-clear"
                                label={t('archive.export.clearSelection')}
                                size="small"
                                variant="ghost"
                                onClick={() => {
                                    setHasChanged(true);
                                    setSelected(new Set());
                                }}
                            />
                        </div>
                    </div>
                    {/* role="list": a list without bullets loses its role in Safari. */}
                    <ul
                        data-cy="archive-export-list"
                        role="list"
                        aria-labelledby={listLabelId}
                        aria-describedby={errors.selection ? selectionErrorId : undefined}
                        // Focusable so that a long list scrolls with the keyboard.
                        className="osgi-scroll-region"
                        tabIndex={0}
                        style={SCROLL_LIST_STYLE}
                    >
                        {shown.length === 0 && (
                            <li style={CHECK_ROW_STYLE}><Typography variant="body">{t('archive.export.noMatch')}</Typography></li>
                        )}
                        {shown.map(file => {
                            const id = `${listLabelId}-${encodeURIComponent(file.name)}`;
                            return (
                                <li key={file.name} style={CHECK_ROW_STYLE}>
                                    <Checkbox
                                        id={id}
                                        data-cy={`archive-export-file-${encodeURIComponent(file.name)}`}
                                        checked={selected.has(file.name)}
                                        onChange={() => toggle(file.name)}
                                    />
                                    <label htmlFor={id} style={WRAP_STYLE}>
                                        <Typography variant="body" component="span">{file.name}</Typography>
                                        {!file.enabled && <Typography variant="caption" component="span" style={HINT_STYLE}> {t('archive.export.disabledFile')}</Typography>}
                                    </label>
                                </li>
                            );
                        })}
                    </ul>
                    <Typography data-cy="archive-export-count" variant="caption" aria-hidden="true">{countText}</Typography>
                    <div role="status" style={VISUALLY_HIDDEN_STYLE}>{settledCount}</div>
                    {errors.selection && <FieldError id={selectionErrorId}>{errors.selection}</FieldError>}
                </div>

                <div style={FIELD_STYLE}>
                    <label htmlFor={passwordId}><Typography variant="body" weight="bold" component="span">{`${t('archive.password.label')} ${t('archive.required')}`}</Typography></label>
                    <Typography id={passwordHintId} variant="caption" style={HINT_STYLE}>
                        {t('archive.password.hint', {count: MIN_ARCHIVE_PASSWORD_LENGTH})}
                    </Typography>
                    <Input
                        data-cy="archive-export-password"
                        id={passwordId}
                        type="password"
                        autoComplete="new-password"
                        aria-required="true"
                        aria-invalid={Boolean(errors.password) || undefined}
                        aria-describedby={errors.password ? `${passwordHintId} ${passwordErrorId}` : passwordHintId}
                        value={password}
                        variant="outlined"
                        onChange={event => {
                            setPassword(event.target.value);
                            setErrors(previous => ({...previous, password: undefined}));
                        }}
                        onKeyDown={event => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                void handleExport();
                            }
                        }}
                    />
                    {errors.password && <FieldError id={passwordErrorId}>{errors.password}</FieldError>}
                </div>

                <div style={FIELD_STYLE}>
                    <label htmlFor={confirmId}><Typography variant="body" weight="bold" component="span">{`${t('archive.password.confirmLabel')} ${t('archive.required')}`}</Typography></label>
                    <Input
                        data-cy="archive-export-password-confirm"
                        id={confirmId}
                        type="password"
                        autoComplete="new-password"
                        aria-required="true"
                        aria-invalid={Boolean(errors.confirm) || undefined}
                        aria-describedby={errors.confirm ? confirmErrorId : undefined}
                        value={confirm}
                        variant="outlined"
                        onChange={event => {
                            setConfirm(event.target.value);
                            setErrors(previous => ({...previous, confirm: undefined}));
                        }}
                        onKeyDown={event => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                void handleExport();
                            }
                        }}
                    />
                    {errors.confirm && <FieldError id={confirmErrorId}>{errors.confirm}</FieldError>}
                </div>

                <BusyStatus text={isExporting ? t('archive.export.exporting') : ''}/>
                {/* Mounted empty first: an alert inserted with its text is not always announced. */}
                <div role="alert" data-cy="archive-export-error">
                    {submitError && <FieldError>{t('archive.export.error', {error: submitError})}</FieldError>}
                </div>
            </div>
        </DialogFrame>
    );
};

const COMPARISON_KEYS = {
    SAME: 'archive.preview.versionSame',
    OLDER: 'archive.preview.versionOlder',
    NEWER: 'archive.preview.versionNewer',
    DIFFERENT: 'archive.preview.versionDifferent',
    ABSENT: 'archive.preview.versionAbsent'
};

const bundleLabel = bundle => (bundle.name && bundle.name !== bundle.symbolicName
    ? `${bundle.name} (${bundle.symbolicName})`
    : bundle.symbolicName);

/** The informational lines of one file: what the import does, and what may surprise. */
const filePreviewNotes = (file, t) => {
    const notes = [];
    const versionsDiffer = (file.bundles || []).some(bundle => !['SAME', 'ABSENT'].includes(bundle.comparison));
    if (file.reference === 'NONE') {
        notes.push(t('archive.preview.ownerless'));
    } else if (file.reference === 'UNKNOWN') {
        notes.push(t('archive.preview.bundlesUnknown'));
    }
    (file.bundles || []).forEach(bundle => {
        const key = COMPARISON_KEYS[bundle.comparison] || COMPARISON_KEYS.DIFFERENT;
        const prefix = file.reference === 'METATYPE' ? t('archive.preview.describedBy') : t('archive.preview.usedBy');
        let note = `${prefix} ${bundleLabel(bundle)}: ${t(key, {
            archiveVersion: bundle.archiveVersion,
            targetVersion: bundle.targetVersion,
            interpolation: {escapeValue: false}
        })}`;
        if (bundle.targetVersion && bundle.targetActive === false) {
            note += ` ${t('archive.preview.notRunning')}`;
        }
        if (bundle.otherVersions?.length) {
            note += ` ${t('archive.preview.otherVersions', {versions: bundle.otherVersions.join(', '), interpolation: {escapeValue: false}})}`;
        }
        notes.push(note);
    });
    if (file.unknownKeys?.length) {
        notes.push(t('archive.preview.unknownKeys', {keys: file.unknownKeys.join(', '), interpolation: {escapeValue: false}}));
    } else if (versionsDiffer && !file.metatypeChecked) {
        notes.push(t('archive.preview.keysNotChecked'));
    }
    if (file.sameConfiguration?.length) {
        notes.push(t('archive.preview.sameConfiguration', {files: file.sameConfiguration.join(', '), interpolation: {escapeValue: false}}));
    }
    if (file.secrets) {
        notes.push(t('archive.preview.secrets', {count: file.secrets}));
    }
    if (file.undecryptable) {
        notes.push(t('archive.preview.undecryptable', {count: file.undecryptable}));
    }
    if (file.clearSecrets?.length) {
        notes.push(t('archive.preview.clearSecrets', {keys: file.clearSecrets.join(', '), interpolation: {escapeValue: false}}));
    }
    return notes;
};

const REFUSAL_KEYS = {
    INVALID_NAME: 'archive.preview.refusedName',
    MANAGER_CONFIGURATION: 'archive.preview.refusedManager',
    NOT_PERMITTED: 'archive.preview.refusedPermission'
};

/**
 * Import an archive in three steps: its password, then what the import would do file by file (the
 * review before anything is written, WCAG 3.3.4), then what was done. The version notes inform and
 * never block.
 */
export const ImportArchiveDialog = ({archive, onClose, onPreview, onImport}) => {
    const {t} = useTranslation('osgi-configurations-manager');
    const isOpen = Boolean(archive);
    useReturnFocus(isOpen);
    const titleId = React.useId();
    const introId = React.useId();
    const passwordId = React.useId();
    const passwordErrorId = React.useId();
    const listLabelId = React.useId();
    const selectionErrorId = React.useId();
    const [step, setStep] = React.useState('password');
    const [password, setPassword] = React.useState('');
    const [passwordError, setPasswordError] = React.useState('');
    const [preview, setPreview] = React.useState(null);
    const [selected, setSelected] = React.useState(() => new Set());
    const [selectionError, setSelectionError] = React.useState('');
    const [result, setResult] = React.useState(null);
    const [submitError, setSubmitError] = React.useState('');
    const [isBusy, setIsBusy] = React.useState(false);
    const busyRef = React.useRef(false);
    const summaryRef = React.useRef(null);
    const focusAfterRender = useFocusAfterRender();

    React.useEffect(() => {
        // A new archive, or the dialog closing: start again, and forget the password.
        setStep('password');
        setPassword('');
        setPasswordError('');
        setPreview(null);
        setSelected(new Set());
        setSelectionError('');
        setResult(null);
        setSubmitError('');
        setIsBusy(false);
        busyRef.current = false;
    }, [archive]);

    // Each step starts on its summary, which says what changed (WCAG 2.4.3, 4.1.3).
    React.useEffect(() => {
        if (step !== 'password') {
            summaryRef.current?.focus();
        }
    }, [step]);

    if (!isOpen) {
        return null;
    }

    const run = async action => {
        if (busyRef.current) {
            return;
        }
        busyRef.current = true;
        setIsBusy(true);
        try {
            await action();
        } finally {
            busyRef.current = false;
            setIsBusy(false);
        }
    };

    const handleCheck = () => run(async () => {
        if (password.length === 0) {
            setPasswordError(t('archive.password.errorEmpty'));
            focusAfterRender(() => document.getElementById(passwordId));
            return;
        }
        try {
            const answer = await onPreview(archive.base64, password);
            setPreview(answer);
            setSelected(new Set(answer.files.filter(file => file.allowed).map(file => file.name)));
            setPasswordError('');
            setStep('preview');
        } catch (e) {
            setPasswordError(e?.message ? String(e.message) : String(e));
            focusAfterRender(() => document.getElementById(passwordId));
        }
    });

    const handleImport = () => run(async () => {
        if (selected.size === 0) {
            setSelectionError(t('archive.import.errorNoSelection'));
            // The list itself, which is named and described by the error.
            focusAfterRender(() => document.querySelector('[data-cy="archive-import-list"]'));
            return;
        }
        setSubmitError('');
        try {
            const names = preview.files.map(file => file.name).filter(name => selected.has(name));
            setResult(await onImport(archive.base64, password, names));
            setPassword('');
            setStep('result');
        } catch (e) {
            setSubmitError(e?.message ? String(e.message) : String(e));
        }
    });

    const toggle = name => {
        setSelected(previous => {
            const next = new Set(previous);
            if (next.has(name)) {
                next.delete(name);
            } else {
                next.add(name);
            }
            return next;
        });
        setSelectionError('');
    };

    let body;
    let footer;
    if (step === 'password') {
        body = (
            <div style={STACK_STYLE}>
                <Typography id={introId} variant="body" style={WRAP_STYLE}>
                    {t('archive.import.intro', {fileName: archive.fileName, interpolation: {escapeValue: false}})}
                </Typography>
                <div style={FIELD_STYLE}>
                    <label htmlFor={passwordId}><Typography variant="body" weight="bold" component="span">{`${t('archive.password.label')} ${t('archive.required')}`}</Typography></label>
                    <Input
                        data-cy="archive-import-password"
                        id={passwordId}
                        type="password"
                        // The password the export saved: a password manager can fill it in (WCAG 3.3.8).
                        autoComplete="current-password"
                        autoFocus
                        aria-required="true"
                        aria-invalid={Boolean(passwordError) || undefined}
                        aria-describedby={passwordError ? passwordErrorId : undefined}
                        value={password}
                        variant="outlined"
                        onChange={event => {
                            setPassword(event.target.value);
                            setPasswordError('');
                        }}
                        onKeyDown={event => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                void handleCheck();
                            }
                        }}
                    />
                    {/* An alert as well: after Enter in the field, the focus does not move, and a
                        changed description alone is not read. */}
                    <div role="alert">
                        {passwordError && <FieldError id={passwordErrorId}>{passwordError}</FieldError>}
                    </div>
                </div>
                <BusyStatus text={isBusy ? t('archive.import.checking') : ''}/>
            </div>
        );
        footer = (
            <>
                <div data-cy="archive-import-cancel">
                    <Button label={t('modal.cancel')} size="big" variant="ghost" onClick={onClose}/>
                </div>
                <div data-cy="archive-import-check">
                    <Button
                        color="accent"
                        size="big"
                        label={t('archive.import.check')}
                        aria-disabled={isBusy || undefined}
                        onClick={handleCheck}
                    />
                </div>
            </>
        );
    } else if (step === 'preview') {
        const files = preview.files;
        const creating = files.filter(file => file.allowed && file.action === 'CREATE').length;
        const replacing = files.filter(file => file.allowed && file.action === 'OVERWRITE').length;
        const refused = files.filter(file => !file.allowed).length;
        const jahia = preview.jahia || {};
        const jahiaKey = COMPARISON_KEYS[jahia.comparison];
        body = (
            <div style={STACK_STYLE}>
                <div id={introId} ref={summaryRef} tabIndex={-1} data-cy="archive-import-summary" style={{...STACK_STYLE, gap: '8px', padding: '4px'}}>
                    <ul role="list" style={{...PLAIN_LIST_STYLE, display: 'flex', flexWrap: 'wrap', gap: '4px 16px'}}>
                        <li><Typography variant="body" weight="bold" component="span">{t('archive.preview.summaryFiles', {count: files.length})}</Typography></li>
                        <li><Typography variant="body" component="span">{t('archive.preview.summaryNew', {count: creating})}</Typography></li>
                        <li><Typography variant="body" component="span">{t('archive.preview.summaryOverwrite', {count: replacing})}</Typography></li>
                        <li><Typography variant="body" component="span">{t('archive.preview.summaryRefused', {count: refused})}</Typography></li>
                    </ul>
                    <Typography variant="body" style={WRAP_STYLE}>
                        {jahiaKey
                            ? `${t('archive.preview.jahia')} ${t(jahiaKey, {
                                archiveVersion: jahia.archiveVersion,
                                targetVersion: jahia.targetVersion,
                                interpolation: {escapeValue: false}
                            })}`
                            : t('archive.preview.jahiaUnknown')}
                    </Typography>
                    <Typography variant="caption" style={HINT_STYLE}>{t('archive.preview.informational')}</Typography>
                </div>
                <div style={FIELD_STYLE}>
                    <div style={{...ROW_STYLE, justifyContent: 'space-between'}}>
                        <Typography id={listLabelId} variant="body" weight="bold">{t('archive.import.listLabel')}</Typography>
                        <div style={ROW_STYLE}>
                            <Button
                                data-cy="archive-import-select-all"
                                label={t('archive.import.selectAll')}
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                    setSelected(new Set(files.filter(file => file.allowed).map(file => file.name)));
                                    setSelectionError('');
                                }}
                            />
                            <Button
                                data-cy="archive-import-clear"
                                label={t('archive.export.clearSelection')}
                                size="small"
                                variant="ghost"
                                onClick={() => setSelected(new Set())}
                            />
                        </div>
                    </div>
                    <ul
                        data-cy="archive-import-list"
                        role="list"
                        aria-labelledby={listLabelId}
                        aria-describedby={selectionError ? selectionErrorId : undefined}
                        className="osgi-scroll-region"
                        tabIndex={0}
                        style={SCROLL_LIST_STYLE}
                    >
                        {files.map(file => {
                            const id = `${listLabelId}-${encodeURIComponent(file.name)}`;
                            const notesId = `${id}-notes`;
                            const notes = file.allowed ? filePreviewNotes(file, t) : [];
                            return (
                                <li key={file.name} data-cy={`archive-import-file-${encodeURIComponent(file.name)}`} style={{...CHECK_ROW_STYLE, borderBottom: `1px solid ${CHROME_TOKENS.panelBorderColor}`}}>
                                    {file.allowed ? (
                                        <Checkbox
                                            id={id}
                                            checked={selected.has(file.name)}
                                            aria-describedby={notesId}
                                            onChange={() => toggle(file.name)}
                                        />
                                    ) : <span aria-hidden="true" style={{width: '16px', flexShrink: 0}}/>}
                                    <div style={{minWidth: 0, flex: 1}}>
                                        {file.allowed ? (
                                            <label htmlFor={id} style={WRAP_STYLE}>
                                                <Typography variant="body" weight="bold" component="span">{file.name}</Typography>
                                            </label>
                                        ) : (
                                            <Typography variant="body" weight="bold" component="span" style={WRAP_STYLE}>{file.name}</Typography>
                                        )}
                                        <div id={notesId}>
                                            {/* An overwrite says what is lost, in bold with a sign, not colour alone (WCAG 3.3.4). */}
                                            <Typography
                                                variant="caption"
                                                component="p"
                                                weight={file.allowed && file.action === 'OVERWRITE' ? 'bold' : 'default'}
                                                style={{margin: '2px 0 0', ...(file.allowed ? {} : ERROR_STYLE)}}
                                            >
                                                {file.allowed && file.action === 'OVERWRITE' && <span aria-hidden="true">⚠ </span>}
                                                {file.allowed
                                                    ? (file.action === 'OVERWRITE' ? t('archive.preview.replaces') : t('archive.preview.creates'))
                                                    : t(REFUSAL_KEYS[file.refusal] || REFUSAL_KEYS.NOT_PERMITTED)}
                                            </Typography>
                                            {notes.length > 0 && (
                                                <ul style={DETAILS_STYLE}>
                                                    {notes.map(note => (
                                                        <li key={note}><Typography variant="caption" component="span" style={WRAP_STYLE}>{note}</Typography></li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                    {selectionError && <FieldError id={selectionErrorId}>{selectionError}</FieldError>}
                </div>
                <BusyStatus text={isBusy ? t('archive.import.importing') : ''}/>
                <div role="alert" data-cy="archive-import-error">
                    {submitError && <FieldError>{t('archive.import.error', {error: submitError})}</FieldError>}
                </div>
            </div>
        );
        footer = (
            <>
                <div data-cy="archive-import-cancel">
                    <Button label={t('modal.cancel')} size="big" variant="ghost" onClick={onClose}/>
                </div>
                <div data-cy="archive-import-confirm">
                    <Button
                        color="accent"
                        size="big"
                        label={t('archive.import.confirm', {count: selected.size})}
                        aria-disabled={isBusy || undefined}
                        onClick={handleImport}
                    />
                </div>
            </>
        );
    } else {
        const imported = result?.imported || [];
        const failed = result?.failed || [];
        // What the review said to do after the import, said again where it is done (no memory needed).
        const toEncrypt = (preview?.files || []).filter(file => imported.includes(file.name) && file.clearSecrets?.length);
        body = (
            <div style={STACK_STYLE}>
                <div id={introId} ref={summaryRef} tabIndex={-1} data-cy="archive-import-result" style={{padding: '4px'}}>
                    <Typography variant="body" weight="bold">
                        {t('archive.import.resultSummary', {count: imported.length})}
                    </Typography>
                    {failed.length > 0 && (
                        <Typography variant="body" style={ERROR_STYLE}>
                            <span aria-hidden="true">⚠ </span>{t('archive.import.resultFailed', {count: failed.length})}
                        </Typography>
                    )}
                </div>
                {failed.length > 0 && (
                    <ul data-cy="archive-import-failures" style={{margin: 0, paddingLeft: '20px'}}>
                        {failed.map(failure => (
                            <li key={failure.name}>
                                <Typography variant="body" component="span" style={WRAP_STYLE}>{`${failure.name}: ${failure.error}`}</Typography>
                            </li>
                        ))}
                    </ul>
                )}
                {toEncrypt.length > 0 && (
                    <div data-cy="archive-import-to-encrypt">
                        <Typography variant="body" weight="bold">{t('archive.import.toEncrypt')}</Typography>
                        <ul style={{margin: 0, paddingLeft: '20px'}}>
                            {toEncrypt.map(file => (
                                <li key={file.name}>
                                    <Typography variant="body" component="span" style={WRAP_STYLE}>{`${file.name}: ${file.clearSecrets.join(', ')}`}</Typography>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                {imported.length > 0 && (
                    <ul data-cy="archive-import-imported" style={{margin: 0, paddingLeft: '20px'}}>
                        {imported.map(name => (
                            <li key={name}><Typography variant="body" component="span" style={WRAP_STYLE}>{name}</Typography></li>
                        ))}
                    </ul>
                )}
            </div>
        );
        footer = (
            <div data-cy="archive-import-done">
                {/* Done, not Close: the X at the top is Close (WCAG 2.4.6). */}
                <Button color="accent" size="big" label={t('archive.import.done')} onClick={onClose}/>
            </div>
        );
    }

    // Each step is named after what it does. The summary that takes the focus on the later steps is
    // not also the description, which would be read twice.
    const stepTitle = {password: 'archive.import.title', preview: 'archive.import.reviewTitle', result: 'archive.import.resultTitle'}[step];
    return (
        <DialogFrame
            dataCy="archive-import-dialog"
            titleId={titleId}
            describedBy={step === 'password' ? introId : undefined}
            title={t(stepTitle)}
            footer={footer}
            onClose={onClose}
        >
            {body}
        </DialogFrame>
    );
};
