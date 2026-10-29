# Web Accessibility Audit

An audit of web content, run on 2026-10-29. Read the executive summary for the verdict, the priorities section for what to do first, and the findings tables for detail.

## Metadata

What was audited, with what, and under which settings.

| Field | Value |
|---|---|
| Date | 2026-10-29 |
| Scope | 40 items |
| Skills run | alt-text-headings, aria-specialist, cognitive-accessibility, contrast-master, forms-specialist, keyboard-navigator, link-checker, live-region-controller, modal-specialist, playwright-scanner, tables-data-specialist |
| Tooling | node v22.22.0, a11y-mcp-server 7.1.0 |
| Scan configuration | defaults, no config file found |
| Checks counted | 306 |

Audited:

- `15 UI states: initial, .cfg visual editor, filter, add-property prompt, review diff, discard, raw editor, delete/disable confirmations, create dialog (3 tabs), .yml raw editor`
- `@jahia/moonstone 2.21.0 Modal/ModalHeader/ModalFooter/Tab/Paper/Typography (dist/index.js, read-only)`
- `@jahia/moonstone 2.21.0 rendered markup (dist/index.js, dist/TreeView-*.js, dist/Checkbox-*.js)`
- `Behaviour: Tab order, focus visibility, dialog focus in/return, Monaco Tab capture, Enter on list rows, widths 1280/1024/320, WCAG 1.4.12 text-spacing override`
- `http://localhost:8080/jahia/administration/osgi-configurations-manager (Jahia 8.2, Chromium headless, axe-core 4.x tags wcag2a/aa, wcag21a/aa, wcag22aa)`
- `http://localhost:8080/jahia/administration/osgi-configurations-manager (code review only)`
- `node_modules/@jahia/moonstone@2.21.0 (Input/BaseInput, SearchInput, Checkbox, Switch, Button, Modal, Tooltip, TableBodyCell)`
- `src/javascript/init.js`
- `src/javascript/osgiConfigManager/**/*.{jsx,tsx,js,ts} (excluding *.test.*) - 26 files, 7579 lines`
- `src/javascript/osgiConfigManager/App/api/osgiService.ts`
- `src/javascript/osgiConfigManager/App/components/*.{jsx,tsx}`
- `src/javascript/osgiConfigManager/App/components/ActionButton.jsx`
- `src/javascript/osgiConfigManager/App/components/AppChrome.jsx`
- `src/javascript/osgiConfigManager/App/components/AppHeaderBar.jsx`
- `src/javascript/osgiConfigManager/App/components/CfgEditor.jsx`
- `src/javascript/osgiConfigManager/App/components/CfgMetatypePropertyDialog.jsx`
- `src/javascript/osgiConfigManager/App/components/ConfigStateBadge.jsx`
- `src/javascript/osgiConfigManager/App/components/Dialogs.jsx`
- `src/javascript/osgiConfigManager/App/components/DiffModal.tsx`
- `src/javascript/osgiConfigManager/App/components/Editor.jsx`
- `src/javascript/osgiConfigManager/App/components/FileSidebar.jsx`
- `src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx`
- `src/javascript/osgiConfigManager/App/components/SelectedFileHeader.jsx`
- `src/javascript/osgiConfigManager/App/components/SelectedFileToolbar.jsx`
- `src/javascript/osgiConfigManager/App/hooks/*.ts, App/utils/*, App/api/* (no markup; checked for document.title / lang only)`
- `src/javascript/osgiConfigManager/App/hooks/*.{ts,tsx}`
- `src/javascript/osgiConfigManager/App/hooks/osgiTypes.ts`
- `src/javascript/osgiConfigManager/App/hooks/useDialogA11y.ts`
- `src/javascript/osgiConfigManager/App/hooks/useFileActions.ts`
- `src/javascript/osgiConfigManager/App/hooks/useOsgiConfigs.ts`
- `src/javascript/osgiConfigManager/App/hooks/useProperties.ts`
- `src/javascript/osgiConfigManager/App/hooks/useToast.tsx`
- `src/javascript/osgiConfigManager/App/index.jsx`
- `src/javascript/osgiConfigManager/App/utils/*.{js,ts}`
- `src/javascript/osgiConfigManager/App/utils/configUtils.ts`
- `src/javascript/osgiConfigManager/App/utils/cryptoTree.ts`
- `src/javascript/osgiConfigManager/App/utils/metatypeUtils.js`
- `src/javascript/osgiConfigManager/App/utils/secretMask.js`
- `src/javascript/osgiConfigManager/registerRoutes.js`
- `src/main/resources/javascript/locales/{en,fr,de,es,it,pt}.json`

## Executive summary

Fail. Critical or serious findings must be fixed before this ships.

The headline numbers for this run.

| Measure | Value |
|---|---|
| Score | 62 out of 100 |
| Grade | D |
| Findings | 198 |
| Blocking (critical plus serious) | 75 |
| Verdict | Fail |

## Severity breakdown

Counts by severity, highest impact first.

| Severity | Count | What it means |
|---|---:|---|
| critical | 8 | Blocks a person from completing the task |
| serious | 67 | Major barrier with a difficult workaround |
| moderate | 85 | Real friction, workaround exists |
| minor | 38 | Noticeable but rarely blocking |

## Findings

198 findings, ordered by severity then by rule.

### Critical (8)

Each row names the rule, the criterion it fails, where it is, and what to change.

| Rule | WCAG | Location | Problem | Fix |
|---|---|---|---|---|
| `ARIA-KBD-016` | 2.1.1 A | src/javascript/osgiConfigManager/App/components/Dialogs.jsx:91 | In the create dialog, metatype and factory choices are clickable <div>s with no role, tabindex or key handler, and selection is shown by background only: keyboard and screen reader users cannot create from a template or factory. | Make the list a single-select group: container role="radiogroup" aria-labelledby the 'Template'/'Factory' heading; each card role="radio" aria-checked={isSelected} tabIndex={isSelected\|\|first ? 0 : -1} with Arrow-key roving and Space/Enter to select. Native <input type="radio"> in a <label> is simpler and preferred. |
| `CONTRAST-TEXT-001` | 1.4.3 AA | src/javascript/osgiConfigManager/App/components/Dialogs.jsx:110 | Metatype/factory descriptions in the Create dialog use --color-gray_dark20 (#293136 at 20% alpha), about 1.46:1 on white. | Use an opaque token that reaches 4.5:1, e.g. color: 'var(--color-gray_dark)' (#293136, 12.9:1) or drop the inline colour and use Typography color="textSecondary" after runtime check. Never use the 20/40/60 alpha tokens for text. |
| `FORM-CUSTOM-001` | 2.1.1 A | src/javascript/osgiConfigManager/App/components/Dialogs.jsx:90 | The Metatype and factory choices in the Create dialog are clickable <div>s (no role, tabindex or key handler; selection shown by color only), so keyboard users cannot create from Metatype or a factory. | Make it a native single-choice group: <fieldset><legend>{t('modal.create.templateLabel')}</legend> and, per option, <label><input type="radio" name="metatype" value={pid} checked={isSelected} onChange={onClick}/> title, subtitle, description</label>. The arrow keys, focus and the checked state then come from the browser. Same for the factory list (line 418). |
| `FORM-LABEL-001` | 4.1.2 A | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:778 | The per-row encryption checkbox has no accessible name: a screen reader says only 'checkbox, not checked', with no hint that it encrypts the value or which property it belongs to. | Moonstone Checkbox spreads extra props onto the native input, so pass a name: <Checkbox aria-label={t('editor.encryptValueOf', {key: key \|\| t('editor.placeholder.key')})} .../>. The title='Security' on the surrounding TableBodyCell (line 777) is on the <td>, not the input, and does not count. |
| `LIVE-TOAST-001` | 4.1.3 AA | src/javascript/osgiConfigManager/App/hooks/useToast.tsx:76 | The toast, the only feedback for save, delete, create, upload, enable/disable and mark-as-default, has no live region and is mounted with its text, so screen reader users hear nothing. | Render one wrapper unconditionally inside ToastProvider and change only its content: <div role="status" aria-live="polite" data-cy="toast-region">{toast && <Paper ...>...</Paper>}</div>. Keep the wrapper visible (no display:none); position the Paper as today. Do not move focus to it. |
| `MODAL-CREATE-OPTION-NOT-KEYBOARD` | 2.1.1 A | src/javascript/osgiConfigManager/App/components/Dialogs.jsx:90 | In the Create dialog, Metatype and factory options are clickable divs with no role, tabindex or key handler, so keyboard users cannot select one and the Create button stays disabled on the Configuration and Factory tabs. | Render each CreateOptionCard as a <button type="button" aria-pressed={isSelected}> (or an ARIA listbox with role=option/aria-selected and arrow-key handling) wrapping the title/subtitle text; keep the click handler and selection style. Selection state must be exposed programmatically, not only by background colour. |
| `RT-REFLOW-CLIP` | 1.4.10 AA | src/javascript/osgiConfigManager/App/components/AppChrome.jsx:19 | With the Jahia admin navigation open the module needs ~1420 CSS px: at 1280 px Save and the mode selector are cut off; at 1024 px (125% zoom) Save, Cancel, Delete and the Value column are unreachable. | Let the two panes shrink and wrap: replace the fixed 350px sidebar with flex: '0 1 350px' + minWidth: 0, allow the file header/toolbar rows to wrap (flexWrap: 'wrap'), and stack sidebar over editor below ~900px of available width; give the editor pane overflow: auto rather than hidden so nothing becomes unreachable. |
| `SEM-DIV-BUTTON-001` | 2.1.1 A | src/javascript/osgiConfigManager/App/components/Dialogs.jsx:91 | The selectable configuration and factory options in the Create dialog are clickable divs: not focusable, no role, no selected state, so keyboard and screen reader users cannot create from a template or factory. | Render each option as a native control: a radio group (<fieldset><legend>{templateLabel}</legend> then per option <label><input type="radio" name="pid" checked={isSelected}/> title/subtitle/meta</label>) inside a <ul>, or <button type="button" aria-pressed={isSelected}> in <li>. Keep the card look with CSS. Applies to both uses at Dialogs.jsx:379 and :419. |

### Serious (67)

Each row names the rule, the criterion it fails, where it is, and what to change.

| Rule | WCAG | Location | Problem | Fix |
|---|---|---|---|---|
| `ARIA-KBD-002` | 2.1.1 A | src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:137 | Moonstone TableRow adds tabIndex=0 to every file row, but rows only handle onClick: Tab lands on each file and Enter/Space do nothing. The list costs one tab stop per file plus one for the container. | When adopting the listbox pattern, pass tabIndex={-1} to every TableRow (props spread after Moonstone's tabIndex: 0) and let the container own focus. Activate on Enter/Space too: onKeyDown={e => (e.key==='Enter'\|\|e.key===' ') && (e.preventDefault(), handleFileClick(f))}. |
| `ARIA-KBD-033` | 2.1.1 A | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:696 | The Metatype info marker is a div showing the letter 'i' whose documentation lives in a hover-only Tooltip; it is not focusable, so keyboard users cannot read the property documentation and screen readers just read 'i'. | Use a button: <button type="button" aria-label={t('editor.metatype.aboutProperty', {key})} aria-describedby={`cfg-doc-${index}`}>i</button> and render the documentation in an element with that id (visually hidden or a toggletip opened on click/Enter, dismissible with Escape). |
| `ARIA-KBD-043` | 2.1.1 A | src/javascript/osgiConfigManager/App/components/Editor.jsx:102 | Leaf values in the tree editor become editable only on double-click of a plain div, which has no role, tabindex or key handler; keyboard users cannot edit values there. | Render a <button type="button" aria-label={t('editor.aria.editValue', {key: rowLabel})} onClick={…setEditingValueKey(keyString)}> or an always-present labelled input; name the edit Input/textarea (lines 87-99) and the encrypt Checkbox (line 125). |
| `ARIA-LIVE-012` | 4.1.3 AA | src/javascript/osgiConfigManager/App/hooks/useToast.tsx:77 | Toasts (save succeeded, errors, warnings) are mounted on demand in a plain Moonstone Paper <section> with no live region, so screen readers never announce the outcome of save, delete, upload or encryption actions. | Keep a live region always mounted and change only its text: <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{toast?.type !== 'error' ? toast?.message : ''}</div> plus a role="alert" region for errors; keep the visual Paper aria-hidden="true" or put the role on it while it stays mounted. |
| `ARIA-LIVE-013` | 4.1.3 AA | src/javascript/osgiConfigManager/App/components/AppChrome.jsx:131 | StatusBanner shows load errors and the Module / Module-default warnings when a file opens, but has no role, so screen readers are not told that the file failed to load or is managed by a module. | Map tone to a role: <div role={tone === 'error' ? 'alert' : 'status'} ...>. Because banners mount with the file, render the role container once in index.jsx and swap its text, or accept that role=alert on mount is announced. Mark the tone icon aria-hidden="true". |
| `ARIA-NAME-005` | 1.1.1 A | src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:176 | The compact ConfigStateBadge renders an icon-only Chip with label '' (Module / Module default / User) whose meaning exists only in a hover tooltip on a non-focusable div, so keyboard and screen reader users never get the state. | In ConfigStateBadge compact mode, keep the text for AT (aria-label alone is not reliable on a role-less div): render <span className="sr-only">{t(config.labelKey)}</span> beside the icon (or role="img" aria-label={t(config.labelKey)} on the Chip). |
| `ARIA-NAME-006` | 4.1.2 A | src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:117 | The 'Search in content' Switch renders <input type=checkbox> with no accessible name: the visible Typography beside it is not associated, and the Tooltip describes the wrapping div, not the input. | Associate the visible text: <Switch id="deep-search-switch" ... /> and <Typography component="label" htmlFor="deep-search-switch">{t('app.searchDeep')}</Typography> (Switch spreads rest props onto the input). Alternatively aria-label={t('app.searchDeep')} plus aria-describedby to the tooltip text. |
| `ARIA-NAME-007` | 4.1.2 A | src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:101 | Moonstone SearchInput inputs (file filter and .cfg property filter) are named only by their placeholder and sit in an unlabelled role="search" landmark Moonstone adds, so the field's name disappears once text is typed. | Pass a name to the input (SearchInput forwards rest props to <input>): aria-label={t('app.searchLabel')} in FileSidebar.jsx:101 and aria-label={t('editor.filter.label')} in CfgEditor.jsx:528. Add the keys to every locale file. |
| `ARIA-NAME-017` | 4.1.2 A | src/javascript/osgiConfigManager/App/components/Dialogs.jsx:337 | Dialog inputs (manual file name, filter, factory identifier, prompt) are named only by placeholders; their bold Typography 'labels' render <p> and are not associated, so the name disappears once text is entered. | Associate the visible text: give each Typography component="label" htmlFor and the Input a matching id (Moonstone Input forwards id), e.g. <Typography component="label" htmlFor="create-manual">…</Typography><Input id="create-manual" …/>. For the prompt (line 301) use aria-labelledby the ModalHeader message. |
| `ARIA-NAME-026` | 4.1.2 A | src/javascript/osgiConfigManager/App/components/CfgMetatypePropertyDialog.jsx:118 | The property search field is named only by its placeholder, the result count is never announced, and the 'already exists' message is not linked to the field. | <Input aria-label={t('editor.metatype.cfgPicker.searchLabel')} aria-describedby="cfg-picker-feedback" aria-invalid={customAlreadyExists} …/>, give the feedback block id="cfg-picker-feedback" role="status", and add a polite count ("{n} properties") there. |
| `ARIA-NAME-029` | 4.1.2 A | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:684 | Every key, value and comment field in the visual editor is an unlabelled <textarea>/<input> (placeholder 'Key'/'Value' at best), so a screen reader hears 'edit text' with no clue which property a value belongs to. | Name each field from its row: key aria-label={t('editor.aria.key', {line: index + 1})}; value aria-label={t('editor.aria.value', {key: key \|\| index + 1})} on AutoResizeTextArea (line 750) and the masked Input (line 735); comment aria-label={t('editor.aria.comment', {line: index + 1})} (line 652). |
| `ARIA-NAME-039` | 4.1.2 A | src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:1470 | The Metatype property search field in the raw editor's side panel has no accessible name beyond its placeholder. | aria-label={t('editor.metatype.searchLabel')} on the Input (forwarded to <input>), or a visible <label htmlFor>. |
| `ARIA-ROLE-008` | 4.1.2 A | src/javascript/osgiConfigManager/App/components/SelectedFileToolbar.jsx:104 | The Visual/Raw mode selector is a Moonstone Dropdown whose trigger is a div role="listbox" named by the current value ('Visual Edit'), with no aria-expanded or popup semantics: users hear a listbox, not an editor-mode control. | Use a two-state control: <div role="group" aria-label={t('editor.mode.label')}> with two Moonstone Buttons, each aria-pressed={isRawMode === (value==='raw')}, disabled={isLoadingFile}. Or a RadioGroup. If Dropdown stays, at least wrap it in role="group" aria-label={t('editor.mode.label')}. |
| `ARIA-SEL-001` | 4.1.2 A | src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:129 | The file list is a headerless <table> used as a single-select list: the selected file is only highlighted and bolded, so screen readers never hear which file is open. | Render a listbox: wrapper role="listbox" aria-label={t('app.fileList')} tabIndex={0} aria-activedescendant={'file-row-'+encodeURIComponent(selectedFile?.name)}, each row role="option" aria-selected={selectedFile?.name===f.name} tabIndex={-1}. Or use a <ul> of native <button aria-current={isSelected ? 'true' : undefined}>. |
| `ARIA-SEM-022` | 1.3.1 A | src/javascript/osgiConfigManager/App/components/DiffModal.tsx:167 | In the review-before-save diff, added and removed lines are distinguished only by green/red colour on plain <span>s, so screen reader users (and users who cannot see colour) cannot tell what will change. | Render semantic changes with a text cue: part.added ? <ins> : part.removed ? <del> : <span>, and prefix each with <span className="sr-only">{t('modal.diff.added')}</span> / removed (or a visible +/− gutter). Note many screen readers ignore <ins>/<del> by default, so keep the text prefix. |
| `ARIA-TREE-042` | 4.1.2 A | src/javascript/osgiConfigManager/App/components/Editor.jsx:161 | The tree editor's group rows expand and collapse through onClick on a <td>, with no button, no aria-expanded and no keyboard handler, so nested groups cannot be opened from the keyboard. | Put a native toggle in the cell: <button type="button" aria-expanded={!isCollapsed} onClick={toggleCollapse}>{chevron aria-hidden}{displayLabel}</button>, or adopt role="treegrid" with aria-level/aria-expanded on rows. |
| `COG-001` | 2.2.1 A | src/javascript/osgiConfigManager/App/hooks/useToast.tsx:23 | Every toast, errors included, disappears after 6 s with no close button, no pause on hover or focus and no way to extend, so failure messages for save, delete, toggle and decrypt can vanish before they are read. | Keep error and warning toasts until dismissed (add a labelled Close button), pause the timer on hover and focus, and keep the 6 s auto-dismiss only for success. Alternatively, show failures in the persistent StatusBanner above the editor (AppChrome.jsx:126). |
| `COG-002` | 3.3.4 AA | src/javascript/osgiConfigManager/App/hooks/useFileActions.ts:256 | The overwrite confirmation on Import checks only the files currently listed; with 'Search in content' on, that list holds only matches, so importing over an existing configuration overwrites it on the server without any confirmation. | Check for an existing file against the server (a file(name:) query, or the unfiltered list) rather than the filtered 'files' state, before calling processUpload. Apply the same check to the conflicting .disabled twin that is deleted at line 237-242. |
| `COG-005` | 3.3.2 A | src/javascript/osgiConfigManager/App/components/Dialogs.jsx:332 | The 'Manual filename' field states the allowed extensions nowhere before submission (only an example in the placeholder); the rule '.cfg, .yml, .cfg.disabled or .yml.disabled' appears only in an error dialog after Create. | Add persistent helper text under the field, e.g. 'End the name with .cfg or .yml. Add .disabled to create it disabled.', associate it with aria-describedby, and validate inline so Create stays disabled until the extension is valid. |
| `COG-006` | 3.3.7 A | src/javascript/osgiConfigManager/App/components/Dialogs.jsx:255 | The create dialog closes before the file name is validated or created, and its state is reset, so after an invalid extension or a server error the administrator must click New again and retype the name. | Validate the extension inside the dialog before closing, and keep the dialog open with the typed value on a server error (await onConfirm, close only on success, show the error inline). Do not clear manualFilename when a Metatype card is chosen (lines 389 and 429). |
| `COLOR-ONLY-001` | 1.4.1 A | src/javascript/osgiConfigManager/App/components/DiffModal.tsx:169 | Added and removed lines in the review-before-save diff are distinguished only by green/red text and background colour, with no +/- marker or text. | Prefix each line of an added part with '+ ' and a removed part with '- ' (or render a gutter column with +/-), and wrap parts in <ins>/<del> or add visually-hidden 'Added'/'Removed' text. Keep the colours as a secondary cue; add a left border so the cue survives forced-colors mode. |
| `CONTRAST-TEXT-002` | 1.4.3 AA | src/javascript/osgiConfigManager/App/components/DiffModal.tsx:202 | The diff modal Save button overrides its background to #00a0e3 with white text, 2.94:1. | Remove the inline style and let Moonstone's accent button render, or use backgroundColor 'var(--color-accent_dark)' (#0072b1, white text 5.20:1). |
| `CONTRAST-TEXT-003` | 1.4.3 AA | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:89 | Comment rows of the visual .cfg editor ('#' marker and comment text) are drawn in --color-success #6abb6d, 2.35:1 on white and 2.06:1 on the selected row. | Use a dark green that reaches 4.5:1 on both #fff and #def4fd, e.g. #2e7d32 (5.1:1 on white) or Moonstone's success_dark token if defined; keep italic + '#' + icon as non-colour cues. |
| `CONTRAST-TEXT-004` | 1.4.3 AA | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:141 | The 'Add comment' button label and border are overridden to --color-success #6abb6d, 2.35:1 on white. | Drop the inline colour override (use Moonstone's default outlined button) or use a green reaching 4.5:1 for the label and 3:1 for the border, e.g. #2e7d32. |
| `DATA-STATE-VISUAL-ONLY` | 1.3.1 A | src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:158 | Each file's enabled/disabled status is shown only by a 3px green/grey bar and a line-through (line 173), and its origin (module, module default, user) only by an unlabelled icon chip (line 176) whose tooltip needs hover. | Add text for each state to every file item: visually hidden ', disabled' when !f.enabled, and the state label (t(config.labelKey)) as visually hidden text next to the compact chip, or aria-describedby. Keep the bar and the chip as decoration (aria-hidden). |
| `FOCUS-VISIBLE-001` | 2.4.7 AA | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:259 | Key, value and comment textareas of the visual .cfg editor set outline: 'none'; the only focus cue is the row background #def4fd (1.14:1 vs white), unchanged when moving between fields of the same row. | Remove outline: 'none' and add a :focus-visible rule for the textareas (e.g. a class with outline: 2px solid var(--color-accent_dark); outline-offset: 1px; #0072b1 is 5.20:1 on white, 4.57:1 on #def4fd). Do not rely on the row selection background as focus indicator. |
| `FOCUS-VISIBLE-002` | 2.4.7 AA | src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:130 | The focusable file list container (tabIndex=0, Arrow-key navigation) suppresses its focus outline, so keyboard users cannot see that the list has focus. | Remove outline: 'none' and give the container a visible :focus-visible style (e.g. outline: 2px solid var(--color-accent_dark); outline-offset: -2px), at least 3:1 against white and the highlighted row. |
| `FORM-ERR-004` | 3.3.1 A | src/javascript/osgiConfigManager/App/components/SelectedFileHeader.jsx:25 | With a validation error in the raw or YAML editor, Save is silently disabled. The error shows only as Monaco squiggles, with no summary or announcement, so screen-reader users cannot tell why they cannot save. | Under the editor toolbar, render an error summary in an always-present role="status" region: 'N errors: line 12, missing key', with a button that puts the cursor on the first marker (editor.setPosition + focus). Use aria-disabled (still focusable) for Save, with aria-describedby pointing to the summary. |
| `FORM-HELP-001` | 1.3.1 A | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:694 | A property's Metatype help (type, optional, default, allowed values, description) appears only in a tooltip on a non-focusable <div>: keyboard users cannot open it, and it is not linked to the value field. | Render the Metatype help as visible or expandable text with an id, for example id={`cfg-help-${index}`}, and reference it from the value field with aria-describedby. If a tooltip is kept, make the trigger a <button type="button" aria-label={t('editor.metatype.info', {key})}> so it can receive focus. |
| `FORM-LABEL-002` | 4.1.2 A | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:652 | The comment-row textarea has no label, no placeholder and no aria-label, so it has no accessible name: screen readers announce 'edit text, multi-line' with nothing else. | Add aria-label={t('editor.commentLabel')} (for example 'Comment') to the AutoResizeTextArea at line 652. AutoResizeTextArea already spreads ...props onto the <textarea>, so no component change is needed. Add the new key to every locale file. |
| `FORM-LABEL-007` | 3.3.2 A | src/javascript/osgiConfigManager/App/components/Dialogs.jsx:301 | The prompt input (Add Property without Metatype, Rename uploaded file, create fallback) is labelled only by the placeholder 'Type here...'; the question in ModalHeader is not linked to it. | Name the input after the question: <Input aria-label={config.message \|\| config.title} .../>. Better, render the question as a <label htmlFor> for an id on the input. Remove the generic 'Type here...' placeholder, or make it a real example. |
| `FORM-LEGACY-001` | 2.1.1 A | src/javascript/osgiConfigManager/App/components/Editor.jsx:101 | The tree editor (ConfigEditor) edits only on double-click of a <div>; its Input, textarea and encryption Checkbox (125) have no name. It renders for files that are neither .cfg nor .yml, which may be unreachable. | If the branch is reachable: make each value a focusable button or an always-editable field, labelled with aria-labelledby={rowLabelId}, and give the Checkbox aria-label={t('editor.encryptValueOf', {key: rowLabel})}. If it is not reachable, remove ConfigEditor so it cannot come back unlabelled. |
| `IMG-ICON-001` | 1.1.1 A | src/javascript/osgiConfigManager/App/components/ConfigStateBadge.jsx:40 | In compact mode (every sidebar row, FileSidebar.jsx:176) the state badge is an icon-only Chip (Build / Module / Edit) with an empty label, so MODULE / MODULE_DEFAULT / USER has no text alternative. | When compact, keep the label for AT: render <span className="sr-only">{t(config.labelKey)}</span> next to the icon (or give the icon role="img" aria-label={t(config.labelKey)}). The Tooltip wraps a non-focusable div and opens only on hover, so it is not a substitute. |
| `IMG-STATE-001` | 1.1.1 A | src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:158 | Whether a file is enabled or disabled is shown only by a 3px coloured bar and a line-through on the name, neither of which reaches assistive technology. | Add a text alternative inside the file's button, e.g. <span className="sr-only">{t('…disabled')}</span> when !f.enabled (or include it in the accessible name), and mark the bar aria-hidden="true". |
| `KBD-DRAG-ONLY-POINTER` | 2.5.7 AA | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:608 | Reordering .cfg entries with a pointer requires a drag; clicking the handle button does nothing (onClick only stops propagation), and the Arrow-key alternative does not serve pointer-only users, so there is no single-pointer way to reorder. | Add single-click controls, e.g. 'Move up' / 'Move down' icon buttons in the actions cell or a small menu on the handle button (onClick opens Move up / Move down / Move to top), calling the same handleReorder. |
| `KBD-FOCUS-LOST-REMOVED` | 2.4.3 A | src/javascript/osgiConfigManager/App/hooks/useFileActions.ts:82 | After a file is deleted, selectFile(null) unmounts the toolbar holding the Delete button the Moonstone Modal returns focus to, so focus falls to <body> and the keyboard user has to start again from the top of the page. | After a successful delete, move focus explicitly: select the next file in the list and focus the file-list container (pass a ref from FileSidebar), or focus the list container / 'New' button when the list is empty. Do it after fetchFiles() resolves. |
| `KBD-REORDER-FOCUS` | 2.1.1 A | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:584 | Rows are keyed by index, so after Arrow Up/Down on a reorder handle focus stays put while the entry moves; the next press moves the displaced neighbour back, so an entry cannot move more than one step by keyboard. | Key rows by a stable id (assign one when parsing entries), and after handleReorder(index, target) focus the reorder button of the moved entry at its new index (ref map + requestAnimationFrame). Skip hidden neighbours (filtered rows, hidden comments/empty lines) when computing target, and disable keyboard reorder while filtering as the drag is (line 600). Announce the new position via a polite live region. |
| `KBD-TRAP-EDITOR` | 2.1.2 A | src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:742 | The Monaco editor captures Tab and Shift+Tab (indent/outdent) and the module neither enables tabFocusMode nor tells users the exit key (Ctrl+M, Ctrl+Shift+M on macOS), so a keyboard user entering the raw/YAML editor cannot Tab out of it. | Keep Tab for indentation but tell users how to leave: add a visible hint in the raw editor toolbar (e.g. 'Press Ctrl+M (Ctrl+Shift+M on macOS) to make Tab move focus'), optionally with a toolbar toggle button calling editorRef.current.trigger('keyboard', 'editor.action.toggleTabFocusMode', null). Also pass ariaLabel to monaco.editor.create and document the key in README. |
| `LINK-CONTROL-ELEMENT` | 4.1.2 A | src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:137 | Each file entry is a table row with onClick that loads the file: exposed as a plain row, Enter/Space on the focused row do nothing, and the current file is marked only by the isHighlighted class. | Selecting a file does not change the URL, so use button semantics, not a link: render the list as <ul> with one <button type="button" aria-current={isSelected ? 'true' : undefined}> per file, or a role="listbox" with role="option" aria-selected items driven by the existing ArrowUp/ArrowDown handler (FileSidebar.jsx:77). Use <a href> only if file selection gets its own route. |
| `LIVE-ERR-001` | 4.1.3 AA | src/javascript/osgiConfigManager/App/index.jsx:249 | A file load error (e.g. a filtered/blacklisted file) is shown in a StatusBanner that has no role and is mounted with its text, while the toolbar disappears, so screen reader users get no indication why the editor is empty. | Give StatusBanner an optional role prop and use role="alert" for tone="error": <div role={tone === 'error' ? 'alert' : undefined} ...>. Better: keep an always-mounted <div role="alert"> in the editor pane and render {error} inside it, so the region exists before the text changes. |
| `LIVE-FILTER-002` | 4.1.3 AA | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:535 | The visual editor's filter count ('n properties match') is a visible status message but has no role="status" and is mounted only once filtering starts, so it is never announced. | Keep the element mounted and give it a status role: <Typography role="status" variant="caption" data-cy="cfg-filter-count" ...>{filtering ? t('editor.filter.count', {count}) : ''}</Typography>. Compute count once (useMemo) instead of inline. |
| `LIVE-REORDER-001` | 2.4.3 A | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:614 | Keyboard reordering announces nothing, and with key={index} (line 584) focus stays on the same position, so a second Arrow key moves the other row back; it also runs while filtering, swapping with hidden rows. | Key rows by a stable id, not index, so focus follows the moved row; after handleReorder announce through a role="status" region t('editor.reorder.moved', {name: key, position: newIndex + 1, total: entries.length}); in onKeyDown return early when filtering, as the drag handlers already do. |
| `LIVE-TOAST-002` | 4.1.3 AA | src/javascript/osgiConfigManager/App/hooks/useToast.tsx:37 | Errors (save failure useOsgiConfigs.ts:447, delete/toggle/create/upload failures, encryptFailed, decryptRefused) use the same polite, transient toast as successes, so a failed save is easy to miss. | Add a second always-mounted region <div role="alert">{errorToast && ...}</div> used only by error(); keep success/warning/info in the role="status" region. Error toasts should stay until dismissed (duration: null) and start with a text prefix such as t('notification.errorPrefix') ('Error:'). |
| `LIVE-TOAST-003` | 2.2.1 A | src/javascript/osgiConfigManager/App/hooks/useToast.tsx:30 | Every toast, errors included, disappears after a fixed 6 s with no close button and no pause on hover/focus, too short for long messages such as notification.undecryptableValues or raw server error text. | Add a close Button (aria-label={t('notification.dismiss')}) inside the Paper; clear the timer on mouseenter/focusin and restart it on mouseleave/focusout; do not auto-dismiss error toasts; for others scale duration with length, e.g. Math.max(6000, message.length * 60). |
| `LIVE-VALID-001` | 3.3.1 A | src/javascript/osgiConfigManager/App/components/Dialogs.jsx:458 | The 'identifier already exists' error mounts with its text, is not tied to the identifier input and is shown in red only, while Create is silently disabled, so screen reader users cannot learn why. | Give the message an id and keep it in an always-mounted container: <Typography id="factory-id-error" role="alert" ...>{isFactoryIdentifierTaken ? t('modal.create.factoryIdentifierExists') : ''}</Typography>; on the Input set aria-invalid={isFactoryIdentifierTaken} and aria-describedby="factory-id-error". |
| `LIVE-VALID-002` | 3.3.1 A | src/javascript/osgiConfigManager/App/components/CfgMetatypePropertyDialog.jsx:210 | The 'property already exists' message mounts silently, in colour only, and pressing Enter with that name closes the dialog without adding anything or saying so. | Keep an always-mounted <Typography id="cfg-picker-msg" role="status"> holding customAlreadyExists / knownProperty text; set aria-describedby="cfg-picker-msg" and aria-invalid={customAlreadyExists} on the search Input; in the Enter handler (line 124-130) do not call onClose() when customAlreadyExists. |
| `LIVE-VALID-003` | 3.3.1 A | src/javascript/osgiConfigManager/App/components/SelectedFileHeader.jsx:25 | When YAML/properties content is invalid, Save is silently disabled and the errors exist only as Monaco markers (squiggles), so a screen reader user gets no text explaining why Save no longer works. | Have onValidate report the error markers (count + first message/line). Show near Save an always-mounted <Typography id="save-validation" role="status">{t('editor.validation.errors', {count, line, message})}</Typography>, reference it with aria-describedby on Save, and mention F8 (next problem) in it. |
| `MODAL-CUSTOM-BACKGROUND-NOT-INERT` | 2.4.3 A | src/javascript/osgiConfigManager/App/hooks/useDialogA11y.ts:53 | DiffModal and CfgMetatypePropertyDialog leave the page behind focusable and exposed; the Tab trap wraps only from the exact first/last item, so focus elsewhere (e.g. after clicking dialog text) lets Tab escape. | Prefer a native <dialog> opened with showModal(). Otherwise, in useDialogA11y set inert on the app root (and other body children except the dialog portal) while open and remove it on close; also handle Tab when document.activeElement is outside the container by moving focus to first/last. |
| `MODAL-DIFF-SCROLL-REGION` | 2.1.1 A | src/javascript/osgiConfigManager/App/components/DiffModal.tsx:155 | The review-before-save diff is a scrollable div (60vh, overflow auto) with no tabindex: without focusable-scroller support keyboard users cannot scroll a long diff, and the hook's trap ignores it. | Give the diff container tabIndex={0}, role="region" and aria-label (e.g. t('modal.diff.title')) plus a visible focus style; tabindex=0 also makes the hook's FOCUSABLE_SELECTOR include it in the Tab cycle. |
| `MODAL-FOCUS-RETURN-LOST` | 2.4.3 A | src/javascript/osgiConfigManager/App/components/CfgMetatypePropertyDialog.jsx:120 | The autoFocus search input takes focus before useDialogA11y records document.activeElement, so the hook saves the input as the element to return to; on Cancel, Escape or backdrop click focus falls to <body>. | Capture the trigger before the dialog mounts: record document.activeElement in useLayoutEffect, or pass a triggerRef/returnFocusRef to useDialogA11y and focus it on close; remove autoFocus and let the hook move focus to the input. Selecting a property already focuses the new value via focusEntryValue, keep that. |
| `MODAL-NAME-SELF-REFERENCE` | 4.1.2 A | src/javascript/osgiConfigManager/App/components/Dialogs.jsx:272 | Moonstone Modal sets aria-labelledby to the dialog's own id and the module does not override it, so the dialog's accessible name is its entire text content (close button, message, every Metatype in the Create list, footer labels). | Pass aria-labelledby to <Modal> (Moonstone spreads extra props after its own): give the title an id, e.g. wrap config.title in an element with id={titleId} or pass id={headerId} to ModalHeader and point aria-labelledby at the title only, and add aria-describedby={messageId} for config.message. |
| `NONTEXT-CONTRAST-001` | 1.4.11 AA | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:81 | Key/value inputs of the visual .cfg editor are bounded only by a --color-gray_light40 border (#dadada at 40%), 1.14:1 against white. | Use an opaque border reaching 3:1, e.g. 1px solid var(--color-gray) (#7a7f88, 4.0:1 on white). Same issue applies to any other inline border built on gray_light40 that identifies a control. |
| `REFLOW-001` | 1.4.10 AA | src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:97 | The file sidebar has a fixed 350px width inside a non-wrapping, overflow-hidden flex row, so at 320 CSS px the editor pane collapses to zero width and its content is lost. | Make the layout responsive: e.g. width: 'min(350px, 100%)' with flex: '0 1 350px', and below ~768px switch APP_LAYOUT_STYLE (AppChrome.jsx:19) to flexDirection: 'column' (or flexWrap: 'wrap') with overflow: 'auto' so sidebar and editor stack. |
| `REFLOW-002` | 1.4.10 AA | src/javascript/osgiConfigManager/App/components/DiffModal.tsx:105 | The diff dialog has no max-height and its fixed overlay does not scroll, so at 400% zoom (320x256 CSS px) the header and the Save/Cancel footer are clipped off-screen; the non-wrapping header also clips the title and secrets toggle. | Give the Paper maxHeight: 'calc(100vh - 32px)' with the body as the only flex: 1 / minHeight: 0 / overflow: auto region (replace maxHeight: '60vh'), set overflow: 'auto' on the overlay, and flexWrap: 'wrap' on the header row (line 123). |
| `RT-AXE-LABEL` | 4.1.2 A | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:778 | axe 'label' fails on every per-row encryption checkbox (11 in the sample file) and on the 'Search in content' switch: inputs with no accessible name. | aria-label on each Checkbox naming the property ('Encrypt value of {{key}}'); associate the switch with its visible text via id/htmlFor or aria-labelledby. |
| `RT-MODAL-NAME` | 4.1.2 A | src/javascript/osgiConfigManager/App/components/Dialogs.jsx:272 | The delete confirmation (all Moonstone ModalDialogs) is aria-labelledby itself, so its name is its whole content; it has no aria-describedby, opens on the X button named 'Cancel', and its buttons read 'Cancel', 'CANCEL', 'OK'. | Pass aria-labelledby pointing at the title only and aria-describedby at the message, use role=alertdialog for confirmations, label the X 'Close' and the confirm button with the action ('Delete'). |
| `RT-REFLOW-320` | 1.4.10 AA | http://localhost:8080/jahia/administration/osgi-configurations-manager | At 320 CSS px (1280 at 400%) the module needs about 1100 px of horizontal scrolling even with the secondary navigation collapsed (h1 975px wide), and with it open the module is not visible at all. | Same layout change as RT-REFLOW-CLIP for the module; the shell's navigation covering the viewport is Jahia's and should be reported to the platform team. |
| `SEM-DIFF-001` | 1.3.1 A | src/javascript/osgiConfigManager/App/components/DiffModal.tsx:177 | In the review-before-save diff, added and removed lines are distinguished only by green/red colour on plain spans, so the changes the dialog exists to show are not conveyed in structure or text. | Render added parts as <ins> and removed parts as <del>, each with a visually hidden prefix ('Added:' / 'Removed:') since ins/del are not announced by every screen reader, and show a visible '+' / '−' gutter so the distinction does not rely on colour (1.4.1). |
| `SEM-DIV-BUTTON-002` | 4.1.2 A | src/javascript/osgiConfigManager/App/components/DiffModal.tsx:145 | The review-before-save dialog's close control is a div with an onClick around a bare Close icon: no role, no accessible name, not in the tab order. | Replace with the pattern already used in Dialogs.jsx:285: <Button variant="ghost" size="small" icon={<Close/>} aria-label={t('modal.cancel')} onClick={onClose}/>. Drop the inline onMouseOver/onMouseOut colour hack. |
| `SEM-DIV-BUTTON-003` | 4.1.2 A | src/javascript/osgiConfigManager/App/components/CfgMetatypePropertyDialog.jsx:112 | The Add-property dialog's close control is a div with an onClick around a bare Close icon: no role, no accessible name, not focusable. | Use <Button variant="ghost" size="small" icon={<Close/>} aria-label={t('modal.cancel')} onClick={onClose}/> as in Dialogs.jsx:285. |
| `SEM-LIST-002` | 4.1.2 A | src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:137 | Each file row is a <tr> that Moonstone makes focusable (tabIndex 0) with an onClick but no role, no Enter/Space activation and no exposed selected state (selection is only highlight + bold). | Make each entry a <button type="button" aria-current={selected ? 'true' : undefined} onClick={() => handleFileClick(f)}> inside an <li>; native buttons give Enter/Space. If arrow-key navigation is kept, use the listbox pattern instead: container role="listbox" aria-label, rows role="option" aria-selected, focus via aria-activedescendant or roving tabindex. |
| `STATE-INDICATOR-001` | 1.4.11 AA | src/javascript/osgiConfigManager/App/components/Dialogs.jsx:75 | The selected metatype/factory card in the Create dialog is shown only by background var(--color-accent_light80), a token Moonstone 2.21 does not define, so the selected state is invisible (and would be colour-only even if defined). | Use a defined token and a non-colour cue: e.g. background var(--color-accent_light_plain20) plus a 2px left border var(--color-accent_dark) (5.20:1) and a check icon or bold 'Selected' text; also expose selection with aria-selected/aria-pressed. Replace --color-gray_light98 (lines 33, 48), also undefined. |
| `TABLE-CELL-CONTROL-NAME` | 4.1.2 A | src/javascript/osgiConfigManager/App/components/Editor.jsx:125 | In the YAML table the encryption checkbox (line 125) and the value editors shown on edit (MultilineInput line 87, Input line 93) have no accessible name. | Add aria-label with the property: Checkbox aria-label 'Encrypt value of {{key}}'; Input and textarea aria-label 'Value of {{key}}' (pass rowLabel or keyString into LeafRow's editors). |
| `TABLE-HEADER-TD` | 1.3.1 A | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:179 | The .cfg visual editor's header row is built from TableBodyCell, which renders <td>, so the table has no <th>: Property / Key, Value and Security are not associated with the cells or controls below them. | Use moonstone's TableHeadCell (renders <th>) or <TableBodyCell component="th" scope="col"> for every cell of CfgEditorHeader, with scope="col". |
| `TABLE-HEADER-TD` | 1.3.1 A | src/javascript/osgiConfigManager/App/components/Editor.jsx:326 | The YAML visual editor's header row (Property / Key, Value, Security, Actions) uses TableBodyCell, i.e. <td>, so no cell has a column header. | Replace the four TableBodyCell in the <thead> with <TableHeadCell scope="col"> (or TableBodyCell component="th" scope="col"), keeping the sticky styles. |
| `TABLE-INLINE-EDIT` | 2.1.1 A | src/javascript/osgiConfigManager/App/components/Editor.jsx:105 | A YAML value becomes editable only on double-click of a non-focusable div, so keyboard users cannot edit values in the visual editor (only the raw Monaco mode remains). | Make the value cell's trigger focusable: a <button type="button" aria-label={`Edit value of ${rowLabel}`}> that sets editingValueKey on click/Enter, or always render the Input. Return focus to that trigger when the editor blurs. |
| `TREE-COLLAPSE-CONTROL` | 2.1.1 A | src/javascript/osgiConfigManager/App/components/Editor.jsx:170 | YAML sections collapse through onClick on a <td> with chevron icons: not focusable, no button role, no aria-expanded, so keyboard and screen reader users cannot open or close a section or know its state. | Put a real button in the container cell: <button type="button" aria-expanded={!isCollapsed} onClick={toggleCollapse}>{chevron}{folder}{displayLabel}</button>, with the icons aria-hidden. Keep the Add Property button outside it. |

3 of these are low confidence and need a human to confirm: `ARIA-KBD-043` at src/javascript/osgiConfigManager/App/components/Editor.jsx:102, `ARIA-TREE-042` at src/javascript/osgiConfigManager/App/components/Editor.jsx:161, `FORM-LEGACY-001` at src/javascript/osgiConfigManager/App/components/Editor.jsx:101.

### Moderate (85)

Each row names the rule, the criterion it fails, where it is, and what to change.

| Rule | WCAG | Location | Problem | Fix |
|---|---|---|---|---|
| `ARIA-DESC-011` | 3.3.1 A | src/javascript/osgiConfigManager/App/components/SelectedFileHeader.jsx:73 | When the raw/YAML content is invalid, Save is silently disabled; the Monaco markers are not announced and nothing tells a screen reader user why Save is unavailable. | Render a status message when !isYamlValid, e.g. <p id="save-blocked-reason" role="status">{t('editor.invalidContent')}</p>, and link it: aria-describedby={isSaveDisabled && !isYamlValid ? 'save-blocked-reason' : undefined} on the Save button. Moonstone Button spreads rest props onto <button>. |
| `ARIA-DESC-018` | 3.3.1 A | src/javascript/osgiConfigManager/App/components/Dialogs.jsx:459 | When the factory identifier already exists, a red caption appears and Create is disabled, but the input is not marked invalid nor linked to the message, so screen reader users do not learn why. | <Input id="factory-id" aria-invalid={isFactoryIdentifierTaken} aria-describedby={isFactoryIdentifierTaken ? 'factory-id-error' : 'factory-id-hint'} …/> and <Typography id="factory-id-error" role="alert" …>. Give the suggested-filename caption id="factory-id-hint". |
| `ARIA-LIVE-014` | 4.1.3 AA | src/javascript/osgiConfigManager/App/components/AppChrome.jsx:111 | InlineLoader ('Loading files…', 'Loading file…') is a CSS spinner with text and no status role; the loading state and its end are not announced and the editor pane carries no aria-busy. | <div role="status" aria-live="polite">…spinner aria-hidden="true"…{label}</div>, and aria-busy={loadingFile} on the editor container in index.jsx:281. |
| `ARIA-NAME-031` | 2.4.6 AA | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:792 | Row delete buttons are icon-only and named solely by a title ('Delete this property'), identical on every row; title-only names are unreliable and do not say which property is deleted. | aria-label={t('editor.aria.deleteProperty', {key: key \|\| t('editor.emptyLine')})} on the Button (rest props reach <button>); keep title or a Tooltip for sighted users. Apply the same to the show/hide-secret button (line 764) and Editor.jsx:131. |
| `ARIA-NAME-036` | 4.1.2 A | src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:742 | monaco.editor.create is called without ariaLabel, so the raw editor is announced with Monaco's generic name and nothing says which file or format is being edited. | Add ariaLabel: t('editor.raw.ariaLabel', {name: filename}) and keep Monaco's hint in it (e.g. '… Press Alt+F1 for accessibility options'), since overriding ariaLabel removes Monaco's default hint. Update it with editor.updateOptions when filename changes. |
| `ARIA-PRIV-037` | n/a | src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:1017 | Secrets are masked only by a CSS inline decoration (transparent text); the characters stay in the model, so Monaco's screen-reader textarea and hover/announce paths read the secret aloud while sighted users see dots. | Treat AT like the visual editor: when secrets are masked and accessibilitySupport is on, either make the editor readOnly with a masked copy, or hand Monaco a masked model and map edits back. At minimum document it and default secretsVisible=false to a read-only view for AT. |
| `ARIA-ROLE-009` | 4.1.2 A | src/javascript/osgiConfigManager/App/components/AppHeaderBar.jsx:37 | role="toolbar" is set on the header actions without an accessible name or the toolbar keyboard model (one tab stop, arrow keys), so it promises behaviour that is not there. | Either drop role="toolbar" (three independent buttons need no composite role), or keep it with aria-label={t('app.actions')} and a roving tabindex handling ArrowLeft/ArrowRight/Home/End. |
| `ARIA-SEM-010` | 1.3.1 A | src/javascript/osgiConfigManager/App/components/SelectedFileHeader.jsx:31 | The selected file name is styled as a heading (Typography variant 'heading') but renders a <p>, so after the page <h1> there is no heading for the open configuration to navigate to. | Pass a heading element: typographyProps={{variant: 'heading', component: 'h2'}}. Do the same for the dialog titles in DiffModal.tsx:131 and CfgMetatypePropertyDialog.jsx:109 and reference them with aria-labelledby. |
| `ARIA-SEM-028` | 1.3.1 A | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:178 | The visual editor's header row uses TableBodyCell (<td>) inside <thead>, and three header cells are empty, so cells are not associated with 'Property', 'Value', 'Security' columns. | Render header cells as <th scope="col">: <TableBodyCell component="th" scope="col" …> (TableBodyCell accepts component) or Moonstone TableHeadCell, and give the empty ones visually hidden text (Reorder, Type, Actions). Same fix in Editor.jsx:326. |
| `ARIA-STATE-034` | 4.1.2 A | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:157 | 'Toggle Comments' and 'Toggle Empty Lines' are toggle buttons whose on/off state is shown only by an eye icon; no aria-pressed, so screen readers cannot tell whether comments are shown. | Pass aria-pressed={showComments} and aria-pressed={showEmptyLines} to the Buttons (Moonstone Button spreads rest props onto <button>). Avoid Moonstone ButtonToggle here: it calls blur() on click, dropping keyboard focus. |
| `ARIA-STATE-038` | 4.1.2 A | src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:1406 | 'Add property' opens the Metatype side panel but does not expose aria-expanded/aria-controls, and the panel is an unlabelled div that does not receive focus, so screen reader users are not told it appeared. | On the button: aria-expanded={showPropertyPanel} aria-controls="metatype-property-panel". On the panel: id="metatype-property-panel" role="region" aria-labelledby its heading (render the 'Available properties' Typography as an h3 with an id), and move focus to the search input when it opens; return focus to the button on Hide. |
| `COG-003` | 3.3.2 A | src/javascript/osgiConfigManager/App/components/Dialogs.jsx:502 | The import conflict dialog asks 'What do you want to do?' and the code passes a Rename choice, but ModalDialog never renders otherLabel/onOther, so only Cancel and Overwrite appear and the safer option promised by the wording is missing. | Render a third footer button when config.otherLabel is set (calling onClose then config.onOther), so 'Rename' is available; or, if renaming is dropped, change modal.conflict.message to 'The file {{name}} already exists. Overwrite it?'. |
| `COG-004` | 3.3.4 AA | src/javascript/osgiConfigManager/App/hooks/useFileActions.ts:235 | Import overwrites a configuration without the review-before-save diff used by Save, and when the existing file is the .disabled twin it also deletes that file and makes the configuration active, which the conflict message does not say. | Route an import over an existing file through the DiffModal (old content vs uploaded content), and state the side effect in the conflict message, e.g. 'Importing replaces {{name}}. The configuration will be enabled because the imported file is not .disabled.' |
| `COG-007` | 3.3.7 A | src/javascript/osgiConfigManager/App/hooks/useOsgiConfigs.ts:629 | The tree editor's 'Add Property' prompt closes before the duplicate check; a duplicate name opens a separate error dialog and the administrator must start again and retype the name. | Check the name against existing keys inside the prompt and show the error under the input without closing it, keeping the typed value. |
| `COG-008` | 2.4.6 AA | src/javascript/osgiConfigManager/App/hooks/useFileActions.ts:72 | The delete-file confirmation's action button reads only 'OK' and the message does not say the file is permanently removed from the server; the delete-property confirmation (useOsgiConfigs.ts:670) also falls back to 'OK'. | Pass confirmLabel: 'Delete file' (and 'Delete property'), and reword modal.deleteFile.message to 'Delete {{name}} from the server? This cannot be undone. Download it first if you may need it again.' |
| `COG-009` | 2.4.6 AA | src/javascript/osgiConfigManager/App/components/SelectedFileHeader.jsx:64 | The header button that discards every unsaved edit in the file is labelled 'Cancel', the same word used to dismiss dialogs, so its effect (revert the file to its saved state) is not described. | Label it 'Discard changes' (matching modal.unsaved.confirm 'Discard Changes') or 'Revert', with tooltip 'Reload the saved version and discard your edits'. |
| `COG-010` | 2.4.6 AA | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:196 | The encryption checkbox in each .cfg row sits under a column titled only 'Security', so nothing says that ticking it stores the value as ENC(...) on save. | Rename the column 'Encrypted' (en.json editor.header.security) and give each checkbox a label and tooltip such as 'Encrypt the value of {{key}} when saving'. |
| `COG-011` | 2.4.6 AA | src/javascript/osgiConfigManager/App/components/Dialogs.jsx:209 | In 'Create new configuration' the tabs 'Manual', 'Configuration' and 'Factory' and the heading 'Filter' do not say what each path creates, and 'Created file:' labels a file that does not exist yet. | Use descriptive labels: 'Empty file', 'From Metatype', 'Factory instance'; 'Filter available configurations'; and 'File to create:' instead of 'Created file:' (en.json modal.create.tabs.*, filterLabel, suggestedFilename). |
| `COG-012` | 3.2.2 A | src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:77 | Arrow keys in the file list immediately open the next file, replacing the editor, toolbar and banners (and opening a discard-changes dialog on each press when edits are unsaved), without any instruction that arrows open files. | Let arrow keys move focus only and open a file on Enter or Space (or click); if selection must follow focus, add a visible hint above the list, e.g. 'Use Arrow keys to move, Enter to open'. |
| `COG-013` | n/a | src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:1146 | When Metatype help is available, pressing Enter opens the suggestion list on the new empty line, so a second Enter inserts the first suggested property instead of another blank line. | Do not open suggestions automatically on newline (users can press Ctrl+Space), or set acceptSuggestionOnEnter: 'off' (or 'smart') in the editor options so Enter keeps inserting a line. |
| `COG-014` | 3.3.2 A | src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:1192 | The raw editor's Encrypt and Decrypt tooltips promise to act on the selection, but both act on the value of the cursor's line; Encrypt silently does nothing when that line has no value or is already encrypted. | Reword tooltips to 'Encrypt the value on the cursor's line' and 'Decrypt the ENC(...) value on the cursor's line' (en.json tooltip.encryptSelection, tooltip.decryptSelection), and show a warning toast when Encrypt finds nothing to encrypt, as Decrypt already does. |
| `COG-015` | n/a | src/javascript/osgiConfigManager/App/components/SelectedFileHeader.jsx:25 | Nothing visible says the open file has unsaved changes; the only cue is that Save and Cancel become enabled, so administrators must remember whether they edited the file. The 'app.unsaved' label exists but is never used. | Show an 'Unsaved changes' chip next to the file name when hasUnsaved is true, using t('app.unsaved'), and mark the file's row in the sidebar. |
| `COG-016` | n/a | src/javascript/osgiConfigManager/App/index.jsx:110 | Unsaved edits are guarded for in-app actions but not when leaving the page: a reload, a click in the Jahia admin menu, or a sign-in after an expired session discards them with no warning. | Register a beforeunload handler while hasUnsaved is true, and guard the Jahia route change if the app shell provides a hook for it. |
| `COLOR-ONLY-002` | 1.4.1 A | src/javascript/osgiConfigManager/App/hooks/useToast.tsx:58 | Error and warning toasts use the same Warning icon and differ only by the colour of the icon and the 4px left border. | Use a distinct icon for errors (e.g. a cross/close-circle icon) and/or prefix the message with a visible 'Error:'/'Warning:' label, so the toast type does not depend on colour. |
| `CONTRAST-TEXT-005` | 1.4.3 AA | src/javascript/osgiConfigManager/App/components/SelectedFileHeader.jsx:43 | The selected file's path (caption size) uses CHROME_TOKENS.subtleTextColor = --color-gray_dark60 (#293136 at 60%), 3.82:1 on white. | Change CHROME_TOKENS.subtleTextColor (AppChrome.jsx:9) to an opaque colour, e.g. var(--color-gray_dark) (12.9:1) or #5c6166 (~6:1). This also fixes EMPTY_STATE_STYLE and InlineLoader text. |
| `CONTRAST-TEXT-006` | 1.4.3 AA | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:536 | The filter match count caption uses --color-gray_dark60, 3.82:1 on white. | Use CHROME_TOKENS.subtleTextColor once fixed, or var(--color-gray_dark). |
| `CONTRAST-TEXT-007` | 1.4.3 AA | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:674 | The '(empty line)' placeholder text uses --color-gray_dark40 italic caption, 2.26:1 on white (2.21:1 on the selected row). | Use an opaque colour reaching 4.5:1, e.g. #5c6166, keeping the italic style. |
| `CONTRAST-TEXT-008` | 1.4.3 AA | src/javascript/osgiConfigManager/App/components/Dialogs.jsx:459 | The 'identifier already exists' error caption uses --color-danger #f44053, 3.68:1 on white. | Use a darker red reaching 4.5:1, e.g. #c62828 (5.6:1), and keep an icon or 'Error:' prefix so the error is not colour-only. |
| `CONTRAST-TEXT-009` | 1.4.3 AA | src/javascript/osgiConfigManager/App/components/CfgMetatypePropertyDialog.jsx:211 | The 'property already exists' caption uses #db3d44, 4.41:1 on white (just under 4.5:1). | Darken to #c62828 (5.6:1) or the same token chosen for Dialogs.jsx:459. |
| `FORCED-COLORS-001` | n/a | src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:103 | Secret masking in the raw editor relies on color: transparent plus a gradient background; in Windows forced-colors mode the UA may force the text colour and drop the gradient, showing the secret in clear. | Add @media (forced-colors: active) { .ocm-masked-secret { forced-color-adjust: none; color: transparent !important; background-image: radial-gradient(circle, CanvasText 2px, transparent 2.5px); } } and verify in Edge with forced colors on. |
| `FORM-AUTOFILL-001` | n/a | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:735 | The masked secret field is <input type="password"> without autocomplete. A browser password manager can offer or autofill the admin's saved Jahia password into a configuration secret, which would then be saved to the file. | Add autoComplete="new-password" (Chrome ignores 'off' on password fields) to the Moonstone Input; it is spread onto the native input. Also add spellCheck={false} and autoCapitalize="off" to the key and value textareas, so mobile autocorrect does not change keys. |
| `FORM-ERR-002` | 3.3.7 A | src/javascript/osgiConfigManager/App/hooks/useFileActions.ts:118 | A manual filename with a wrong extension is rejected only after the Create dialog has closed, in a separate error modal. The typed name is lost, so the user must reopen the dialog and type it again. | Validate the extension inside ModalDialog before calling onClose(): show the 'Filename must end with .cfg, .yml, .cfg.disabled or .yml.disabled' message inline, linked to the input with aria-describedby and aria-invalid, and keep focus and the value in the field. Keep the server-side check as a fallback. |
| `FORM-ERR-003` | 3.3.1 A | src/javascript/osgiConfigManager/App/components/CfgMetatypePropertyDialog.jsx:123 | When the typed name already exists in the file, pressing Enter closes the dialog without adding or focusing anything. The 'already exists' message (line 210) is not linked or announced, so the user is not told what happened. | On Enter with customAlreadyExists, keep the dialog open, set aria-invalid on the input and link the message with aria-describedby and role="alert". Alternatively, call onCreateCustomProperty(trimmedQuery), whose insertOrFocusProperty already focuses the existing row, then close the dialog. |
| `FORM-ERR-005` | 3.3.1 A | src/javascript/osgiConfigManager/App/hooks/useOsgiConfigs.ts:345 | Duplicate keys in the visual editor are reported only in a modal. The offending rows get no aria-invalid and no inline message, and focus does not move to the first duplicate once the modal is closed. | Keep the modal text, and also mark the duplicate rows: aria-invalid="true" plus aria-describedby pointing to an inline message 'Duplicate key' on each key textarea. Once the modal closes, focus the first duplicate's key field (inputRefs[index].key.focus()). |
| `FORM-ERR-006` | 3.3.1 A | src/javascript/osgiConfigManager/App/utils/configUtils.ts:370 | A property row with an empty key is saved as ' = value' without any warning. The raw editor flags the same line as an error (missingKey), but visual mode does not detect it, so a broken line can be written to a server configuration. | In handleSave (useOsgiConfigs.ts, next to the duplicate check), refuse property entries with an empty key: show an error that names the row, set aria-invalid on its key field and focus it. Or drop empty rows explicitly, with a notice. |
| `FORM-NAME-001` | 1.3.1 A | src/javascript/osgiConfigManager/App/components/CfgMetatypePropertyDialog.jsx:153 | Each property option button sets aria-label={property.id}, which replaces the visible type, default value and description: screen-reader users hear only the identifier and lose the information needed to choose. | Remove the aria-label so the name comes from the button content, or keep the name short and add aria-describedby pointing to the type, default and description elements (give them ids). |
| `FORM-PREVENT-001` | n/a | src/javascript/osgiConfigManager/App/hooks/useFileActions.ts:267 | The upload-conflict dialog sets otherLabel/onOther ('Rename'), but ModalDialog never renders a third button. The only choices are Overwrite or Cancel, so the documented non-destructive way to keep both files cannot be used. | Render config.otherLabel in ModalDialog's footer (Dialogs.jsx:502-524) as a button that calls onClose() and then config.onOther(). Add a Cypress check that the conflict dialog shows three actions. |
| `FORM-REQ-001` | 3.3.2 A | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:750 | Metatype properties declared mandatory (optional: false) are not marked as required in the visual editor: there is no visible indicator and no aria-required. The only way to learn it is the hover tooltip ('Optional: No'). | When propertyMap.get(key)?.optional === false, add aria-required="true" to the value textarea or Input, and a visible marker with text next to the key (for example '*' plus visually hidden '(required)'), explained once above the table. |
| `FORM-REQ-002` | 3.3.2 A | src/javascript/osgiConfigManager/App/components/Dialogs.jsx:224 | The Create dialog's required inputs are not marked as required, and the .cfg/.yml extension rule is not stated before submitting. Create is natively disabled, so it leaves the tab order with no reason given. | Add required / aria-required="true" to the filename and identifier inputs, and state the allowed extensions in a hint linked by aria-describedby. Prefer to keep Create enabled and validate on click: show an inline error with aria-invalid and move focus to the field, instead of disabling silently. |
| `FORM-SEARCH-001` | 3.3.2 A | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:528 | The property filter (Moonstone SearchInput) has no label, only the placeholder 'Filter by property name or value', which disappears when typing. Its role="search" wrapper has no name either. | Pass aria-label={t('editor.filter.label')} to SearchInput (rest props reach the native <input role="searchbox">), or render a visible <label htmlFor> with an id on the input. Keep the placeholder as a hint only. |
| `FORM-SEARCH-002` | 3.3.2 A | src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:101 | The sidebar file filter has only the placeholder 'Filter configs...' as its label. The filtered list then changes with no announced result count, and a deep search refetches from the server silently. | Add aria-label={t('app.searchLabel')} (or a visible label) to SearchInput. Add an always-present <div role="status" aria-live="polite"> stating the result count, for example '12 configurations', updated after filtering or after the deep-search fetch resolves. |
| `FORM-STATUS-001` | 4.1.3 AA | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:536 | The property filter's result count ('Matching properties: N') appears without a live region, so screen-reader users get no feedback that rows were hidden or how many remain. | Wrap the count in an element that is always in the DOM, <div role="status" aria-live="polite">, and render the text inside it only while filtering (do not mount the live region conditionally). |
| `FORM-TYPE-001` | 3.3.2 A | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:750 | Every Metatype type (Boolean, Integer, option lists) is edited in the same free-text field. Allowed values and format are neither offered nor stated, so the user must guess ('true' or 'TRUE'? option key or label?). | Render the control from the Metatype type: a native <select> (or Moonstone Dropdown) for properties with options; a checkbox, or a select with true/false, for Boolean; <input inputMode="numeric"> for Integer/Long. If free text is kept, show the type and allowed values as visible hint text linked with aria-describedby. |
| `HEAD-001` | 1.3.1 A | src/javascript/osgiConfigManager/App/components/SelectedFileHeader.jsx:34 | The selected file name is styled as a heading but rendered as <p> (Moonstone Typography defaults to p whatever the variant), so the editor panel has no heading under the module's h1. | Pass the element: typographyProps={{variant: 'heading', component: 'h2'}} (OverflowPreviewText spreads typographyProps into Typography). Outline target: h1 app title > h2 file list (LAND-001) > h2 selected file name. |
| `KBD-DIALOG-FOCUS-RESET` | 2.4.3 A | src/javascript/osgiConfigManager/App/hooks/useDialogA11y.ts:91 | useDialogA11y re-runs whenever onClose changes; callers pass inline arrows, so any parent re-render while a dialog is open (e.g. a toast appearing or expiring) moves focus back to the dialog's first control. | Store onClose in a ref inside the hook (const onCloseRef = useRef(onClose); onCloseRef.current = onClose) and depend on [isOpen] only; memoize the ToastContext value with useMemo in useToast.tsx:74; optionally wrap the callers' onClose in useCallback. |
| `KBD-FOCUS-LOST-DISABLED` | 2.4.3 A | src/javascript/osgiConfigManager/App/components/SelectedFileHeader.jsx:82 | After Save (focus is returned to the Save button when the review dialog closes) or Cancel, hasUnsaved becomes false and the focused button gets disabled, which drops focus to <body>. | Keep Save/Cancel focusable when nothing is pending (aria-disabled="true" and a no-op handler instead of the disabled attribute), or after the save/cancel completes move focus to a stable target such as the selected file heading (tabIndex={-1}) or the editor. |
| `KBD-FOCUS-LOST-REMOVED` | 2.4.3 A | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:798 | Deleting a .cfg entry returns focus to the delete button's DOM node, which, with index keys, now belongs to the next entry (a second Enter targets a different row), or is gone when the last row was deleted, leaving focus on <body>. | With stable row keys, after deleteProperty move focus to the key field of the entry now at that index, or to the previous row when the last one was deleted, or to the 'Add property' button when the list is empty. |
| `KBD-HOVER-ONLY` | 1.4.13 AA | src/javascript/osgiConfigManager/App/components/AppChrome.jsx:199 | OverflowPreviewText reveals the full text of truncated file names (sidebar) and the file path (header) only on mouseenter, so keyboard users cannot read long names that are cut with an ellipsis. | Show the preview on focus as well (onFocus/onBlur on the focusable ancestor, or render it for the active row of the list), or let the text wrap instead of truncating. For the selected file header, which uses showPreview={false} (SelectedFileHeader.jsx:33), allow the heading to wrap. |
| `KBD-PANEL-FOCUS` | 2.4.3 A | src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:1409 | Opening the Metatype 'Add property' panel leaves focus on the toolbar, the panel sits after the Tab-capturing Monaco editor in DOM order, and closing it unmounts the focused Hide button, dropping focus to <body>. | On open, focus the panel's search Input (ref + useEffect on showPropertyPanel); on close, return focus to the 'Add property' toolbar button; close on Escape. Consider placing the panel before the editor canvas in DOM order (visual order can stay with CSS order). |
| `KBD-STICKY-OBSCURES` | 2.4.11 AA | src/javascript/osgiConfigManager/App/hooks/useToast.tsx:80 | The toast is position: fixed at bottom-right for 6 s with no Escape dismissal and can sit over the bottom-right controls of the editor (e.g. the .cfg footer 'Toggle empty lines' button) while a keyboard user tabs onto them. | Place the toast where it cannot overlap the editor footer (e.g. top-right of the content area), or dismiss it on Escape without moving focus, and pause/close it when focus moves under it. Verify at runtime with the e2e keyboard scan. |
| `LAND-001` | 1.3.1 A | src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:97 | The two panes (file list, editor) and the raw editor's property side panel are anonymous divs with no heading or region name, so they cannot be reached by landmark or heading navigation. | Wrap the sidebar in <nav aria-labelledby="ocm-files-heading"> (or <section>) with an <h2 id="ocm-files-heading"> (visually hidden is fine), the editor Paper (index.jsx:231) in <section aria-labelledby> pointing to the file-name h2 (HEAD-001), and the panel at MonacoEditor.jsx:1435 in <aside aria-labelledby> pointing to its h3. Paper accepts component or wrap it. |
| `LIVE-FILTER-001` | 4.1.3 AA | src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:136 | Typing in the sidebar search or toggling deep search changes the file list without any result count or 'no match' message, so screen reader users do not know how many files match or that none do. | Below the Switch add an always-mounted <Typography role="status" variant="caption">{t('app.searchCount', {count: processedFiles.length, total: files.length})}</Typography> (debounce ~500 ms, as the deep search already is), and show t('app.searchNoResults') in it when the list is empty. |
| `LIVE-FILTER-003` | 4.1.3 AA | src/javascript/osgiConfigManager/App/components/Dialogs.jsx:370 | In the create dialog, the template/factory filter shows 'no configuration'/'no factory' messages that mount with their text and gives no result count, so filtering is silent for screen reader users. | Add one always-mounted <Typography role="status" variant="caption"> under the filter input (Dialogs.jsx:353) carrying t('modal.create.filterCount', {count}) or the empty-state text for the active tab; keep the visible empty items as they are. |
| `LIVE-FILTER-004` | 4.1.3 AA | src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:1490 | The raw editor's 'Available properties' search shows its no-results text by conditional mount and gives no count, so results are not announced. | Add an always-mounted <Typography role="status" variant="caption"> below the Input at line 1469 that holds t('editor.metatype.searchCount', {count: filteredProperties.length}) or t('editor.metatype.noResults'). |
| `LIVE-FILTER-005` | 4.1.3 AA | src/javascript/osgiConfigManager/App/components/CfgMetatypePropertyDialog.jsx:146 | The visual editor's property picker filters its list with no count and no empty-state text at all, so a screen reader user typing a query gets no feedback. | Add an always-mounted <Typography role="status" variant="caption"> after the Input (line 118) with t('editor.metatype.searchCount', {count: filteredProperties.length}), and a visible no-results line when the list is empty. |
| `LIVE-FOCUS-001` | 2.4.3 A | src/javascript/osgiConfigManager/App/index.jsx:282 | After a confirmed save, the Save button becomes disabled and the editor is swapped for the loader, so keyboard focus is likely dropped to the page body and the user loses their place. | Before the reload, move focus to a stable target (e.g. the file-name heading with tabIndex={-1}, or the editor container) and restore it to the editor once loadingFile is false; keep the loader inside the existing container rather than replacing it. |
| `LIVE-LOAD-001` | 4.1.3 AA | src/javascript/osgiConfigManager/App/components/AppChrome.jsx:109 | InlineLoader ('Loading file...', 'Loading files...') has no status role, its spinner has no text alternative, and it is mounted together with its label, so loading is not announced. | Render the loader inside a region that already exists: <div role="status" aria-live="polite">{loadingFile && t('app.loadingFile')}</div> in the editor pane (index.jsx:281), mark the spinner aria-hidden="true", and set aria-busy={loadingFile} on the editor container. Announce completion briefly (e.g. '{{name}} loaded'). |
| `LIVE-LOAD-002` | 4.1.3 AA | src/javascript/osgiConfigManager/App/hooks/useOsgiConfigs.ts:397 | Saving has no in-progress state: nothing visible or announced between confirming the diff and the server reply, and Save stays enabled, so a screen reader user cannot tell a slow save from a lost click. | Add a saving flag set before osgiService.save and cleared in finally; expose it to SelectedFileHeader to disable Save and show t('app.saving') ('Saving...') inside the editor pane's always-mounted role="status" region. |
| `LIVE-LOAD-003` | 4.1.3 AA | src/javascript/osgiConfigManager/App/index.jsx:235 | The file-list loading indicator is only rendered in the empty state; with a file open, Refresh and deep search (useOsgiConfigs.ts:224-238) reload the list with no visible or announced progress or completion. | Expose loadingFiles to FileSidebar, set aria-busy={loadingFiles} on the list container, and update the sidebar's always-mounted role="status" region: t('app.loadingFiles') while loading, then the result count (see LIVE-FILTER-001). After Refresh, announce t('notification.refreshed'). |
| `LIVE-RAW-001` | n/a | src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:1257 | Encrypt and Decrypt in the raw editor rewrite the current line without any confirmation, so a screen reader user on the toolbar button cannot tell the value was encrypted or decrypted (failures do raise a toast). | After editor.executeEdits succeeds, call a polite announcement through the toast region or a raw-editor role="status" region: t('notification.encryptedLine', {line: position.lineNumber}) / t('notification.decryptedLine', {...}). Never put the value itself in the announcement. |
| `LIVE-TOAST-004` | 4.1.3 AA | src/javascript/osgiConfigManager/App/hooks/useToast.tsx:24 | The toast has a single slot and each notify() replaces the previous one; after a save, the success toast can be overwritten by the undecryptable-values warning raised by the reload before it is read. | Keep a short queue (array state) and render each message as its own child of the live region, removing each when it expires or is dismissed; or concatenate pending messages. Avoid clearing a message that is less than ~1 s old. |
| `LIVE-TOAST-006` | 4.1.3 AA | src/javascript/osgiConfigManager/App/hooks/useFileActions.ts:190 | When loading templates fails, the error toast fires and the fallback modal opens in the same tick; if the Moonstone Modal hides content outside itself (aria-hidden/inert), the toast is unreachable and unannounced. | Show the failure inside the fallback modal (prefix its message with the error) instead of, or in addition to, the toast; or render the toast region via portal inside the open modal. Verify at runtime whether Moonstone Modal sets aria-hidden on siblings. |
| `MODAL-CONFIRM-NOT-ALERTDIALOG` | 4.1.2 A | src/javascript/osgiConfigManager/App/components/Dialogs.jsx:272 | Delete, disable, discard-changes, overwrite and error dialogs render as role=dialog with the message not referenced by aria-describedby, so they are not announced as alerts and the question is not exposed as the description. | When config.type is 'confirm' or 'alert' (or isWarning), pass role="alertdialog" and aria-describedby={messageId} to <Modal>; render config.message in an element with that id (ModalHeader children or ModalBody). |
| `MODAL-DESTRUCTIVE-WORDING` | 2.4.6 AA | src/javascript/osgiConfigManager/App/hooks/useFileActions.ts:73 | The delete-file confirmation sets no confirmLabel/cancelLabel, so its danger-coloured button reads 'OK', and the message ('Are you sure you want to delete {{name}}?') does not say the deletion cannot be undone. | Set confirmLabel: t('modal.deleteFile.confirm') = 'Delete' (or 'Delete configuration') and cancelLabel: t('modal.cancel'), add the keys to every locale, and extend modal.deleteFile.message with 'This cannot be undone.' |
| `MODAL-FILTER-COUNT-NOT-ANNOUNCED` | 4.1.3 AA | src/javascript/osgiConfigManager/App/components/CfgMetatypePropertyDialog.jsx:146 | Typing in the property search (and in the Create dialog filter, Dialogs.jsx:353) filters the list with no announced result count, so screen reader users do not know whether anything matched. | Add a polite live region (role="status") in each dialog announcing e.g. t('...resultCount', {count: filteredProperties.length}), debounced; give the result list an accessible name. |
| `MODAL-FOCUS-LOST-AFTER-DELETE` | 2.4.3 A | src/javascript/osgiConfigManager/App/hooks/useFileActions.ts:81 | After a confirmed delete, focus returns to the toolbar Delete button, then selectFile(null) unmounts the toolbar, so keyboard and screen reader focus drops to <body>. | After a successful delete, move focus explicitly to a stable target, e.g. the file list/search field in FileSidebar or the sidebar heading (tabindex=-1), once fetchFiles resolves; the success toast covers the announcement. |
| `MODAL-FOCUS-LOST-AFTER-SAVE` | 2.4.3 A | src/javascript/osgiConfigManager/App/hooks/useOsgiConfigs.ts:389 | Confirming the diff returns focus to the header Save button, which becomes disabled once the save clears hasUnsaved (SelectedFileHeader.jsx:25), so the browser drops focus to <body>. | Keep the Save button focusable after saving (aria-disabled instead of the disabled attribute), or after a successful save move focus to a stable element such as the editor or the file title (tabindex=-1). |
| `MODAL-INPUT-NO-LABEL` | 1.3.1 A | src/javascript/osgiConfigManager/App/components/Dialogs.jsx:301 | Dialog text fields have only a placeholder; the visible captions above them are unassociated <p> elements, here and at Dialogs.jsx:337, :353, :445 and CfgMetatypePropertyDialog.jsx:118. | Give each Input an id and associate the visible caption (<label htmlFor> or aria-labelledby pointing at the caption's id); for the prompt input use the dialog message or title. Moonstone Input passes aria-label/aria-labelledby through to the <input>. |
| `MODAL-METATYPE-TOOLTIP-NOT-FOCUSABLE` | 2.1.1 A | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:695 | The Metatype documentation popover for a property opens only on hover over a non-focusable 'i' div, so keyboard users cannot open it and screen readers read a bare 'i'. | Make the trigger a <button type="button" aria-label={t('...propertyInfo', {name: key})}> with aria-describedby or a toggletip/popover that opens on focus and click and closes on Escape; mark the 'i' glyph aria-hidden. |
| `NONTEXT-CONTRAST-002` | 1.4.11 AA | src/javascript/osgiConfigManager/App/hooks/useToast.tsx:50 | Toast type icons and left borders fall below 3:1 on the white toast: warning #fb0 1.70:1, success #6abb6d 2.35:1, info #00a0e3 2.94:1 (error #f44053 3.68:1 passes). | Use darker variants for icon and border colours (e.g. warning #a36b00, success #2e7d32, info var(--color-accent_dark) #0072b1), each at least 3:1 on #fff. |
| `REFLOW-003` | 1.4.10 AA | src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:163 | File names, the selected file heading and its path are truncated with an ellipsis; the full text appears only in a mouse-hover preview (none for the heading), so at 320 CSS px or with text spacing keyboard and touch users lose the names. | Allow wrapping (overflow-wrap: anywhere, no isNowrap) in the sidebar and in SelectedFileHeader.jsx:31-44, or show the preview on focus too; also remove whiteSpace: 'nowrap' from FLOATING_TOOLTIP_STYLE (AppChrome.jsx:78) and cap it at calc(100vw - 32px). |
| `REFLOW-004` | 1.4.10 AA | src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:79 | The metatype property panel is a fixed 340px non-shrinking column beside the raw editor in a non-wrapping flex row, squeezing the editor to zero width on narrow viewports. | Let RAW_EDITOR_SURFACE_STYLE wrap (flexWrap: 'wrap') or stack below ~768px, and give the panel flex: '1 1 340px', maxWidth: '100%'. |
| `REFLOW-005` | 1.4.10 AA | src/javascript/osgiConfigManager/App/components/CfgMetatypePropertyDialog.jsx:117 | At 400% zoom the property picker body (overflow: hidden) shrinks inside the max-height dialog and clips the 'custom property' section and its button with no way to scroll to them. | Set overflow: 'auto' and minHeight: 0 on the body section and let the inner list use flex: '1 1 auto' instead of a fixed maxHeight: 360px. |
| `RT-AXE-CONTRAST-MOONSTONE` | 1.4.3 AA | src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:137 | Moonstone colours used by the module fail 4.5:1: selected file row (2.89:1), Delete button (3.68:1), outlined Add Property (2.94:1), Create-dialog tabs (2.89 and 3.95:1). | Override these within the module (darker accent #0072b1 for the selected row and outlined buttons, #c62828 for danger) and raise a Moonstone token issue. |
| `RT-FOCUS-PROMPT-LOST` | 2.4.3 A | src/javascript/osgiConfigManager/App/components/Dialogs.jsx:301 | Closing the Add Property prompt with Escape drops focus to <body> instead of returning it to the Add Property button; the prompt input is named only 'Type here...'. | Return focus to the trigger when the prompt closes (it is unmounted-and-remounted, so keep a ref to the trigger), and name the input with the prompt's question. |
| `RT-FOCUS-RING-CONTRAST` | 1.4.11 AA | src/javascript/osgiConfigManager/App/components/AppHeaderBar.jsx:37 | The focus ring on Moonstone buttons, search fields and switch is a 2px #63d1ff outline, about 1.7:1 against the white panels, so focus is hard to see. | Override the focus ring inside the module (e.g. .osgi-config-manager :focus-visible { outline: 2px solid var(--color-accent_dark) }, #0072b1 = 5.2:1) and report the token to the Moonstone team. |
| `SEM-LIST-001` | 1.3.1 A | src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:134 | The configuration file list is marked up as a headerless data table (Moonstone Table/TableRow/TableBodyCell) instead of a list, so AT announces a 2-column table with no headers rather than a list of N files. | Render <ul aria-labelledby="<sidebar heading id>"> with one <li> per file, each containing a <button type="button"> (see SEM-LIST-002). Keep Moonstone styling via classes or switch to Moonstone ListItem if it fits. |
| `SEM-LIST-003` | 4.1.2 A | src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:129 | The file-list scroll container is a focusable div (tabIndex 0) that handles ArrowUp/ArrowDown but has no role or accessible name, so focusing it announces nothing. | If the arrow-key behaviour is kept, give this element role="listbox" and aria-label/aria-labelledby (sidebar heading) and wire aria-activedescendant to the selected option; otherwise remove tabIndex and onKeyDown and rely on the per-file buttons. Its outline:'none' also hides focus (focus specialist). |
| `SEM-TABLE-001` | 1.3.1 A | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:181 | The .cfg visual editor's header row uses TableBodyCell (<td>) inside <thead> instead of header cells, and three header cells are empty, so inputs, checkboxes and buttons in rows get no column context. | Use Moonstone TableHeadCell (renders <th>) with scope="col" for every header cell, and give the drag, type and actions columns visually hidden text (e.g. 'Reorder', 'Type', 'Actions'). Same pattern in Editor.jsx:328 if that editor is kept. |
| `SEM-TABLE-002` | 2.4.3 A | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:583 | Every .cfg row is an extra unnamed tab stop: Moonstone TableRow sets tabIndex 0 on the <tr>, and the module only uses it for an onClick that selects the row. | Pass tabIndex={-1} to TableRow here (props spread after Moonstone's default) so focus goes straight to the row's controls; selection already follows focus through handleInputFocus. |
| `SEM-TABS-001` | 4.1.2 A | src/javascript/osgiConfigManager/App/components/Dialogs.jsx:319 | The Create dialog uses Moonstone Tab/TabItem (role tablist/tab, aria-selected) but the content below is not a tabpanel: no role="tabpanel", aria-controls or aria-labelledby, and the tablist has no name. | Give each TabItem an id and aria-controls, wrap the active tab's content (Dialogs.jsx:332-497) in <div role="tabpanel" id=… aria-labelledby={tabId}>, and add aria-label (e.g. the dialog title) to <Tab>. |
| `TABLE-CAPTION` | 1.3.1 A | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:545 | The .cfg properties table has no <caption>, aria-label or aria-labelledby, so screen readers announce an unnamed table. | Name the table after the file: <Table aria-label={t('editor.table.label', {name: filename})}> or a visually hidden <caption> as the first child (CfgEditor needs the filename prop, available in index.jsx as selectedFile.name). |
| `TABLE-CAPTION` | 1.3.1 A | src/javascript/osgiConfigManager/App/components/Editor.jsx:325 | The YAML properties table has no <caption> or accessible name. | Add a visually hidden <caption> or aria-label naming the file, e.g. 'Properties of {{name}}', as for CfgEditor. |
| `TEXT-SPACING-001` | 1.4.12 AA | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:218 | AutoResizeTextArea recomputes its height only when its value changes and has overflow: hidden, so wrapping added by user text spacing, zoom or a narrower viewport clips the text. | Also resize on width/font changes: observe the textarea with a ResizeObserver (and on window resize), or drop JS sizing for CSS field-sizing: content with overflow: auto as fallback. |
| `TREE-HIERARCHY` | 1.3.1 A | src/javascript/osgiConfigManager/App/components/Editor.jsx:65 | The nesting of YAML keys is shown only by left padding (level * 20px), a blue left border and backgrounds; a screen reader reads a flat list of rows where 'port' under two parents is indistinguishable. | Simplest: make the key cell a row header (th scope="row") holding a visually hidden parent path, e.g. 'server › http › ' before the key. Full option: role="treegrid" with aria-level, aria-expanded and aria-posinset/setsize, which also requires grid keyboard navigation; prefer the simple option. |

3 of these are low confidence and need a human to confirm: `FORCED-COLORS-001` at src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:103, `KBD-STICKY-OBSCURES` at src/javascript/osgiConfigManager/App/hooks/useToast.tsx:80, `LIVE-TOAST-006` at src/javascript/osgiConfigManager/App/hooks/useFileActions.ts:190.

### Minor (38)

Each row names the rule, the criterion it fails, where it is, and what to change.

| Rule | WCAG | Location | Problem | Fix |
|---|---|---|---|---|
| `ARIA-HOVER-041` | 1.4.13 AA | src/javascript/osgiConfigManager/App/components/AppChrome.jsx:216 | The full-text previews for truncated names and values appear on mouse hover only, with pointer-events: none (cannot be hovered) and no Escape dismissal; keyboard users never see them. | Also show the preview on focus of the focusable ancestor, drop pointerEvents:'none' or keep it open while hovered, close on Escape, and mark it role="tooltip" referenced by aria-describedby. Same pattern in CfgEditor.jsx:507 and Editor.jsx:291. |
| `ARIA-NAME-021` | 2.4.6 AA | src/javascript/osgiConfigManager/App/components/Dialogs.jsx:286 | The icon-only close button of ModalDialog is labelled 'Cancel', the same name as the footer Cancel button, so two controls share one name while the icon reads as 'close'. | aria-label={t('modal.close')} (add the key to every locale) and keep the footer button as Cancel. |
| `ARIA-NAME-024` | 4.1.2 A | src/javascript/osgiConfigManager/App/components/DiffModal.tsx:90 | The dialog name is a copy of the visible title passed as aria-label instead of a reference to it, and the title itself renders as a <p>; the two can drift apart and the title is not a heading. | Render the title as a heading with an id and reference it: <Typography id="diff-modal-title" component="h2" …> and aria-labelledby="diff-modal-title" on the role="dialog" element. |
| `ARIA-NAME-040` | 2.4.6 AA | src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:1535 | Every property card has an 'Insert' (or 'Already present') button with the same name, so in a buttons list screen reader users cannot tell which property each one inserts. | aria-label={t('editor.metatype.insertNamed', {name: property.id})} (and the 'already present' variant), keeping the visible 'Insert' text at the start of the name (2.5.3). |
| `ARIA-STATE-035` | 1.3.1 A | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:573 | The selected row, which decides where 'Add property/comment/empty line' inserts, is shown only by a background colour, so screen reader users cannot tell where new entries will go. | Expose the current row: aria-current="true" on the selected TableRow (or aria-selected inside a grid), and include the insertion point in the add buttons' description, e.g. aria-describedby to 'Inserted after line {n}'. |
| `COG-017` | 3.2.4 AA | src/javascript/osgiConfigManager/App/components/DiffModal.tsx:145 | The same close function is a named 'Cancel' button in ModalDialog but an unnamed clickable icon in the review and Add Property dialogs, and the X icon also deletes rows in the .cfg editor while file delete uses a trash icon. | Use one Close button (Moonstone Button, icon Close, aria-label 'Close') in all three dialogs, and use the Delete icon with label 'Delete property' for row deletion (CfgEditor.jsx:792-803). |
| `COG-018` | n/a | src/main/resources/javascript/locales/en.json:6 | Terms vary for one thing: 'Import' button vs 'Upload' in its tooltip, toast and rename dialog; menu label 'OSGi Config Manager' vs title 'OSGi Configurations Manager'; and 'Add Property' names two different actions. | Pick one verb (for example 'Import') for app.import, tooltip.uploadFile, notification.uploadSuccess and modal.rename.title; align label with app.title; and name the raw editor's button 'Browse Metatype properties'. |
| `COG-019` | 2.4.6 AA | src/main/resources/javascript/locales/en.json:138 | Some English labels do not say what they act on or set: 'Hide' (Metatype panel), 'Toggle Comments' and 'Toggle Empty Lines' (state shown only by an eye icon), 'Type here...', and 'Format YAML code' also on .cfg files. | Use 'Hide available properties', 'Show comments'/'Hide comments' and 'Show empty lines'/'Hide empty lines' (with aria-pressed), a specific placeholder or none, and tooltip 'Format the file'. |
| `COG-020` | n/a | src/javascript/osgiConfigManager/App/hooks/useOsgiConfigs.ts:447 | Error messages name the operation and append raw server text but do not suggest a next step; a failed Save shows the bare server message, and 'Toggled status for {{name}}' does not say whether the file is now enabled or disabled. | Use the 'Error saving: {{error}}' key on the Save path, add a recovery hint (e.g. 'Your changes are still in the editor. Try again or download the file.'), and split the toggle toast into '{{name}} enabled' / '{{name}} disabled'. |
| `COG-021` | n/a | src/javascript/osgiConfigManager/App/hooks/useOsgiConfigs.ts:660 | Deleting a comment or empty line asks 'Are you sure you want to delete Add Comment?' (or 'Add Empty Line') because the button labels are reused as the item's name. | Use dedicated strings, e.g. 'Delete this comment?' and 'Delete this empty line?', instead of editor.button.addComment / addEmptyLine. |
| `COG-022` | n/a | src/javascript/osgiConfigManager/App/hooks/useOsgiConfigs.ts:346 | The duplicate-keys alert shows two buttons, 'Cancel' and 'OK', that do the same thing, which suggests a choice that does not exist. | Pass confirmLabel: null and cancelLabel: t('modal.ok') as the other error alerts do (useOsgiConfigs.ts:316-323). |
| `COG-023` | 3.3.2 A | src/javascript/osgiConfigManager/App/components/SelectedFileHeader.jsx:82 | Save is disabled while the YAML or raw content is invalid, and 'Mark as Default' is disabled for module files, with no text near the button saying why; the 'invalid YAML' explanation in handleSave cannot be reached. | Show an inline message beside Save when the content is invalid ('Fix the errors marked in the editor to save') and a reason under Mark as Default when it is unavailable, instead of relying on tooltips on disabled buttons. |
| `COG-024` | n/a | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:614 | Keyboard reordering stays active while the filter is on or comments and empty lines are hidden, so Arrow Up/Down swaps the row with a hidden one: the visible row seems not to move while hidden lines are reordered. | Disable the reorder handle while filtering (as the drag zone already is), and when rows are hidden move the entry past the previous or next visible row. |
| `CONTRAST-TEXT-010` | 1.4.3 AA | src/javascript/osgiConfigManager/App/components/Editor.jsx:120 | The '(empty)' placeholder in the generic ConfigEditor is #ccc italic, 1.61:1 on white. | Use #6b6b6b or darker (at least 4.5:1). Editor.jsx is only rendered for files whose extension is not exactly lower-case .cfg/.yml, hence minor. |
| `DATA-LIST-AS-TABLE` | 1.3.1 A | src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:134 | The file list is a one-dimensional list drawn as a two-column <table> with no headers or caption; the first column holds only a colour bar, so table navigation adds noise and Chromium may expose it as a layout table. | Use list or listbox semantics instead of a table (see link-checker LINK-CONTROL-ELEMENT at FileSidebar.jsx:137): <ul aria-label={t('app.fileListLabel')}> with one item per file, or role="listbox". 1.3.1 does not require table semantics here. |
| `DATA-LIST-SEMANTICS` | 1.3.1 A | src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:1496 | Collections of property and template cards are bare divs (here, CfgMetatypePropertyDialog.jsx:146 and Dialogs.jsx:369/409), so screen readers do not announce a list or the number of items. | Wrap each collection in <ul role="list"> with one <li> per card (role="list" keeps semantics when list-style is none in Safari), keeping the button or radio inside each item. |
| `FORM-REDUNDANT-001` | 3.3.7 A | src/javascript/osgiConfigManager/App/components/Dialogs.jsx:389 | Clicking a Metatype or factory option clears the filename already typed in the Manual tab, so a user who looks at the other tabs and comes back must type it again. | Do not reset manualFilename when a Metatype or factory option is picked. The active tab already decides which payload is sent (handleConfirm), so the manual value can safely stay. |
| `FORM-SEARCH-004` | 3.3.2 A | src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:1471 | The raw editor's 'Available properties' search input is labelled only by the placeholder 'Filter properties...', and the 'no results' text is not announced. | Add aria-label (or a <label> linked to an id) to the Input, and put the result count and the no-results message in an always-present role="status" region. |
| `HEAD-002` | 1.3.1 A | src/javascript/osgiConfigManager/App/components/DiffModal.tsx:131 | Visual headings in the dialogs and side panel are plain <p> (Typography variant heading/subheading without component), and the custom dialogs repeat their title in aria-label instead of referencing a heading. | DiffModal.tsx:131 and CfgMetatypePropertyDialog.jsx:109: component="h2" with an id, and aria-labelledby on the role=dialog in place of aria-label. CfgMetatypePropertyDialog.jsx:207 and MonacoEditor.jsx:1450: component="h3". Dialogs.jsx:334/350 are field captions: make them <label htmlFor>; Dialogs.jsx:365/405 head option lists: the <legend> of the radio group (SEM-DIV-BUTTON-001). |
| `IMG-ICON-003` | 1.1.1 A | src/javascript/osgiConfigManager/App/components/AppChrome.jsx:128 | Decorative Moonstone SVG icons placed outside a named control are not hidden from AT (Moonstone renders <svg> with no aria-hidden or focusable=false), so some screen readers announce an unnamed graphic. | Pass aria-hidden="true" focusable="false" to the icon (SvgWrapper spreads props onto the <svg>): StatusBanner icon AppChrome.jsx:128, toast icons useToast.tsx:50/55/60/65, Chip icon ConfigStateBadge.jsx:30 when the label is shown, comment-row icon CfgEditor.jsx:630. Icons inside labelled buttons need nothing. |
| `KBD-LIST-KEYS` | n/a | src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:77 | The file list supports only Arrow Up/Down, and selection follows focus: each arrow press loads the file and, with unsaved changes, opens the confirmation dialog, so Home/End and moving without loading are not possible. | Add Home/End (and optionally type-ahead). Consider moving an active descendant on arrows and loading the file on Enter/Space, or debounce loading, so browsing past files with unsaved changes does not raise a dialog per keystroke. |
| `KBD-SCROLL-REGION` | 2.1.1 A | src/javascript/osgiConfigManager/App/components/Dialogs.jsx:475 | The 'Existing instances' list of the factory tab scrolls (max-height 140px) but holds only static text and has no tabindex, so its overflow cannot be scrolled by keyboard in Safari. | Add tabIndex={0} role="region" aria-label={t('modal.create.existingInstances')} to the INSTANCES_LIST_STYLE container. |
| `KBD-TOOLTIP-NONFOCUSABLE` | 2.1.1 A | src/javascript/osgiConfigManager/App/components/ConfigStateBadge.jsx:48 | In the sidebar the compact (icon-only) state chip explains the configuration state only through a hover tooltip on a non-focusable Chip, so keyboard users cannot read the state of non-selected files. | Expose the state as text in the row (visually hidden text or the row's accessible name) rather than relying on the tooltip; the full labelled badge in the header covers only the selected file. |
| `LAND-002` | 4.1.2 A | src/javascript/osgiConfigManager/App/components/AppHeaderBar.jsx:37 | role="toolbar" is declared with no accessible name and without the arrow-key roving focus the role promises; the three buttons are ordinary tab stops. | Either remove the role (a plain div of buttons is valid), or keep it with aria-label={t('…toolbarLabel')} and implement roving tabindex with Left/Right arrows. Semantic HTML first: removing the role is the smaller change. |
| `LINK-NEW-WINDOW` | 3.2.5 AAA | src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:742 | The raw editor leaves Monaco's link detection on (links defaults to true), so URLs inside configuration values become Ctrl/Cmd+click links that open a new window without warning and are not exposed to assistive technology. | Add links: false to the monaco.editor.create options: configuration values are data to edit, not navigation. If following URLs is wanted, keep it and document the new-window behaviour in the editor help text. Recommendation only (AAA, beyond the AA target). |
| `LIVE-DIRTY-001` | n/a | src/javascript/osgiConfigManager/App/components/SelectedFileHeader.jsx:64 | Unsaved changes are signalled only by Save/Cancel becoming enabled; there is no text indicator, so screen reader users editing a field get no cue that the file is now modified. | Add a visible 'Unsaved changes' label next to the file name rendered in an always-mounted <span role="status">{hasUnsaved ? t('app.unsavedChanges') : ''}</span>, announced once when the state flips (not on every keystroke). |
| `MODAL-DIFF-INITIAL-FOCUS` | 2.4.3 A | src/javascript/osgiConfigManager/App/components/DiffModal.tsx:134 | When the file holds secrets, the diff dialog's first focusable control, and so its initial focus, is 'Show secrets', so an early Enter reveals masked values instead of letting the user read the change. | Focus a static element first for this complex dialog: render the title as <h2 id tabIndex={-1}>, focus it on open (let useDialogA11y take an initialFocusRef), and point aria-labelledby at it. |
| `MODAL-FOOTER-REVERSED-ORDER` | 2.4.3 A | src/javascript/osgiConfigManager/App/components/Dialogs.jsx:502 | Moonstone ModalFooter lays children out with flex-direction: row-reverse, so Tab goes Cancel then Confirm while they appear right-to-left (Confirm left, Cancel right). | Verify at runtime; if the reversal is confirmed, render the buttons in the order you want them read and tabbed rather than relying on row-reverse (e.g. wrap them in your own flex container inside ModalFooter). |
| `MODAL-INITIAL-FOCUS` | 2.4.3 A | src/javascript/osgiConfigManager/App/components/Dialogs.jsx:285 | Confirmation dialogs open with focus on the top-right X icon (Floating UI initialFocus=0), whose aria-label is 'Cancel' even where the footer's safe action is 'Keep Editing', giving two differently-worded controls for one action. | For confirm/alert dialogs, put autoFocus on the footer cancel Button (the least destructive action; the focus manager keeps focus already inside), and label the X with t('modal.close') ('Close'). |
| `MONACO-THEME-001` | n/a | src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:745 | YAML files use theme 'vs-light', which is not a Monaco built-in theme name; Monaco silently falls back to 'vs'. | Use 'vs' explicitly (keep autoDetectHighContrast at its default true so forced-colors users get hc-light/hc-black). |
| `MOTION-001` | 2.3.3 AAA | src/javascript/osgiConfigManager/App/components/DiffModal.tsx:118 | No prefers-reduced-motion handling anywhere: modal slide-in, overlay transition, infinite loader spin (AppChrome.jsx:118) and smooth scrollIntoView (FileSidebar.jsx:72) always animate. | Add @media (prefers-reduced-motion: reduce) in the App <style> block (index.jsx:364) disabling modalSlideIn and transitions, slowing or replacing the spinner, and pass behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' to scrollIntoView. |
| `NONTEXT-CONTRAST-003` | 1.4.11 AA | src/javascript/osgiConfigManager/App/components/AppChrome.jsx:84 | The 3px enabled/disabled bar in the sidebar is #6abb6d (2.35:1) vs #7a7f88 at 40% (1.61:1) on white, 1.71:1 from each other, and disappears in forced-colors mode. | The line-through on disabled names is a non-colour cue, so keep it; darken the bar colours (e.g. #2e7d32 and var(--color-gray) #7a7f88 opaque) and render the bar as a border-left rather than a background so it survives forced colors, or add a visible 'Disabled' text/icon. |
| `NONTEXT-CONTRAST-004` | 1.4.11 AA | src/javascript/osgiConfigManager/App/components/AppChrome.jsx:97 | StatusBanner icons are below 3:1 on their tinted backgrounds: warning #fb0 on #fff1cc 1.51:1, error #f44053 on #fbd7db 2.78:1 (info #0072b1 on #def4fd 4.57:1 passes). | Use darker icon colours (e.g. warning #8a5a00, error #b71c1c). Low impact since the banner text carries the message. |
| `NONTEXT-CONTRAST-005` | 1.4.11 AA | src/javascript/osgiConfigManager/App/components/Editor.jsx:34 | The multiline value textarea of the generic ConfigEditor has a #ccc border, 1.61:1 on white. | Use a border of at least 3:1, e.g. #8a8a8a or var(--color-gray). |
| `REFLOW-006` | 1.4.10 AA | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:52 | The visual .cfg table columns sum to at least 704px of min-width, forcing horizontal scrolling at 320 CSS px. | A key/value data table may qualify for the two-dimensional-layout exception; if not, lower the property/value minWidth (e.g. 120px) or switch to a stacked key-over-value layout below ~600px. |
| `SEM-LIST-004` | 1.3.1 A | src/javascript/osgiConfigManager/App/components/Dialogs.jsx:476 | Collections are rendered as div stacks rather than lists: existing factory instances, the metatype property options, and the raw editor's property cards. | Use <ul>/<li> (list-style: none) for Dialogs.jsx:476-489, CfgMetatypePropertyDialog.jsx:137-197 and MonacoEditor.jsx:1489-1572 so AT announces the count and allows list navigation. |
| `TABLE-EMPTY-STATE` | n/a | src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:547 | When a file has no entries (or every row is hidden by filter or comment toggles) the .cfg and YAML tables (Editor.jsx:334) render only their header row, with no message. | When no row renders, add <TableRow><TableBodyCell colSpan={6}>{t('editor.noEntries')}</TableBodyCell></TableRow> (colSpan={4} in Editor.jsx), with a filter-specific text when filtering. |
| `TABLE-ROW-HEADER` | 1.3.1 A | src/javascript/osgiConfigManager/App/components/Editor.jsx:62 | In the YAML table the property key cell identifies each row but is a <td>, so the Value, Security and Actions cells are not announced with their property name. | Render the key cell as <TableBodyCell component="th" scope="row">. Include the parent path in it as visually hidden text (see TREE-HIERARCHY) so a nested key is unambiguous. |

2 of these are low confidence and need a human to confirm: `MODAL-FOOTER-REVERSED-ORDER` at src/javascript/osgiConfigManager/App/components/Dialogs.jsx:502, `REFLOW-006` at src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:52.

## Remediation priorities

Fix these components first. Each one carries the same defect in several places, so one fix clears every instance.

| Component | Instances | Worst severity | Rules |
|---|---:|---|---|
| CfgEditor | 19 | serious | `ARIA-KBD-033`, `ARIA-NAME-029`, `ARIA-NAME-031`, `ARIA-SEM-028`, `ARIA-STATE-035`, `COG-010`, `COG-024`, `CONTRAST-TEXT-003`, `CONTRAST-TEXT-006`, `CONTRAST-TEXT-007`, `KBD-DRAG-ONLY-POINTER`, `KBD-FOCUS-LOST-REMOVED`, `KBD-REORDER-FOCUS`, `LIVE-FILTER-002`, `LIVE-REORDER-001`, `NONTEXT-CONTRAST-001`, `REFLOW-006`, `SEM-TABLE-002`, `TABLE-CAPTION` |
| FileSidebar | 16 | serious | `ARIA-KBD-002`, `ARIA-NAME-006`, `ARIA-SEL-001`, `COG-012`, `DATA-LIST-AS-TABLE`, `FOCUS-VISIBLE-002`, `IMG-STATE-001`, `KBD-LIST-KEYS`, `LINK-CONTROL-ELEMENT`, `LIVE-FILTER-001`, `LIVE-LOAD-003`, `NONTEXT-CONTRAST-003`, `REFLOW-001`, `SEM-LIST-001`, `SEM-LIST-002`, `SEM-LIST-003` |
| MonacoEditor | 15 | serious | `ARIA-NAME-036`, `ARIA-NAME-039`, `ARIA-NAME-040`, `ARIA-PRIV-037`, `ARIA-STATE-038`, `COG-013`, `COG-014`, `FORCED-COLORS-001`, `KBD-PANEL-FOCUS`, `KBD-TRAP-EDITOR`, `LINK-NEW-WINDOW`, `LIVE-FILTER-004`, `LIVE-RAW-001`, `MONACO-THEME-001`, `REFLOW-004` |
| ModalDialog | 14 | serious | `ARIA-DESC-018`, `ARIA-NAME-017`, `ARIA-NAME-021`, `COG-003`, `CONTRAST-TEXT-008`, `FORM-PREVENT-001`, `KBD-SCROLL-REGION`, `LIVE-FILTER-003`, `LIVE-VALID-001`, `MODAL-CONFIRM-NOT-ALERTDIALOG`, `MODAL-FOOTER-REVERSED-ORDER`, `MODAL-INITIAL-FOCUS`, `RT-MODAL-NAME`, `SEM-TABS-001` |
| ToastProvider | 9 | critical | `ARIA-LIVE-012`, `COG-001`, `COLOR-ONLY-002`, `KBD-STICKY-OBSCURES`, `LIVE-TOAST-001`, `LIVE-TOAST-002`, `LIVE-TOAST-003`, `LIVE-TOAST-004`, `NONTEXT-CONTRAST-002` |
| DiffModal | 9 | serious | `ARIA-NAME-024`, `ARIA-SEM-022`, `COLOR-ONLY-001`, `CONTRAST-TEXT-002`, `MODAL-DIFF-INITIAL-FOCUS`, `MODAL-DIFF-SCROLL-REGION`, `REFLOW-002`, `SEM-DIFF-001`, `SEM-DIV-BUTTON-002` |
| SelectedFileHeader | 9 | serious | `ARIA-DESC-011`, `ARIA-SEM-010`, `COG-009`, `COG-015`, `COG-023`, `HEAD-001`, `KBD-FOCUS-LOST-DISABLED`, `LIVE-DIRTY-001`, `LIVE-VALID-003` |
| ConfigEditor | 8 | serious | `ARIA-KBD-043`, `ARIA-TREE-042`, `CONTRAST-TEXT-010`, `FORM-LEGACY-001`, `NONTEXT-CONTRAST-005`, `TABLE-CAPTION`, `TABLE-HEADER-TD`, `TREE-HIERARCHY` |
| CfgMetatypePropertyDialog | 8 | serious | `ARIA-NAME-026`, `CONTRAST-TEXT-009`, `FORM-ERR-003`, `FORM-NAME-001`, `LIVE-FILTER-005`, `LIVE-VALID-002`, `REFLOW-005`, `SEM-DIV-BUTTON-003` |
| ModalDialog createConfig | 7 | critical | `COG-005`, `COG-006`, `COG-011`, `FORM-CUSTOM-001`, `FORM-ERR-002`, `FORM-REDUNDANT-001`, `FORM-REQ-002` |
| CfgEditor row | 6 | critical | `FORM-AUTOFILL-001`, `FORM-HELP-001`, `FORM-LABEL-001`, `FORM-LABEL-002`, `FORM-REQ-001`, `FORM-TYPE-001` |
| CreateOptionCard | 4 | critical | `ARIA-KBD-016`, `CONTRAST-TEXT-001`, `SEM-DIV-BUTTON-001`, `STATE-INDICATOR-001` |
| StatusBanner | 3 | serious | `ARIA-LIVE-013`, `LIVE-ERR-001`, `NONTEXT-CONTRAST-004` |
| ConfigStateBadge | 3 | serious | `ARIA-NAME-005`, `IMG-ICON-001`, `KBD-TOOLTIP-NONFOCUSABLE` |
| useFileActions | 3 | serious | `COG-002`, `COG-004`, `COG-008` |
| LeafRow | 3 | serious | `TABLE-CELL-CONTROL-NAME`, `TABLE-INLINE-EDIT`, `TABLE-ROW-HEADER` |
| OverflowPreviewText | 3 | moderate | `ARIA-HOVER-041`, `KBD-HOVER-ONLY`, `REFLOW-003` |
| App layout | 2 | critical | `RT-REFLOW-320`, `RT-REFLOW-CLIP` |
| CfgEditorFooter | 2 | serious | `ARIA-STATE-034`, `CONTRAST-TEXT-004` |
| AutoResizeTextArea | 2 | serious | `FOCUS-VISIBLE-001`, `TEXT-SPACING-001` |
| ModalDialog prompt | 2 | serious | `FORM-LABEL-007`, `RT-FOCUS-PROMPT-LOST` |
| useDialogA11y | 2 | serious | `KBD-DIALOG-FOCUS-RESET`, `MODAL-CUSTOM-BACKGROUND-NOT-INERT` |
| CfgEditorHeader | 2 | serious | `SEM-TABLE-001`, `TABLE-HEADER-TD` |
| InlineLoader | 2 | moderate | `ARIA-LIVE-014`, `LIVE-LOAD-001` |
| AppHeaderBar | 2 | moderate | `ARIA-ROLE-009`, `LAND-002` |
| Visual editor save | 2 | moderate | `FORM-ERR-005`, `FORM-ERR-006` |
| SearchInput usage | 2 | moderate | `FORM-SEARCH-001`, `FORM-SEARCH-002` |

Then the 75 remaining blocking findings, in this order:

1. `ARIA-KBD-016` at src/javascript/osgiConfigManager/App/components/Dialogs.jsx:91. Make the list a single-select group: container role="radiogroup" aria-labelledby the 'Template'/'Factory' heading; each card role="radio" aria-checked={isSelected} tabIndex={isSelected||first ? 0 : -1} with Arrow-key roving and Space/Enter to select. Native <input type="radio"> in a <label> is simpler and preferred.
2. `CONTRAST-TEXT-001` at src/javascript/osgiConfigManager/App/components/Dialogs.jsx:110. Use an opaque token that reaches 4.5:1, e.g. color: 'var(--color-gray_dark)' (#293136, 12.9:1) or drop the inline colour and use Typography color="textSecondary" after runtime check. Never use the 20/40/60 alpha tokens for text.
3. `FORM-CUSTOM-001` at src/javascript/osgiConfigManager/App/components/Dialogs.jsx:90. Make it a native single-choice group: <fieldset><legend>{t('modal.create.templateLabel')}</legend> and, per option, <label><input type="radio" name="metatype" value={pid} checked={isSelected} onChange={onClick}/> title, subtitle, description</label>. The arrow keys, focus and the checked state then come from the browser. Same for the factory list (line 418).
4. `FORM-LABEL-001` at src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:778. Moonstone Checkbox spreads extra props onto the native input, so pass a name: <Checkbox aria-label={t('editor.encryptValueOf', {key: key || t('editor.placeholder.key')})} .../>. The title='Security' on the surrounding TableBodyCell (line 777) is on the <td>, not the input, and does not count.
5. `LIVE-TOAST-001` at src/javascript/osgiConfigManager/App/hooks/useToast.tsx:76. Render one wrapper unconditionally inside ToastProvider and change only its content: <div role="status" aria-live="polite" data-cy="toast-region">{toast && <Paper ...>...</Paper>}</div>. Keep the wrapper visible (no display:none); position the Paper as today. Do not move focus to it.
6. `MODAL-CREATE-OPTION-NOT-KEYBOARD` at src/javascript/osgiConfigManager/App/components/Dialogs.jsx:90. Render each CreateOptionCard as a <button type="button" aria-pressed={isSelected}> (or an ARIA listbox with role=option/aria-selected and arrow-key handling) wrapping the title/subtitle text; keep the click handler and selection style. Selection state must be exposed programmatically, not only by background colour.
7. `RT-REFLOW-CLIP` at src/javascript/osgiConfigManager/App/components/AppChrome.jsx:19. Let the two panes shrink and wrap: replace the fixed 350px sidebar with flex: '0 1 350px' + minWidth: 0, allow the file header/toolbar rows to wrap (flexWrap: 'wrap'), and stack sidebar over editor below ~900px of available width; give the editor pane overflow: auto rather than hidden so nothing becomes unreachable.
8. `SEM-DIV-BUTTON-001` at src/javascript/osgiConfigManager/App/components/Dialogs.jsx:91. Render each option as a native control: a radio group (<fieldset><legend>{templateLabel}</legend> then per option <label><input type="radio" name="pid" checked={isSelected}/> title/subtitle/meta</label>) inside a <ul>, or <button type="button" aria-pressed={isSelected}> in <li>. Keep the card look with CSS. Applies to both uses at Dialogs.jsx:379 and :419.
9. `ARIA-KBD-002` at src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:137. When adopting the listbox pattern, pass tabIndex={-1} to every TableRow (props spread after Moonstone's tabIndex: 0) and let the container own focus. Activate on Enter/Space too: onKeyDown={e => (e.key==='Enter'||e.key===' ') && (e.preventDefault(), handleFileClick(f))}.
10. `ARIA-KBD-033` at src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:696. Use a button: <button type="button" aria-label={t('editor.metatype.aboutProperty', {key})} aria-describedby={`cfg-doc-${index}`}>i</button> and render the documentation in an element with that id (visually hidden or a toggletip opened on click/Enter, dismissible with Escape).
11. `ARIA-KBD-043` at src/javascript/osgiConfigManager/App/components/Editor.jsx:102. Render a <button type="button" aria-label={t('editor.aria.editValue', {key: rowLabel})} onClick={…setEditingValueKey(keyString)}> or an always-present labelled input; name the edit Input/textarea (lines 87-99) and the encrypt Checkbox (line 125).
12. `ARIA-LIVE-012` at src/javascript/osgiConfigManager/App/hooks/useToast.tsx:77. Keep a live region always mounted and change only its text: <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{toast?.type !== 'error' ? toast?.message : ''}</div> plus a role="alert" region for errors; keep the visual Paper aria-hidden="true" or put the role on it while it stays mounted.
13. `ARIA-LIVE-013` at src/javascript/osgiConfigManager/App/components/AppChrome.jsx:131. Map tone to a role: <div role={tone === 'error' ? 'alert' : 'status'} ...>. Because banners mount with the file, render the role container once in index.jsx and swap its text, or accept that role=alert on mount is announced. Mark the tone icon aria-hidden="true".
14. `ARIA-NAME-005` at src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:176. In ConfigStateBadge compact mode, keep the text for AT (aria-label alone is not reliable on a role-less div): render <span className="sr-only">{t(config.labelKey)}</span> beside the icon (or role="img" aria-label={t(config.labelKey)} on the Chip).
15. `ARIA-NAME-006` at src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:117. Associate the visible text: <Switch id="deep-search-switch" ... /> and <Typography component="label" htmlFor="deep-search-switch">{t('app.searchDeep')}</Typography> (Switch spreads rest props onto the input). Alternatively aria-label={t('app.searchDeep')} plus aria-describedby to the tooltip text.
16. `ARIA-NAME-007` at src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:101. Pass a name to the input (SearchInput forwards rest props to <input>): aria-label={t('app.searchLabel')} in FileSidebar.jsx:101 and aria-label={t('editor.filter.label')} in CfgEditor.jsx:528. Add the keys to every locale file.
17. `ARIA-NAME-017` at src/javascript/osgiConfigManager/App/components/Dialogs.jsx:337. Associate the visible text: give each Typography component="label" htmlFor and the Input a matching id (Moonstone Input forwards id), e.g. <Typography component="label" htmlFor="create-manual">…</Typography><Input id="create-manual" …/>. For the prompt (line 301) use aria-labelledby the ModalHeader message.
18. `ARIA-NAME-026` at src/javascript/osgiConfigManager/App/components/CfgMetatypePropertyDialog.jsx:118. <Input aria-label={t('editor.metatype.cfgPicker.searchLabel')} aria-describedby="cfg-picker-feedback" aria-invalid={customAlreadyExists} …/>, give the feedback block id="cfg-picker-feedback" role="status", and add a polite count ("{n} properties") there.
19. `ARIA-NAME-029` at src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:684. Name each field from its row: key aria-label={t('editor.aria.key', {line: index + 1})}; value aria-label={t('editor.aria.value', {key: key || index + 1})} on AutoResizeTextArea (line 750) and the masked Input (line 735); comment aria-label={t('editor.aria.comment', {line: index + 1})} (line 652).
20. `ARIA-NAME-039` at src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:1470. aria-label={t('editor.metatype.searchLabel')} on the Input (forwarded to <input>), or a visible <label htmlFor>.
55 more are in the findings table above.

The remaining 123 moderate and minor findings can follow in normal work.

## What passed

108 checks ran and found nothing.

- 1.3.5 Identify Input Purpose: not applicable. No field collects the user's own personal data, so no autocomplete token from the WCAG list applies.
- 1.4.4 Resize text: all font sizes are px/rem and scale with browser zoom; no viewport-unit font sizes; fixed 48px sidebar row heights still fit one 200% text line
- 2.1.4 Character Key Shortcuts: no single-character shortcut registered; no document-level key listener except Escape/Tab inside open dialogs (useDialogA11y), no Monaco addCommand/addAction, Monaco default bindings are modifier-based and active only while the editor has focus.
- 2.2.2 Pause, Stop, Hide: the only animation is the loading spinner, which appears only while data loads.
- 2.4.6 Page title h1 'OSGi Configurations Manager', dialog titles ('Review Changes: {{name}}', 'Disable configuration', 'Unsaved Changes') and the unsaved-changes buttons are descriptive.
- 3.2.1 On Focus: focusing a .cfg input only highlights its row; no focus handler opens dialogs, navigates or submits.
- 3.2.2 On Input: the 'Search in content' switch, the encryption checkbox and the show/hide-secrets buttons change only the current view or a pending edit.
- 3.2.3 Consistent Navigation: a single admin route; the header toolbar (New, Import, Refresh) and the file toolbar (Disable/Enable, Mark as Default, Download, Delete) keep the same order and position for every file.
- 3.3.3 Error Suggestion: the invalid-extension messages name the accepted extensions (modal.error.invalidExtension, invalidExtensionUpload), and the duplicate-key message names the keys.
- 3.3.4 Disable and Mark as Default ask for confirmation, with a specific action label ('Disable', 'Mark as Default') (useFileActions.ts:59-69, 93-101).
- 3.3.4 Encryption: the visual-mode checkbox and the raw Encrypt button only change the editor, so the change is reviewed in the save diff before it reaches the server.
- 3.3.4 Error Prevention (destructive actions): deleting a file, disabling a file, deleting a property, marking a file as default, overwriting on upload and discarding unsaved changes all ask for confirmation first (useFileActions.ts:59-116, useOsgiConfigs.ts:670-675, index.jsx:110-125).
- 3.3.4 Error Prevention (save): every save of a changed configuration goes through a review-before-save diff (useOsgiConfigs.ts:381-394, DiffModal) with separate Cancel and Confirm.
- 3.3.4 Save: every save goes through a review-before-save diff that must be confirmed (useOsgiConfigs.ts:382-395, DiffModal.tsx), with secrets masked.
- 3.3.4 Unsaved edits are guarded before switching file, refreshing, creating, importing, toggling and marking as default ('Discard Changes' / 'Keep Editing', index.jsx:110-202).
- 3.3.7 Create: the filter text is kept when switching between the Configuration and Factory tabs; factory instance identifiers already in use are flagged live before submission (Dialogs.jsx:200-207, 458-462).
- 3.3.8 Accessible Authentication: not applicable. The module has no sign-in; Jahia's own login handles it. The cryptoSecret passphrase is configuration data, not a login step.
- Actions are buttons: modal close (Dialogs.jsx:285), Metatype options (CfgMetatypePropertyDialog.jsx:149), reorder handle (CfgEditor.jsx:608), toolbar actions (SelectedFileToolbar.jsx, MonacoEditor.jsx:1355-1412).
- All dialog triggers are real buttons (Moonstone Button/ActionButton)
- CfgEditor drag-handle icon gray_dark60: 3.82:1 on white, 3.63:1 on selected row (1.4.11)
- CfgEditor reorder handle is a native <button> with an aria-label and an Arrow Up/Down alternative to drag-and-drop (2.5.7).
- CfgEditor row onClick (selection) has a keyboard equivalent: focusing any field of the row selects it (handleInputFocus).
- CfgMetatypePropertyDialog: #666 on white 5.74:1, #555 on #fafafa 7.14:1, #0077b6 on white 4.87:1; tooltip doc text #fff/#d7e2e8/#f1f5f7 on dark tooltip >= 13:1 (assuming Moonstone tooltip bg #131c21)
- CfgMetatypePropertyDialog: role=dialog, aria-modal, aria-label; useDialogA11y moves focus into the dialog, keeps Tab inside it, closes on Escape and gives focus back on close.
- Comment rows: italic + '#' marker + Comments icon give a non-colour cue (contrast fails separately)
- ConfigStateBadge: MODULE / MODULE_DEFAULT / USER differ by icon shape (Build/Module/Edit) and label, not colour alone
- Ctrl+Shift+M (macOS) does release Tab from the Monaco editor; no other keyboard trap found
- Custom dialogs (DiffModal, CfgMetatypePropertyDialog) move focus in, trap Tab/Shift+Tab, close on Escape and restore focus via useDialogA11y.
- Custom dialogs DiffModal and CfgMetatypePropertyDialog use role="dialog" + aria-modal="true" and useDialogA11y: focus moves in, Tab/Shift+Tab trapped, Escape closes, focus restored to the trigger.
- Deep search server query is debounced 500 ms (useOsgiConfigs.ts:223-238); no high-frequency updates found that would need further debouncing.
- DiffModal and CfgMetatypePropertyDialog: role=dialog + aria-modal=true + non-empty aria-label; Escape closes via useDialogA11y; focus moves inside on open; Paper forwards the ref so the trap container is attached
- DiffModal close icon #888 on white 3.54:1 (1.4.11)
- DiffModal context text #333 on #f5f5f5 11.59:1; title #111 18.88:1; added 4.86:1 and removed 4.77:1 each pass 1.4.3 individually
- DiffModal: a unified single-column diff with no line numbers or side-by-side columns is not tabular data; 1.3.1 does not require table semantics, only change markers (reported separately).
- DiffModal: focus returns to the Save trigger on Cancel/Escape/backdrop (no autoFocus inside)
- Disabled config files: line-through on name and Enable/Disable label in toolbar give a non-colour cue
- Drag reordering has a keyboard alternative (reorder button, CfgEditor.jsx:608-622), so it is not drag-only (2.5.7).
- Each dialog has a visible Cancel/OK action; ModalDialog's X is a real Button with an aria-label
- Editor.jsx floating overlay #333 on #fff 12.63:1
- File upload: a native <input type="file" accept=".yml,.cfg"> opened by a labelled button (AppHeaderBar.jsx:65-72); the file name is checked and an error is shown when it is wrong.
- Header, file toolbar, raw-editor toolbar and footer buttons all have visible text labels; no icon-only button there lacks a name.
- Hidden file input (display:none) is only triggered from the labelled Import button.
- Icons inside buttons that have a visible label or aria-label (ActionButton, raw editor toolbar, reorder button, show/hide secret button, Dialogs close button) are presentational children of the button and need no text alternative.
- InlineLoader spinner (AppChrome.jsx:111) is a CSS-only element with a visible text label beside it.
- Label in name (2.5.3): the Metatype option buttons (CfgMetatypePropertyDialog.jsx:149-153) use aria-label={property.id}, which matches their visible bold label.
- Locale parity: all six locale files have the same 193 keys, so no label falls back to a raw key.
- Masked values in the YAML table show a text placeholder ('*****', Editor.jsx:120) rather than an empty cell.
- Masked-secret dots #4a5561: 7.60:1 on white, 5.01:1 on Monaco selection #add6ff
- Metatype info badge 'i' #0072b1 on #def4fd 4.57:1
- Metatype metadata inside cards ('Type: x', 'Optional: yes', 'Default: y', MonacoEditor.jsx:1551-1567; CfgMetatypePropertyDialog.jsx:179-188) keeps the label in the same text as the value, so <dl> markup is not required.
- Metatype property cards in the raw editor panel: onDoubleClick insertion has a keyboard-operable 'Insert' button equivalent (MonacoEditor.jsx:1534).
- Metatype property options in CfgMetatypePropertyDialog are native <button type="button"> elements.
- Metatype property options in CfgMetatypePropertyDialog are native <button> elements (CfgMetatypePropertyDialog.jsx:149).
- Metatype property picker dialog options are native <button> elements (CfgMetatypePropertyDialog.jsx:149).
- Modal dialogs (DiffModal, CfgMetatypePropertyDialog) carry role="dialog", aria-modal and an accessible name.
- Module h1 'OSGi Configurations Manager' is inside the shell's <main> landmark
- Monaco 'properties-theme' token colours on #fffffe: key #0000FF 8.59:1, comment #008000 5.13:1, delimiter/string #000000 21:1
- Moonstone Modal (Dialogs.jsx ModalDialog) uses floating-ui FloatingFocusManager (modal trap, returnFocus=true) and useDismiss (Escape), checked in @jahia/moonstone 2.20.3 dist/index.js.
- Moonstone Modal (ModalDialog) uses floating-ui FloatingFocusManager with role=dialog and aria-modal.
- Moonstone Modal (ModalDialog): role=dialog, aria-modal=true, focus moved inside on open, Tab trapped by Floating UI focus guards, background siblings set aria-hidden=true while open (probe)
- Moonstone Modal: Escape and outside mousedown close via onOpenChange(false) -> onClose; focus returns to the still-connected trigger on close (probe: activeElement = trigger)
- Moonstone ModalDialog: focus moves inside on open, background is aria-hidden while open, Escape closes, focus returns to the Delete button
- Moonstone TabItem in the create dialog renders role=tab buttons with a horizontal roving arrow-key hook.
- Moonstone Tooltip opens on focus as well as hover (useFocus), so tooltips on Buttons (ActionButton, EditorToolbarButton, secret toggle) are keyboard-reachable.
- Moonstone tooltip label CSS (index.jsx:371-383) wraps and caps width at calc(100vw - 32px) - reflow-safe
- No <a> element is rendered anywhere in scope: Editor.jsx, CfgEditor.jsx and FileSidebar.jsx contain no anchors or hrefs (their grep hits were table markup).
- No <img>, <picture>, <figure>, <video>, <audio>, <canvas> or CSS background image carrying information in the module.
- No ambiguous link text (click here, read more, learn more, here) and no raw URL used as link text, in JSX or in locales/en.json.
- No aria-labelledby / aria-describedby / aria-controls IDREFs authored by the module, hence none broken (dangling references come from Moonstone, see notes).
- No aria-live="assertive" or role="alert" misuse on routine updates (the module declares no live regions at all).
- No document.title or lang handling in the module; both belong to the Jahia shell.
- No href="#", javascript: URL, or anchor used as a button.
- No live region hidden with display:none or visibility:hidden.
- No nested modals: chained dialogs (upload conflict -> rename prompt, add-property error) close the first and open the next after a 100 ms timeout
- No positive tabindex anywhere in scope (only tabIndex={0} on the file list and tabindex=-1 set programmatically by useDialogA11y).
- No positive tabindex values in module code.
- No repeated identical link texts pointing to different destinations, and no adjacent icon + text link duplicates.
- No role="button"/"link"/"checkbox" or landmark roles added to native elements in module code (no redundant ARIA authored by the module).
- No role="grid" or treegrid misuse, and no layout table needing role="presentation" (the file list is reported as a list drawn as a table).
- No sortable columns, pagination, select-all checkbox or row multi-selection, so aria-sort, aria-current pagination and indeterminate-state checks do not apply.
- No streaming transcript or log-style content in scope.
- No target="_blank", window.open or other new-tab navigation in application code.
- Page title is a real <h1> (AppHeaderBar Typography component="h1").
- Password visibility toggle: a native button whose aria-label follows its state, 'Show secret value' or 'Hide secret value' (CfgEditor.jsx:762-773).
- Prompt inputs submit on Enter, and every dialog has a real <button> (Moonstone Button renders <button type="button">).
- Property picker options are real <button> elements; choosing one moves focus to the new value field (focusEntryValue)
- Raw editor toolbar dividers (MonacoEditor.jsx:97) are empty decorative divs with no semantics, which is correct.
- Reorder handle is a native <button> with an aria-label describing the Arrow Up/Down interaction (keyboard alternative to drag exists, defects aside).
- Reorder handle is a native <button> with aria-label and keyboard reordering (CfgEditor.jsx:608).
- Show/hide secret buttons (CfgEditor.jsx:764) carry an aria-label that switches with state.
- The .cfg and YAML property lists are real tables (moonstone Table/TableBody/TableRow/TableBodyCell render <table>/<tbody>/<tr>/<td>), not div grids, so 1.3.1 does not require converting div layouts there.
- The hidden file input (AppHeaderBar.jsx:65) is display:none and opened by a labelled button.
- The module renders one h1 (AppHeaderBar.jsx:27, component="h1") holding the app title.
- The only anchor is the detached download anchor built in index.jsx:98-107 (href to a blob URL, download=file.name), clicked programmatically and removed; the user-facing trigger is a real Button labelled Download (SelectedFileToolbar.jsx:85-89) next to the selected file's name.
- The reorder handle is a native <button type="button"> with an aria-label that explains Arrow Up/Down (CfgEditor.jsx:608-626).
- Toast: minWidth 280px + 20px offset fits a 320px viewport; maxWidth 520px
- Toasts do not steal focus (useToast.tsx renders without focusing).
- Toolbar and header actions (New, Import, Refresh, Save, Cancel, Enable/Disable, Mark as default, Download, Delete, raw-editor toolbar) are Moonstone Buttons, i.e. native buttons.
- Toolbar buttons (New, Import, Refresh, Cancel, Delete) show a visible focus outline
- Unsaved-changes confirmation wording is explicit ('Discard Changes' / 'Keep Editing'); disable and overwrite confirmations name the action
- Upload: the hidden file input is triggered from a real button; no keyboard dead end.
- WCAG 1.4.12 text-spacing override (line-height 1.5, letter 0.12em, word 0.16em, paragraph 2em): no clipped text detected on the initial page
- YAML filenames in sidebar var(--color-accent_dark) #0072b1 on white 5.20:1; file type also stated by the extension, not colour-only
- axe target-size (2.5.8): no violation in any of the 15 states
- axe: no duplicate-id, button-name, image-alt, list or heading-order violation inside the module
- colSpan values match the column count: CfgEditor comment row 1+1+2+1+1 = 6 columns (line 636), YAML container row colSpan=4 for 4 columns (Editor.jsx:162).
- useDialogA11y restores focus to the trigger on close (useDialogA11y.ts:84-89), so feedback after a confirm dialog starts from a known focus point.
- useDialogA11y.ts:4 includes a[href] in its focusable selector, so a future link inside a dialog stays inside the focus trap.

## Needs a human

Items a skill could not decide, or could not check automatically.

- **alt-text-headings**: Contrary to the brief, the module owns the page h1: AppHeaderBar.jsx:23-32 renders <header> plus <Typography component="h1">. Runtime check needed: confirm the Jahia shell does not add another h1, and that this <header> sits inside the shell's <main> (Moonstone LayoutModule renders main); if it does not, it becomes a second banner landmark.
- **alt-text-headings**: Moonstone ModalHeader (used by Dialogs.jsx:293) renders the dialog title as an <h4> inside a <header>; the level is not configurable from the module. Dialog headings conventionally restart at h2; raise it with the Moonstone team if the jump from h1 matters.
- **alt-text-headings**: Moonstone TableRow/TableBodyCell apply flex classes to <tr>/<td>. Some browsers drop table semantics when table elements get display:flex; the runtime a11y tree should confirm whether the CfgEditor table is still exposed as a table.
- **alt-text-headings**: Editor.jsx (ConfigEditor) is only rendered for files that are neither .cfg nor .yml (index.jsx:326), and the server only lists .cfg/.yml and their .disabled forms (OsgiConfigService.java:43), so it is effectively dead code. It would add: a td-as-button collapse toggle with no aria-expanded (Editor.jsx:161-171), a double-click-only value editor div (Editor.jsx:102-121), and decorative Chevron/Folder icons. Not reported as findings; delete the component or fix those if it is ever reached.
- **alt-text-headings**: Outside WCAG, but in line with the project's secret-masking invariant: MonacoEditor masks secrets with a CSS decoration that makes the characters transparent (MonacoEditor.jsx:103-111). The plaintext stays in the Monaco model, which Monaco exposes to screen readers, so a screen reader reads the 'masked' secret aloud. The CfgEditor (type=password) and DiffModal (text replaced) do not have this problem. Worth a decision by the maintainer.
- **alt-text-headings**: Left to the forms/ARIA specialists: the 'Search in content' Switch is not associated with its visible text (FileSidebar.jsx:117-124); the editor-mode Dropdown has no label (SelectedFileToolbar.jsx:104); SearchInput and dialog Inputs rely on placeholders; the encryption Checkbox per row has no label (CfgEditor.jsx:778, title is on the td). Status banners and the toast have no live-region role (AppChrome.jsx:131, useToast.tsx:77).
- **alt-text-headings**: Moonstone Tooltip clones a fixed id 'moonstone-tooltip_label' into aria-describedby on its child; with several tooltips open in sequence that is fine, but the id is not unique per instance (Moonstone internal).
- **aria-specialist**: Moonstone defects the module can only work around: Dropdown puts role="listbox" on the trigger with a role="option" span and no aria-expanded; Modal labels itself (aria-labelledby = its own id); TableRow forces tabIndex=0; TabItem keeps every tab at tabIndex 0 (no roving) and arrows do not wrap; Switch and Checkbox add redundant role="checkbox"/aria-checked on native checkboxes; Tooltip clones aria-describedby="moonstone-tooltip_label" (a constant id, absent from the DOM while closed, duplicated if two tooltips open); SearchInput wraps the field in an unlabelled role="search" landmark; clear buttons use a hardcoded English aria-label "Reset"; ModalHeader renders an <h4> (level skip from the page h1); icons are <svg> without aria-hidden. Worth an upstream Moonstone issue.
- **aria-specialist**: Tooltips that repeat the button label (Cancel: tooltip 'Cancel'; Save: 'Save changes' vs 'Save Changes') add a redundant aria-describedby; tooltips on disabled buttons (Mark as Default, Save) are unreachable by keyboard because disabled buttons cannot take focus.
- **aria-specialist**: AppHeaderBar renders <header>; outside a sectioning element it maps to a banner landmark. Whether that duplicates the Jahia admin shell's banner, and whether a <main> wraps the route, must be checked in the runtime scan.
- **aria-specialist**: Editor.jsx (ConfigEditor tree) is only reached for files whose extension is not lowercase .cfg/.yml (index.jsx tests endsWith case-sensitively while the server lowercases), so its findings are low confidence for reachability, not for the defects.
- **aria-specialist**: Behavioural bug seen while reviewing: the keyboard reorder handler (CfgEditor.jsx:614) does not check `filtering`, unlike the drag path, so Arrow Up/Down reorders against hidden neighbours while a filter is active.
- **aria-specialist**: Monaco captures Tab inside the editor; the escape (Ctrl+M / tab focus mode) is only discoverable through Alt+F1. Keep that hint in any custom ariaLabel (2.1.2).
- **aria-specialist**: Selection-follows-focus in the file list: Arrow Up/Down opens each file (and the unsaved-changes dialog when dirty). With a listbox, consider moving focus with arrows and opening on Enter.
- **aria-specialist**: Not checked here (runtime half): computed accessible names in the browser, Moonstone Menu roles when the Dropdown is open, focus order across panes, contrast of state colours.
- **cognitive-accessibility**: 2.2.1 session: the session timeout is Jahia's, not the module's. The module has no expiry warning or extension, and a request after expiry fails with a 6 s error toast (COG-001), then signing in again loses edits (COG-016). Check the platform's session length and warning in the running instance.
- **cognitive-accessibility**: 3.2.6 Consistent Help: N/A. The app offers no help mechanism (contact, help link or chat), so nothing has to stay in the same place.
- **cognitive-accessibility**: 3.3.8 Accessible Authentication: N/A. The module has no sign-in step; authentication is Jahia's.
- **cognitive-accessibility**: 3.2.2 editor mode: choosing 'Raw Edit' / 'Visual Edit' in the dropdown replaces the editor straight away. The user chose it and the option is labelled, so it is not flagged, but tooltip.modeRaw and tooltip.modeVisual are unused and could tell users the mode is remembered.
- **cognitive-accessibility**: 3.2.2 create dialog: choosing a factory card moves focus into the identifier field (autoFocus, Dialogs.jsx:447). This is a user click and the field is the next step, so it is not flagged.
- **cognitive-accessibility**: Hand-off to forms and aria specialists: visible labels are Typography that is not linked to its input (Dialogs.jsx:334-344, 350-359, 442-452); the deep-search Switch has no accessible name (FileSidebar.jsx:117-121); CreateOptionCard is a clickable div with no keyboard access (Dialogs.jsx:90-115); table header cells are TableBodyCell inside thead (CfgEditor.jsx:178-205).
- **cognitive-accessibility**: Hand-off to the live-region controller: the toast Paper (useToast.tsx:77-97) has no role=status/alert, so screen readers may not announce the outcome of any action.
- **cognitive-accessibility**: Unused English keys that point to missing UI: app.unsaved, tooltip.modeRaw, tooltip.modeVisual, configState.badgeCompact.*, sidebar.on/off, modal.create.or. The sidebar shows a disabled file only by strikethrough and a grey bar (FileSidebar.jsx:158, 173); that is a 1.4.1/1.3.1 question for the visual specialist.
- **cognitive-accessibility**: AAA/COGA advisory, not flagged one by one: the audience is server administrators, so OSGi terms (PID, Metatype, factory, ENC(...)) are fine as domain vocabulary. 'materialized' (modal.create.message) and 'Redo reversed change' (tooltip.redo) could be plainer.
- **cognitive-accessibility**: Editor.jsx (tree editor) only renders for files that are neither .cfg nor .yml, which the UI cannot create; it was reviewed lightly (COG-007).
- **contrast-master**: Moonstone 2.21 tokens with suffix 20/40/60 (e.g. --color-gray_dark60 = #29313699) are alpha colours; ratios above are computed after compositing on the actual background. Every text use of an alpha token in this module fails 4.5:1.
- **contrast-master**: Third-party, for runtime confirmation and possible upstream report (not counted as findings): Moonstone focus ring outline 2px var(--moon-color-accent_light) #63d1ff is 1.74:1 on white (fails 1.4.11 / 2.4.7 contrast); ghost accent buttons use #00a0e3 text (2.94:1); default accent button colours, Typography color=textSecondary, Chip colours and TableRow isHighlighted were not measured from source.
- **contrast-master**: Whether Typography inherits EMPTY_STATE_STYLE / InlineLoader colour (subtleTextColor 3.82:1) depends on Moonstone's Typography class; confirm in the runtime contrast pass.
- **contrast-master**: Editor.jsx (generic ConfigEditor) is reached only when a listed file's extension is not exactly lower-case .cfg/.yml (backend matches case-insensitively, the UI uses case-sensitive endsWith); its other hard-coded colours (#007cb0 folder icon 4.46:1 on #fafafa, gradient #f0f4f7) are decorative or pass.
- **contrast-master**: Monaco marker squiggles distinguish error vs warning by colour; this is Monaco's built-in rendering and markers are also listed in the hover/problems text.
- **contrast-master**: For other specialists: the DiffModal close control (DiffModal.tsx:145) and CfgMetatypePropertyDialog close (line 112) are non-focusable divs with no accessible name; toasts have no live region; the compact sidebar ConfigStateBadge has no text alternative besides a hover tooltip.
- **contrast-master**: Windows forced-colors mode was reviewed from source only: background-only cues (diff colours, sidebar status bar, selected create card, selected cfg row) disappear there; verify in Edge with forced colors active.
- **forms-specialist**: Moonstone 2.21.0 was read from a sibling checkout (osgi-configurations-manager-lotA/node_modules), the version yarn.lock pins. This worktree has no node_modules.
- **forms-specialist**: Moonstone Input/SearchInput render a native <input> with no <label>; extra props (aria-label, aria-describedby, aria-invalid, autoComplete, id) are spread onto the input, so every fix above can be made in the module. Props do not reach the SearchInput wrapper div that carries role="search", so the two search landmarks (sidebar, property filter) stay unnamed unless the module wraps them in its own <search>/<form role="search" aria-label>.
- **forms-specialist**: Moonstone defects to report upstream, not fixable here: the SearchInput clear button has the English-only aria-label 'Reset'; Checkbox and Switch set aria-checked on a native checkbox, which ARIA in HTML forbids; Modal sets aria-labelledby to its own id, so its accessible name is the whole dialog text, and the ModalHeader message is not linked with aria-describedby.
- **forms-specialist**: The task mentions checkboxes and selects for Metatype types: the visual .cfg editor has none. Every value is a free-text textarea or a password Input (see FORM-TYPE-001). The only checkbox is the per-row encryption toggle.
- **forms-specialist**: Monaco's own accessibility (Alt+F1 help, F8 to step through markers with announcement, Ctrl+M to stop Tab being captured) was not checked at runtime. Confirm in the runtime scan with NVDA/VoiceOver that markers are announced and that Ctrl+M lets focus leave the editor (2.1.2).
- **forms-specialist**: Keyboard operation of the sidebar file list (a focusable div with arrow keys, rows with no role or option semantics) and the Create dialog's Tab/TabItem pattern are outside the forms scope; they are left to the keyboard and ARIA specialists.
- **forms-specialist**: Moonstone Input receives an 'inputRef' prop at CfgEditor.jsx:737 that is spread onto the DOM input as an unknown attribute. Not an accessibility defect, but React logs a warning about it.
- **keyboard-navigator**: Editor.jsx (ConfigEditor) is unreachable today: the backend lists only .cfg/.yml (OsgiConfigService.SUPPORTED_CONFIG_EXTENSIONS) and index.jsx routes those to CfgEditor/MonacoEditor. If it is ever re-enabled, it has mouse-only value editing (onDoubleClick, Editor.jsx:105), a clickable non-focusable collapse cell (Editor.jsx:170) and a sticky header (Editor.jsx:328) that can hide focused small buttons when Shift+Tabbing upward (2.4.11); consider deleting the file.
- **keyboard-navigator**: 2.4.1 Bypass Blocks / skip link: the module renders inside the Jahia administration shell (LayoutContent); a skip link to the editor is the shell's responsibility. Within the module the tab sequence before the editor is short (header actions, search, deep-search switch, file list, Save/Cancel, file toolbar).
- **keyboard-navigator**: Runtime checks for the orchestrator's keyboard scan: (1) whether the Moonstone Modal's FloatingFocusManager initial focus overrides autoFocus on the prompt/filename inputs (Dialogs.jsx:303, 339) and lands on the close button placed before the header (Dialogs.jsx:284); (2) focus ring visibility of Moonstone ghost Buttons, Switch, Dropdown and SearchInput in the admin theme; (3) whether the native reorder <button> keeps a visible default outline under Moonstone's global CSS; (4) Moonstone Dropdown (editor mode, SelectedFileToolbar.jsx:104) arrow-key and Escape behaviour.
- **keyboard-navigator**: Focus after file selection is preserved: arrow-key selection keeps focus on the list container and auto-scrolls the selected row into view (FileSidebar.jsx:65-75); clicking a row does not move focus, which is acceptable.
- **keyboard-navigator**: Screen-reader semantics of the file list (listbox/option, aria-activedescendant), the Moonstone Modal aria-labelledby pointing at its own id, the toast lacking role=status and the lack of a live announcement after keyboard reorder are left to the ARIA/live-region specialists.
- **link-checker**: Premise correction: the task said FileSidebar.jsx, Editor.jsx and CfgEditor.jsx contain anchors/hrefs. They do not. The clickable non-button elements found instead are reported above as LINK-CONTROL-ELEMENT.
- **link-checker**: The YAML editor's collapsible container row (Editor.jsx:161-171, onClick on a td) and the double-click-to-edit value (Editor.jsx:105) are also non-button controls. They are reported by tables-data-specialist (they are table cells), not repeated here.
- **link-checker**: Repeated identical button names without row context (Delete this property, Reorder this entry, Insert) are not link text under 2.4.4 and are reported by tables-data-specialist as cell-control context.
- **link-checker**: Runtime check left to the browser half: confirm Monaco's link hover ('Follow link') appears on a value containing http(s):// at the page URL.
- **live-region-controller**: Moonstone (third-party): Paper, Typography, Modal/ModalHeader, SearchInput, Checkbox and Button are used as-is. Runtime checks needed: whether Moonstone Modal sets aria-hidden/inert outside itself (affects LIVE-TOAST-006), whether ModalHeader's message is exposed via aria-describedby (the error modals for invalid extension, duplicate keys and invalid YAML rely on it), and whether a disabled Moonstone Button uses the disabled attribute (affects LIVE-FOCUS-001).
- **live-region-controller**: Monaco has its own accessibility support (Alt+F1 help, F8 next problem, aria status on marker navigation); verify with NVDA/VoiceOver whether markers are announced while typing before deciding the scope of LIVE-VALID-003.
- **live-region-controller**: Every new label proposed in the fixes (dismiss, saving, searchCount, noResults, unsavedChanges, reorder.moved, encryptedLine...) needs its key in every locale file under src/main/resources/javascript/locales, per CLAUDE.md (bundled translations).
- **live-region-controller**: Announcements for encrypt/decrypt and the decryption probe must never include the value itself (CLAUDE.md invariant on secrets and masking).
- **live-region-controller**: Out of this skill's scope, for the forms specialist: the visual editor's encryption Checkbox (CfgEditor.jsx:778) and ConfigEditor's encrypted toggle (Editor.jsx:126) have no accessible name besides a title on the cell; the sidebar compact ConfigStateBadge has an empty label (ConfigStateBadge.jsx:40).
- **live-region-controller**: The configuration-state banners (index.jsx:251-265) appear with a newly selected file; they are page content for the new view rather than status messages and do not need a live region.
- **live-region-controller**: The InlineLoader spinner ignores prefers-reduced-motion (2.3.3 AAA, outside the AA target).
- **modal-specialist**: Upload conflict dialog passes otherLabel/onOther ('Rename', useFileActions.ts:267-284) but ModalDialog never renders otherLabel, so the rename choice is missing for everyone. Functional defect, not WCAG; flagged for the team.
- **modal-specialist**: Moonstone version in package.json is ^2.21.0; this worktree has no node_modules, so Moonstone 2.21.0 was inspected and probed in jsdom from the sibling worktree osgi-configurations-manager-lotA/node_modules. The self-referencing aria-labelledby, h4 ModalHeader and row-reverse footer are vendor behaviours; the module can override the first via props.
- **modal-specialist**: Runtime checks still needed: what the screen reader actually announces as the Moonstone dialog name; whether Chrome's focusable scrollers make the diff region tabbable; focus after save/delete in the real app; Moonstone Dropdown (editor mode, SelectedFileToolbar.jsx:104) popup keyboard and Escape behaviour and its missing 'editor mode' purpose label; Moonstone Tooltip hover/dismiss behaviour (1.4.13).
- **modal-specialist**: Recommended direction for the two custom overlays: move DiffModal and CfgMetatypePropertyDialog to Moonstone Modal (already used and correct for trap/inert/return) or to a native <dialog> with showModal(), instead of hardening useDialogA11y further.
- **playwright-scanner**: Out of the module's scope, reported by axe on the Jahia admin shell (platform team): <html> without lang (3.1.1), invalid custom roles on primary nav items (dashboard-menu-item, ...) and accordion headers (accordion-item, aria-expanded/aria-controls invalid), selected tree item white on #00a0e3 (2.89:1), a hidden h1 'Something wrong happened' inside <main>, and the secondary navigation covering the whole viewport at 320 px.
- **playwright-scanner**: No toast was triggered during the runtime pass (Refresh shows none), so toast announcement relies on the code review finding.
- **playwright-scanner**: Nothing was saved or deleted on the instance: every dialog was cancelled and every edit discarded.
- **tables-data-specialist**: moonstone internals (TableRow defaults to tabIndex=0, TableBodyCell renders <td>, TableHeadCell renders <th>, Checkbox renders an unlabelled <input>) were read from @jahia/moonstone 2.20.3 in a sibling worktree; this worktree has no node_modules and package.json asks for ^2.21.0. Confirm in the browser that the behaviour did not change.
- **tables-data-specialist**: moonstone Table and TableRow add flex display classes (flexCol_nowrap, flexRow) to <table> and <tr>. Some browser/screen-reader pairs, notably WebKit with VoiceOver, have dropped table semantics when the display is overridden. Check the accessibility tree at the page URL (run_playwright_a11y_tree) for role table/row/columnheader after the <th> fix.
- **tables-data-specialist**: Decision for the team: for the YAML editor, a hidden parent path in a row header plus disclosure buttons (recommended) versus a full ARIA treegrid, which also requires arrow-key cell navigation and roving tabindex.
- **tables-data-specialist**: Overlap with other specialists: hover-only overflow previews (Editor.jsx:46, CfgEditor.jsx:313, AppChrome.jsx:163) and the hover-only metatype 'i' tooltip trigger (CfgEditor.jsx:696, a non-focusable div) fall under 1.4.13 / 2.1.1 and are left to the keyboard and ARIA specialists.

## Next steps

1. Fix the 75 blocking findings above, starting with any repeated component.
2. Re-run this audit and check the delta section for regressions.
3. Wire the scan into continuous integration so the next regression is caught before review.

Automated checks find a minority of accessibility barriers. A passing score is a floor, not a guarantee.

## Findings data

The merged findings, embedded so the next run can compute a delta without parsing this document.

```json a11y-findings
{
  "skills": [
    "alt-text-headings",
    "aria-specialist",
    "cognitive-accessibility",
    "contrast-master",
    "forms-specialist",
    "keyboard-navigator",
    "link-checker",
    "live-region-controller",
    "modal-specialist",
    "playwright-scanner",
    "tables-data-specialist"
  ],
  "scope": [
    "15 UI states: initial, .cfg visual editor, filter, add-property prompt, review diff, discard, raw editor, delete/disable confirmations, create dialog (3 tabs), .yml raw editor",
    "@jahia/moonstone 2.21.0 Modal/ModalHeader/ModalFooter/Tab/Paper/Typography (dist/index.js, read-only)",
    "@jahia/moonstone 2.21.0 rendered markup (dist/index.js, dist/TreeView-*.js, dist/Checkbox-*.js)",
    "Behaviour: Tab order, focus visibility, dialog focus in/return, Monaco Tab capture, Enter on list rows, widths 1280/1024/320, WCAG 1.4.12 text-spacing override",
    "http://localhost:8080/jahia/administration/osgi-configurations-manager (Jahia 8.2, Chromium headless, axe-core 4.x tags wcag2a/aa, wcag21a/aa, wcag22aa)",
    "http://localhost:8080/jahia/administration/osgi-configurations-manager (code review only)",
    "node_modules/@jahia/moonstone@2.21.0 (Input/BaseInput, SearchInput, Checkbox, Switch, Button, Modal, Tooltip, TableBodyCell)",
    "src/javascript/init.js",
    "src/javascript/osgiConfigManager/**/*.{jsx,tsx,js,ts} (excluding *.test.*) - 26 files, 7579 lines",
    "src/javascript/osgiConfigManager/App/api/osgiService.ts",
    "src/javascript/osgiConfigManager/App/components/*.{jsx,tsx}",
    "src/javascript/osgiConfigManager/App/components/ActionButton.jsx",
    "src/javascript/osgiConfigManager/App/components/AppChrome.jsx",
    "src/javascript/osgiConfigManager/App/components/AppHeaderBar.jsx",
    "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx",
    "src/javascript/osgiConfigManager/App/components/CfgMetatypePropertyDialog.jsx",
    "src/javascript/osgiConfigManager/App/components/ConfigStateBadge.jsx",
    "src/javascript/osgiConfigManager/App/components/Dialogs.jsx",
    "src/javascript/osgiConfigManager/App/components/DiffModal.tsx",
    "src/javascript/osgiConfigManager/App/components/Editor.jsx",
    "src/javascript/osgiConfigManager/App/components/FileSidebar.jsx",
    "src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx",
    "src/javascript/osgiConfigManager/App/components/SelectedFileHeader.jsx",
    "src/javascript/osgiConfigManager/App/components/SelectedFileToolbar.jsx",
    "src/javascript/osgiConfigManager/App/hooks/*.ts, App/utils/*, App/api/* (no markup; checked for document.title / lang only)",
    "src/javascript/osgiConfigManager/App/hooks/*.{ts,tsx}",
    "src/javascript/osgiConfigManager/App/hooks/osgiTypes.ts",
    "src/javascript/osgiConfigManager/App/hooks/useDialogA11y.ts",
    "src/javascript/osgiConfigManager/App/hooks/useFileActions.ts",
    "src/javascript/osgiConfigManager/App/hooks/useOsgiConfigs.ts",
    "src/javascript/osgiConfigManager/App/hooks/useProperties.ts",
    "src/javascript/osgiConfigManager/App/hooks/useToast.tsx",
    "src/javascript/osgiConfigManager/App/index.jsx",
    "src/javascript/osgiConfigManager/App/utils/*.{js,ts}",
    "src/javascript/osgiConfigManager/App/utils/configUtils.ts",
    "src/javascript/osgiConfigManager/App/utils/cryptoTree.ts",
    "src/javascript/osgiConfigManager/App/utils/metatypeUtils.js",
    "src/javascript/osgiConfigManager/App/utils/secretMask.js",
    "src/javascript/osgiConfigManager/registerRoutes.js",
    "src/main/resources/javascript/locales/{en,fr,de,es,it,pt}.json"
  ],
  "findings": [
    {
      "rule": "ARIA-KBD-016",
      "wcag": "2.1.1 A",
      "severity": "critical",
      "location": "src/javascript/osgiConfigManager/App/components/Dialogs.jsx:91",
      "summary": "In the create dialog, metatype and factory choices are clickable <div>s with no role, tabindex or key handler, and selection is shown by background only: keyboard and screen reader users cannot create from a template or factory.",
      "fix": "Make the list a single-select group: container role=\"radiogroup\" aria-labelledby the 'Template'/'Factory' heading; each card role=\"radio\" aria-checked={isSelected} tabIndex={isSelected||first ? 0 : -1} with Arrow-key roving and Space/Enter to select. Native <input type=\"radio\"> in a <label> is simpler and preferred.",
      "evidence": "const CreateOptionCard = (...) => (<div data-cy={dataCy} style={getSelectableCardStyle(isSelected)} onClick={onClick}>",
      "component": "CreateOptionCard",
      "foundBy": [
        "aria-specialist"
      ]
    },
    {
      "rule": "CONTRAST-TEXT-001",
      "wcag": "1.4.3 AA",
      "severity": "critical",
      "location": "src/javascript/osgiConfigManager/App/components/Dialogs.jsx:110",
      "summary": "Metatype/factory descriptions in the Create dialog use --color-gray_dark20 (#293136 at 20% alpha), about 1.46:1 on white.",
      "fix": "Use an opaque token that reaches 4.5:1, e.g. color: 'var(--color-gray_dark)' (#293136, 12.9:1) or drop the inline colour and use Typography color=\"textSecondary\" after runtime check. Never use the 20/40/60 alpha tokens for text.",
      "evidence": "style={{color: 'var(--color-gray_dark20)'}} -> composited #d4d6d7 on #fff = 1.46:1 (Moonstone 2.21: --moon-color-gray_dark20:#29313633)",
      "component": "CreateOptionCard",
      "foundBy": [
        "contrast-master",
        "playwright-scanner"
      ],
      "alsoReportedAs": [
        "RT-AXE-CONTRAST-MODULE"
      ]
    },
    {
      "rule": "FORM-CUSTOM-001",
      "wcag": "2.1.1 A",
      "severity": "critical",
      "location": "src/javascript/osgiConfigManager/App/components/Dialogs.jsx:90",
      "summary": "The Metatype and factory choices in the Create dialog are clickable <div>s (no role, tabindex or key handler; selection shown by color only), so keyboard users cannot create from Metatype or a factory.",
      "fix": "Make it a native single-choice group: <fieldset><legend>{t('modal.create.templateLabel')}</legend> and, per option, <label><input type=\"radio\" name=\"metatype\" value={pid} checked={isSelected} onChange={onClick}/> title, subtitle, description</label>. The arrow keys, focus and the checked state then come from the browser. Same for the factory list (line 418).",
      "evidence": "const CreateOptionCard = (...) => (<div data-cy={dataCy} style={getSelectableCardStyle(isSelected)} onClick={onClick}>",
      "component": "ModalDialog createConfig",
      "foundBy": [
        "forms-specialist"
      ]
    },
    {
      "rule": "FORM-LABEL-001",
      "wcag": "4.1.2 A",
      "severity": "critical",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:778",
      "summary": "The per-row encryption checkbox has no accessible name: a screen reader says only 'checkbox, not checked', with no hint that it encrypts the value or which property it belongs to.",
      "fix": "Moonstone Checkbox spreads extra props onto the native input, so pass a name: <Checkbox aria-label={t('editor.encryptValueOf', {key: key || t('editor.placeholder.key')})} .../>. The title='Security' on the surrounding TableBodyCell (line 777) is on the <td>, not the input, and does not count.",
      "evidence": "<TableBodyCell ... title={t('editor.header.security')}><Checkbox data-cy={`cfg-encrypted-${index}`} checked={isEncrypted || false} onChange=.../>",
      "component": "CfgEditor row",
      "foundBy": [
        "aria-specialist",
        "forms-specialist",
        "tables-data-specialist"
      ],
      "alsoReportedAs": [
        "ARIA-NAME-030",
        "TABLE-CELL-CONTROL-NAME"
      ]
    },
    {
      "rule": "LIVE-TOAST-001",
      "wcag": "4.1.3 AA",
      "severity": "critical",
      "location": "src/javascript/osgiConfigManager/App/hooks/useToast.tsx:76",
      "summary": "The toast, the only feedback for save, delete, create, upload, enable/disable and mark-as-default, has no live region and is mounted with its text, so screen reader users hear nothing.",
      "fix": "Render one wrapper unconditionally inside ToastProvider and change only its content: <div role=\"status\" aria-live=\"polite\" data-cy=\"toast-region\">{toast && <Paper ...>...</Paper>}</div>. Keep the wrapper visible (no display:none); position the Paper as today. Do not move focus to it.",
      "evidence": "{toast && (<Paper data-cy=\"toast-message\" style={{position:'fixed',...}}> ... <Typography>{toast.message}</Typography></Paper>)}",
      "component": "ToastProvider",
      "foundBy": [
        "live-region-controller"
      ]
    },
    {
      "rule": "MODAL-CREATE-OPTION-NOT-KEYBOARD",
      "wcag": "2.1.1 A",
      "severity": "critical",
      "location": "src/javascript/osgiConfigManager/App/components/Dialogs.jsx:90",
      "summary": "In the Create dialog, Metatype and factory options are clickable divs with no role, tabindex or key handler, so keyboard users cannot select one and the Create button stays disabled on the Configuration and Factory tabs.",
      "fix": "Render each CreateOptionCard as a <button type=\"button\" aria-pressed={isSelected}> (or an ARIA listbox with role=option/aria-selected and arrow-key handling) wrapping the title/subtitle text; keep the click handler and selection style. Selection state must be exposed programmatically, not only by background colour.",
      "evidence": "<div data-cy={dataCy} style={getSelectableCardStyle(isSelected)} onClick={onClick}> (used at lines 379 and 419)",
      "component": "ModalDialog / CreateOptionCard",
      "foundBy": [
        "modal-specialist"
      ]
    },
    {
      "rule": "RT-REFLOW-CLIP",
      "wcag": "1.4.10 AA",
      "severity": "critical",
      "location": "src/javascript/osgiConfigManager/App/components/AppChrome.jsx:19",
      "summary": "With the Jahia admin navigation open the module needs ~1420 CSS px: at 1280 px Save and the mode selector are cut off; at 1024 px (125% zoom) Save, Cancel, Delete and the Value column are unreachable.",
      "fix": "Let the two panes shrink and wrap: replace the fixed 350px sidebar with flex: '0 1 350px' + minWidth: 0, allow the file header/toolbar rows to wrap (flexWrap: 'wrap'), and stack sidebar over editor below ~900px of available width; give the editor pane overflow: auto rather than hidden so nothing becomes unreachable.",
      "evidence": "1280x800: save-config-button right=1280 (clipped), editor-mode-dropdown clipped; 1024x800: cancel right=1124, delete right=1080, save right=1280, document scrollWidth=1419; screenshot 40-width-1024.png",
      "component": "App layout",
      "foundBy": [
        "playwright-scanner"
      ]
    },
    {
      "rule": "SEM-DIV-BUTTON-001",
      "wcag": "2.1.1 A",
      "severity": "critical",
      "location": "src/javascript/osgiConfigManager/App/components/Dialogs.jsx:91",
      "summary": "The selectable configuration and factory options in the Create dialog are clickable divs: not focusable, no role, no selected state, so keyboard and screen reader users cannot create from a template or factory.",
      "fix": "Render each option as a native control: a radio group (<fieldset><legend>{templateLabel}</legend> then per option <label><input type=\"radio\" name=\"pid\" checked={isSelected}/> title/subtitle/meta</label>) inside a <ul>, or <button type=\"button\" aria-pressed={isSelected}> in <li>. Keep the card look with CSS. Applies to both uses at Dialogs.jsx:379 and :419.",
      "evidence": "<div data-cy={dataCy} style={getSelectableCardStyle(isSelected)} onClick={onClick}> (selection shown only by background colour)",
      "component": "CreateOptionCard",
      "foundBy": [
        "alt-text-headings",
        "keyboard-navigator",
        "link-checker"
      ],
      "alsoReportedAs": [
        "KBD-CLICK-NONFOCUSABLE",
        "LINK-CONTROL-ELEMENT"
      ]
    },
    {
      "rule": "ARIA-KBD-002",
      "wcag": "2.1.1 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:137",
      "summary": "Moonstone TableRow adds tabIndex=0 to every file row, but rows only handle onClick: Tab lands on each file and Enter/Space do nothing. The list costs one tab stop per file plus one for the container.",
      "fix": "When adopting the listbox pattern, pass tabIndex={-1} to every TableRow (props spread after Moonstone's tabIndex: 0) and let the container own focus. Activate on Enter/Space too: onKeyDown={e => (e.key==='Enter'||e.key===' ') && (e.preventDefault(), handleFileClick(f))}.",
      "evidence": "Moonstone TableRow: createElement('tr', {..., tabIndex: 0, ...props}); module passes only onClick",
      "component": "FileSidebar",
      "foundBy": [
        "aria-specialist"
      ]
    },
    {
      "rule": "ARIA-KBD-033",
      "wcag": "2.1.1 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:696",
      "summary": "The Metatype info marker is a div showing the letter 'i' whose documentation lives in a hover-only Tooltip; it is not focusable, so keyboard users cannot read the property documentation and screen readers just read 'i'.",
      "fix": "Use a button: <button type=\"button\" aria-label={t('editor.metatype.aboutProperty', {key})} aria-describedby={`cfg-doc-${index}`}>i</button> and render the documentation in an element with that id (visually hidden or a toggletip opened on click/Enter, dismissible with Escape).",
      "evidence": "<Tooltip label={<CfgMetatypeInfoTooltip .../>}><div data-cy={`cfg-metatype-info-${index}`} style={{... cursor: 'help'}}>i</div></Tooltip>",
      "component": "CfgEditor",
      "foundBy": [
        "alt-text-headings",
        "aria-specialist",
        "keyboard-navigator"
      ],
      "alsoReportedAs": [
        "IMG-ICON-002",
        "KBD-TOOLTIP-NONFOCUSABLE"
      ]
    },
    {
      "rule": "ARIA-KBD-043",
      "wcag": "2.1.1 A",
      "severity": "serious",
      "confidence": "low",
      "location": "src/javascript/osgiConfigManager/App/components/Editor.jsx:102",
      "summary": "Leaf values in the tree editor become editable only on double-click of a plain div, which has no role, tabindex or key handler; keyboard users cannot edit values there.",
      "fix": "Render a <button type=\"button\" aria-label={t('editor.aria.editValue', {key: rowLabel})} onClick={…setEditingValueKey(keyString)}> or an always-present labelled input; name the edit Input/textarea (lines 87-99) and the encrypt Checkbox (line 125).",
      "evidence": "<div onMouseEnter=... onDoubleClick={() => { onHideOverlay(); setEditingValueKey(keyString); }} style={{cursor: 'text', ...}}>",
      "component": "ConfigEditor",
      "foundBy": [
        "aria-specialist"
      ]
    },
    {
      "rule": "ARIA-LIVE-012",
      "wcag": "4.1.3 AA",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/hooks/useToast.tsx:77",
      "summary": "Toasts (save succeeded, errors, warnings) are mounted on demand in a plain Moonstone Paper <section> with no live region, so screen readers never announce the outcome of save, delete, upload or encryption actions.",
      "fix": "Keep a live region always mounted and change only its text: <div role=\"status\" aria-live=\"polite\" aria-atomic=\"true\" className=\"sr-only\">{toast?.type !== 'error' ? toast?.message : ''}</div> plus a role=\"alert\" region for errors; keep the visual Paper aria-hidden=\"true\" or put the role on it while it stays mounted.",
      "evidence": "{toast && (<Paper data-cy=\"toast-message\" style={{position: 'fixed', ...}}>{toastMeta?.icon}<Typography>{toast.message}</Typography></Paper>)}",
      "component": "ToastProvider",
      "foundBy": [
        "aria-specialist"
      ]
    },
    {
      "rule": "ARIA-LIVE-013",
      "wcag": "4.1.3 AA",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/AppChrome.jsx:131",
      "summary": "StatusBanner shows load errors and the Module / Module-default warnings when a file opens, but has no role, so screen readers are not told that the file failed to load or is managed by a module.",
      "fix": "Map tone to a role: <div role={tone === 'error' ? 'alert' : 'status'} ...>. Because banners mount with the file, render the role container once in index.jsx and swap its text, or accept that role=alert on mount is announced. Mark the tone icon aria-hidden=\"true\".",
      "evidence": "export const StatusBanner = ({tone = 'info', message, dataCy}) => ... <div data-cy={dataCy} style={...}>{icon}<Typography>{message}</Typography></div>",
      "component": "StatusBanner",
      "foundBy": [
        "aria-specialist"
      ]
    },
    {
      "rule": "ARIA-NAME-005",
      "wcag": "1.1.1 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:176",
      "summary": "The compact ConfigStateBadge renders an icon-only Chip with label '' (Module / Module default / User) whose meaning exists only in a hover tooltip on a non-focusable div, so keyboard and screen reader users never get the state.",
      "fix": "In ConfigStateBadge compact mode, keep the text for AT (aria-label alone is not reliable on a role-less div): render <span className=\"sr-only\">{t(config.labelKey)}</span> beside the icon (or role=\"img\" aria-label={t(config.labelKey)} on the Chip).",
      "evidence": "const label = compact ? '' : t(config.labelKey); <Chip icon={<config.icon/>} label={label} />",
      "component": "ConfigStateBadge",
      "foundBy": [
        "aria-specialist"
      ]
    },
    {
      "rule": "ARIA-NAME-006",
      "wcag": "4.1.2 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:117",
      "summary": "The 'Search in content' Switch renders <input type=checkbox> with no accessible name: the visible Typography beside it is not associated, and the Tooltip describes the wrapping div, not the input.",
      "fix": "Associate the visible text: <Switch id=\"deep-search-switch\" ... /> and <Typography component=\"label\" htmlFor=\"deep-search-switch\">{t('app.searchDeep')}</Typography> (Switch spreads rest props onto the input). Alternatively aria-label={t('app.searchDeep')} plus aria-describedby to the tooltip text.",
      "evidence": "<Switch data-cy=\"deep-search-toggle-control\" checked={searchInContent} onChange=.../> ... <Typography variant=\"body\">{t('app.searchDeep')}</Typography>",
      "component": "FileSidebar",
      "foundBy": [
        "aria-specialist",
        "forms-specialist"
      ],
      "alsoReportedAs": [
        "FORM-LABEL-005"
      ]
    },
    {
      "rule": "ARIA-NAME-007",
      "wcag": "4.1.2 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:101",
      "summary": "Moonstone SearchInput inputs (file filter and .cfg property filter) are named only by their placeholder and sit in an unlabelled role=\"search\" landmark Moonstone adds, so the field's name disappears once text is typed.",
      "fix": "Pass a name to the input (SearchInput forwards rest props to <input>): aria-label={t('app.searchLabel')} in FileSidebar.jsx:101 and aria-label={t('editor.filter.label')} in CfgEditor.jsx:528. Add the keys to every locale file.",
      "evidence": "<SearchInput value={searchTerm} placeholder={t('app.searchPlaceholder')} .../> ; CfgEditor.jsx:528 <SearchInput placeholder={t('editor.filter.placeholder')} .../>",
      "component": "SearchInput",
      "foundBy": [
        "aria-specialist"
      ]
    },
    {
      "rule": "ARIA-NAME-017",
      "wcag": "4.1.2 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/Dialogs.jsx:337",
      "summary": "Dialog inputs (manual file name, filter, factory identifier, prompt) are named only by placeholders; their bold Typography 'labels' render <p> and are not associated, so the name disappears once text is entered.",
      "fix": "Associate the visible text: give each Typography component=\"label\" htmlFor and the Input a matching id (Moonstone Input forwards id), e.g. <Typography component=\"label\" htmlFor=\"create-manual\">…</Typography><Input id=\"create-manual\" …/>. For the prompt (line 301) use aria-labelledby the ModalHeader message.",
      "evidence": "<Typography variant=\"subheading\" weight=\"bold\">{t('modal.create.manualLabel')}</Typography><Input data-cy=\"modal-create-manual-input\" placeholder=... /> (also :301, :353, :446)",
      "component": "ModalDialog",
      "foundBy": [
        "aria-specialist",
        "forms-specialist"
      ],
      "alsoReportedAs": [
        "FORM-LABEL-006"
      ]
    },
    {
      "rule": "ARIA-NAME-026",
      "wcag": "4.1.2 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/CfgMetatypePropertyDialog.jsx:118",
      "summary": "The property search field is named only by its placeholder, the result count is never announced, and the 'already exists' message is not linked to the field.",
      "fix": "<Input aria-label={t('editor.metatype.cfgPicker.searchLabel')} aria-describedby=\"cfg-picker-feedback\" aria-invalid={customAlreadyExists} …/>, give the feedback block id=\"cfg-picker-feedback\" role=\"status\", and add a polite count (\"{n} properties\") there.",
      "evidence": "<Input data-cy=\"cfg-metatype-property-search\" autoFocus value={query} placeholder={t('editor.metatype.cfgPicker.searchPlaceholder')} variant=\"outlined\" />",
      "component": "CfgMetatypePropertyDialog",
      "foundBy": [
        "aria-specialist",
        "forms-specialist"
      ],
      "alsoReportedAs": [
        "FORM-SEARCH-003"
      ]
    },
    {
      "rule": "ARIA-NAME-029",
      "wcag": "4.1.2 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:684",
      "summary": "Every key, value and comment field in the visual editor is an unlabelled <textarea>/<input> (placeholder 'Key'/'Value' at best), so a screen reader hears 'edit text' with no clue which property a value belongs to.",
      "fix": "Name each field from its row: key aria-label={t('editor.aria.key', {line: index + 1})}; value aria-label={t('editor.aria.value', {key: key || index + 1})} on AutoResizeTextArea (line 750) and the masked Input (line 735); comment aria-label={t('editor.aria.comment', {line: index + 1})} (line 652).",
      "evidence": "<AutoResizeTextArea data-cy={`cfg-key-${index}`} value={key} placeholder={t('editor.placeholder.key')} .../> (also :652, :735, :750)",
      "component": "CfgEditor",
      "foundBy": [
        "aria-specialist",
        "forms-specialist",
        "tables-data-specialist"
      ],
      "alsoReportedAs": [
        "FORM-LABEL-003",
        "TABLE-CELL-CONTROL-CONTEXT"
      ]
    },
    {
      "rule": "ARIA-NAME-039",
      "wcag": "4.1.2 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:1470",
      "summary": "The Metatype property search field in the raw editor's side panel has no accessible name beyond its placeholder.",
      "fix": "aria-label={t('editor.metatype.searchLabel')} on the Input (forwarded to <input>), or a visible <label htmlFor>.",
      "evidence": "<Input data-cy=\"raw-editor-property-search\" value={propertySearch} placeholder={t('editor.metatype.searchPlaceholder')} />",
      "component": "MonacoEditor",
      "foundBy": [
        "aria-specialist"
      ]
    },
    {
      "rule": "ARIA-ROLE-008",
      "wcag": "4.1.2 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/SelectedFileToolbar.jsx:104",
      "summary": "The Visual/Raw mode selector is a Moonstone Dropdown whose trigger is a div role=\"listbox\" named by the current value ('Visual Edit'), with no aria-expanded or popup semantics: users hear a listbox, not an editor-mode control.",
      "fix": "Use a two-state control: <div role=\"group\" aria-label={t('editor.mode.label')}> with two Moonstone Buttons, each aria-pressed={isRawMode === (value==='raw')}, disabled={isLoadingFile}. Or a RadioGroup. If Dropdown stays, at least wrap it in role=\"group\" aria-label={t('editor.mode.label')}.",
      "evidence": "<Dropdown data-cy=\"editor-mode-dropdown\" value={isRawMode ? 'raw' : 'visual'} data={modeOptions} .../> -> <div role=\"listbox\" aria-label=\"Visual Edit\" tabIndex=0>",
      "component": "SelectedFileToolbar",
      "foundBy": [
        "aria-specialist"
      ]
    },
    {
      "rule": "ARIA-SEL-001",
      "wcag": "4.1.2 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:129",
      "summary": "The file list is a headerless <table> used as a single-select list: the selected file is only highlighted and bolded, so screen readers never hear which file is open.",
      "fix": "Render a listbox: wrapper role=\"listbox\" aria-label={t('app.fileList')} tabIndex={0} aria-activedescendant={'file-row-'+encodeURIComponent(selectedFile?.name)}, each row role=\"option\" aria-selected={selectedFile?.name===f.name} tabIndex={-1}. Or use a <ul> of native <button aria-current={isSelected ? 'true' : undefined}>.",
      "evidence": "<div tabIndex={0} onKeyDown={handleKeyDown}><Table>... <TableRow isHighlighted={selectedFile?.name === f.name} onClick=...>",
      "component": "FileSidebar",
      "foundBy": [
        "aria-specialist"
      ]
    },
    {
      "rule": "ARIA-SEM-022",
      "wcag": "1.3.1 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/DiffModal.tsx:167",
      "summary": "In the review-before-save diff, added and removed lines are distinguished only by green/red colour on plain <span>s, so screen reader users (and users who cannot see colour) cannot tell what will change.",
      "fix": "Render semantic changes with a text cue: part.added ? <ins> : part.removed ? <del> : <span>, and prefix each with <span className=\"sr-only\">{t('modal.diff.added')}</span> / removed (or a visible +/− gutter). Note many screen readers ignore <ins>/<del> by default, so keep the text prefix.",
      "evidence": "<span key={index} style={{backgroundColor: part.added ? '#e6ffec' : part.removed ? '#ffebe9' : 'transparent', color: ...}}>",
      "component": "DiffModal",
      "foundBy": [
        "aria-specialist",
        "modal-specialist"
      ],
      "alsoReportedAs": [
        "MODAL-DIFF-COLOR-ONLY"
      ]
    },
    {
      "rule": "ARIA-TREE-042",
      "wcag": "4.1.2 A",
      "severity": "serious",
      "confidence": "low",
      "location": "src/javascript/osgiConfigManager/App/components/Editor.jsx:161",
      "summary": "The tree editor's group rows expand and collapse through onClick on a <td>, with no button, no aria-expanded and no keyboard handler, so nested groups cannot be opened from the keyboard.",
      "fix": "Put a native toggle in the cell: <button type=\"button\" aria-expanded={!isCollapsed} onClick={toggleCollapse}>{chevron aria-hidden}{displayLabel}</button>, or adopt role=\"treegrid\" with aria-level/aria-expanded on rows.",
      "evidence": "<TableBodyCell colSpan={4} style={{cursor: 'pointer'}} onClick={toggleCollapse}>{isCollapsed ? <ChevronRight/> : <ChevronDown/>}",
      "component": "ConfigEditor",
      "foundBy": [
        "aria-specialist"
      ]
    },
    {
      "rule": "COG-001",
      "wcag": "2.2.1 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/hooks/useToast.tsx:23",
      "summary": "Every toast, errors included, disappears after 6 s with no close button, no pause on hover or focus and no way to extend, so failure messages for save, delete, toggle and decrypt can vanish before they are read.",
      "fix": "Keep error and warning toasts until dismissed (add a labelled Close button), pause the timer on hover and focus, and keep the 6 s auto-dismiss only for success. Alternatively, show failures in the persistent StatusBanner above the editor (AppChrome.jsx:126).",
      "evidence": "notify(message, type, duration = 6000) ... window.setTimeout(() => setToast(null), duration); the longest message (notification.decryptRefused, notification.undecryptableValues) is over 100 characters.",
      "component": "ToastProvider",
      "foundBy": [
        "cognitive-accessibility"
      ]
    },
    {
      "rule": "COG-002",
      "wcag": "3.3.4 AA",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/hooks/useFileActions.ts:256",
      "summary": "The overwrite confirmation on Import checks only the files currently listed; with 'Search in content' on, that list holds only matches, so importing over an existing configuration overwrites it on the server without any confirmation.",
      "fix": "Check for an existing file against the server (a file(name:) query, or the unfiltered list) rather than the filtered 'files' state, before calling processUpload. Apply the same check to the conflicting .disabled twin that is deleted at line 237-242.",
      "confidence": "medium",
      "evidence": "const existing = files.find(f => f.name === baseName || ...); files comes from fetchFiles(searchTerm, true) (useOsgiConfigs.ts:224-228), which queries files(search:) (osgiService.ts:155-159).",
      "component": "useFileActions",
      "foundBy": [
        "cognitive-accessibility"
      ]
    },
    {
      "rule": "COG-005",
      "wcag": "3.3.2 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/Dialogs.jsx:332",
      "summary": "The 'Manual filename' field states the allowed extensions nowhere before submission (only an example in the placeholder); the rule '.cfg, .yml, .cfg.disabled or .yml.disabled' appears only in an error dialog after Create.",
      "fix": "Add persistent helper text under the field, e.g. 'End the name with .cfg or .yml. Add .disabled to create it disabled.', associate it with aria-describedby, and validate inline so Create stays disabled until the extension is valid.",
      "evidence": "placeholder={t('modal.create.manualPlaceholder')} ('e.g. org.test.config.cfg'); the rule is in modal.error.invalidExtension, shown by useFileActions.ts:119-131 after the dialog closed.",
      "component": "ModalDialog createConfig",
      "foundBy": [
        "cognitive-accessibility"
      ]
    },
    {
      "rule": "COG-006",
      "wcag": "3.3.7 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/Dialogs.jsx:255",
      "summary": "The create dialog closes before the file name is validated or created, and its state is reset, so after an invalid extension or a server error the administrator must click New again and retype the name.",
      "fix": "Validate the extension inside the dialog before closing, and keep the dialog open with the typed value on a server error (await onConfirm, close only on success, show the error inline). Do not clear manualFilename when a Metatype card is chosen (lines 389 and 429).",
      "evidence": "handleConfirm: onClose(); ... config.onConfirm(confirmPayload). useEffect([config]) resets manualFilename, filterValue, selections (lines 127-135); setManualFilename('') on card click (389, 429).",
      "component": "ModalDialog createConfig",
      "foundBy": [
        "cognitive-accessibility"
      ]
    },
    {
      "rule": "COLOR-ONLY-001",
      "wcag": "1.4.1 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/DiffModal.tsx:169",
      "summary": "Added and removed lines in the review-before-save diff are distinguished only by green/red text and background colour, with no +/- marker or text.",
      "fix": "Prefix each line of an added part with '+ ' and a removed part with '- ' (or render a gutter column with +/-), and wrap parts in <ins>/<del> or add visually-hidden 'Added'/'Removed' text. Keep the colours as a secondary cue; add a left border so the cue survives forced-colors mode.",
      "evidence": "added #1e7e34 on #e6ffec (4.86:1), removed #cb2431 on #ffebe9 (4.77:1); added vs removed text luminance 1.07:1, backgrounds 1.09:1 - indistinguishable for red/green colour-blind users and lost entirely in forced-colors mode",
      "component": "DiffModal",
      "foundBy": [
        "contrast-master"
      ]
    },
    {
      "rule": "CONTRAST-TEXT-002",
      "wcag": "1.4.3 AA",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/DiffModal.tsx:202",
      "summary": "The diff modal Save button overrides its background to #00a0e3 with white text, 2.94:1.",
      "fix": "Remove the inline style and let Moonstone's accent button render, or use backgroundColor 'var(--color-accent_dark)' (#0072b1, white text 5.20:1).",
      "evidence": "style={{ backgroundColor: '#00a0e3', color: '#fff', fontWeight: '600' }} -> #fff on #00a0e3 = 2.94:1 at ~14px",
      "component": "DiffModal",
      "foundBy": [
        "contrast-master",
        "modal-specialist"
      ],
      "alsoReportedAs": [
        "MODAL-SAVE-BUTTON-CONTRAST"
      ]
    },
    {
      "rule": "CONTRAST-TEXT-003",
      "wcag": "1.4.3 AA",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:89",
      "summary": "Comment rows of the visual .cfg editor ('#' marker and comment text) are drawn in --color-success #6abb6d, 2.35:1 on white and 2.06:1 on the selected row.",
      "fix": "Use a dark green that reaches 4.5:1 on both #fff and #def4fd, e.g. #2e7d32 (5.1:1 on white) or Moonstone's success_dark token if defined; keep italic + '#' + icon as non-colour cues.",
      "evidence": "const cfgCommentColor = 'var(--color-success)'; used at CfgEditor.jsx:630, 645, 659",
      "component": "CfgEditor",
      "foundBy": [
        "contrast-master"
      ]
    },
    {
      "rule": "CONTRAST-TEXT-004",
      "wcag": "1.4.3 AA",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:141",
      "summary": "The 'Add comment' button label and border are overridden to --color-success #6abb6d, 2.35:1 on white.",
      "fix": "Drop the inline colour override (use Moonstone's default outlined button) or use a green reaching 4.5:1 for the label and 3:1 for the border, e.g. #2e7d32.",
      "evidence": "style={{color: 'var(--color-success)', borderColor: 'var(--color-success)'}}",
      "component": "CfgEditorFooter",
      "foundBy": [
        "contrast-master"
      ]
    },
    {
      "rule": "DATA-STATE-VISUAL-ONLY",
      "wcag": "1.3.1 A",
      "severity": "serious",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:158",
      "summary": "Each file's enabled/disabled status is shown only by a 3px green/grey bar and a line-through (line 173), and its origin (module, module default, user) only by an unlabelled icon chip (line 176) whose tooltip needs hover.",
      "fix": "Add text for each state to every file item: visually hidden ', disabled' when !f.enabled, and the state label (t(config.labelKey)) as visually hidden text next to the compact chip, or aria-describedby. Keep the bar and the chip as decoration (aria-hidden).",
      "evidence": "<div data-cy={`sidebar-file-status-...`} style={getFileStatusIndicatorStyle(f.enabled)} /> ... textDecoration: f.enabled ? 'none' : 'line-through' ... <ConfigStateBadge state={f.configState} compact />",
      "component": "FileSidebar, ConfigStateBadge",
      "foundBy": [
        "tables-data-specialist"
      ]
    },
    {
      "rule": "FOCUS-VISIBLE-001",
      "wcag": "2.4.7 AA",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:259",
      "summary": "Key, value and comment textareas of the visual .cfg editor set outline: 'none'; the only focus cue is the row background #def4fd (1.14:1 vs white), unchanged when moving between fields of the same row.",
      "fix": "Remove outline: 'none' and add a :focus-visible rule for the textareas (e.g. a class with outline: 2px solid var(--color-accent_dark); outline-offset: 1px; #0072b1 is 5.20:1 on white, 4.57:1 on #def4fd). Do not rely on the row selection background as focus indicator.",
      "evidence": "AutoResizeTextArea style { border: 'none', outline: 'none', ... }; row backgroundColor: isSelected ? '#def4fd' : 'transparent' (CfgEditor.jsx:575) = 1.14:1",
      "component": "AutoResizeTextArea",
      "foundBy": [
        "contrast-master",
        "keyboard-navigator"
      ],
      "alsoReportedAs": [
        "KBD-FOCUS-INDICATOR-REMOVED"
      ]
    },
    {
      "rule": "FOCUS-VISIBLE-002",
      "wcag": "2.4.7 AA",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:130",
      "summary": "The focusable file list container (tabIndex=0, Arrow-key navigation) suppresses its focus outline, so keyboard users cannot see that the list has focus.",
      "fix": "Remove outline: 'none' and give the container a visible :focus-visible style (e.g. outline: 2px solid var(--color-accent_dark); outline-offset: -2px), at least 3:1 against white and the highlighted row.",
      "evidence": "style={{ flex: 1, overflowY: 'auto', outline: 'none' }} tabIndex={0}",
      "component": "FileSidebar",
      "foundBy": [
        "contrast-master",
        "keyboard-navigator",
        "playwright-scanner"
      ],
      "alsoReportedAs": [
        "KBD-FOCUS-INDICATOR-REMOVED",
        "RT-FOCUS-LIST-INVISIBLE"
      ]
    },
    {
      "rule": "FORM-ERR-004",
      "wcag": "3.3.1 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/SelectedFileHeader.jsx:25",
      "summary": "With a validation error in the raw or YAML editor, Save is silently disabled. The error shows only as Monaco squiggles, with no summary or announcement, so screen-reader users cannot tell why they cannot save.",
      "fix": "Under the editor toolbar, render an error summary in an always-present role=\"status\" region: 'N errors: line 12, missing key', with a button that puts the cursor on the first marker (editor.setPosition + focus). Use aria-disabled (still focusable) for Save, with aria-describedby pointing to the summary.",
      "evidence": "const isSaveDisabled = !hasUnsaved || ((isRawMode || isYamlFile) && !isYamlValid);",
      "component": "SelectedFileHeader / MonacoEditor",
      "foundBy": [
        "forms-specialist"
      ]
    },
    {
      "rule": "FORM-HELP-001",
      "wcag": "1.3.1 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:694",
      "summary": "A property's Metatype help (type, optional, default, allowed values, description) appears only in a tooltip on a non-focusable <div>: keyboard users cannot open it, and it is not linked to the value field.",
      "fix": "Render the Metatype help as visible or expandable text with an id, for example id={`cfg-help-${index}`}, and reference it from the value field with aria-describedby. If a tooltip is kept, make the trigger a <button type=\"button\" aria-label={t('editor.metatype.info', {key})}> so it can receive focus.",
      "evidence": "<Tooltip label={<CfgMetatypeInfoTooltip .../>}><div data-cy={`cfg-metatype-info-${index}`} style={{cursor:'help',...}}>i</div></Tooltip>",
      "component": "CfgEditor row",
      "foundBy": [
        "forms-specialist"
      ]
    },
    {
      "rule": "FORM-LABEL-002",
      "wcag": "4.1.2 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:652",
      "summary": "The comment-row textarea has no label, no placeholder and no aria-label, so it has no accessible name: screen readers announce 'edit text, multi-line' with nothing else.",
      "fix": "Add aria-label={t('editor.commentLabel')} (for example 'Comment') to the AutoResizeTextArea at line 652. AutoResizeTextArea already spreads ...props onto the <textarea>, so no component change is needed. Add the new key to every locale file.",
      "evidence": "<AutoResizeTextArea inputRef=... value={commentValue} onChange=... onFocus=... style=.../>",
      "component": "CfgEditor row",
      "foundBy": [
        "forms-specialist"
      ]
    },
    {
      "rule": "FORM-LABEL-007",
      "wcag": "3.3.2 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/Dialogs.jsx:301",
      "summary": "The prompt input (Add Property without Metatype, Rename uploaded file, create fallback) is labelled only by the placeholder 'Type here...'; the question in ModalHeader is not linked to it.",
      "fix": "Name the input after the question: <Input aria-label={config.message || config.title} .../>. Better, render the question as a <label htmlFor> for an id on the input. Remove the generic 'Type here...' placeholder, or make it a real example.",
      "evidence": "<Input data-cy=\"modal-prompt-input\" autoFocus value={promptValue} ... placeholder={t('modal.prompt.placeholder')}/>",
      "component": "ModalDialog prompt",
      "foundBy": [
        "forms-specialist"
      ]
    },
    {
      "rule": "FORM-LEGACY-001",
      "wcag": "2.1.1 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/Editor.jsx:101",
      "summary": "The tree editor (ConfigEditor) edits only on double-click of a <div>; its Input, textarea and encryption Checkbox (125) have no name. It renders for files that are neither .cfg nor .yml, which may be unreachable.",
      "fix": "If the branch is reachable: make each value a focusable button or an always-editable field, labelled with aria-labelledby={rowLabelId}, and give the Checkbox aria-label={t('editor.encryptValueOf', {key: rowLabel})}. If it is not reachable, remove ConfigEditor so it cannot come back unlabelled.",
      "confidence": "low",
      "evidence": "<div ... onDoubleClick={() => { onHideOverlay(); setEditingValueKey(keyString); }} style={{cursor: 'text', ...}}>",
      "component": "ConfigEditor",
      "foundBy": [
        "forms-specialist"
      ]
    },
    {
      "rule": "IMG-ICON-001",
      "wcag": "1.1.1 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/ConfigStateBadge.jsx:40",
      "summary": "In compact mode (every sidebar row, FileSidebar.jsx:176) the state badge is an icon-only Chip (Build / Module / Edit) with an empty label, so MODULE / MODULE_DEFAULT / USER has no text alternative.",
      "fix": "When compact, keep the label for AT: render <span className=\"sr-only\">{t(config.labelKey)}</span> next to the icon (or give the icon role=\"img\" aria-label={t(config.labelKey)}). The Tooltip wraps a non-focusable div and opens only on hover, so it is not a substitute.",
      "evidence": "const label = compact ? '' : t(config.labelKey); <Chip icon={<config.icon/>} label={label} />",
      "component": "ConfigStateBadge",
      "foundBy": [
        "alt-text-headings"
      ]
    },
    {
      "rule": "IMG-STATE-001",
      "wcag": "1.1.1 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:158",
      "summary": "Whether a file is enabled or disabled is shown only by a 3px coloured bar and a line-through on the name, neither of which reaches assistive technology.",
      "fix": "Add a text alternative inside the file's button, e.g. <span className=\"sr-only\">{t('…disabled')}</span> when !f.enabled (or include it in the accessible name), and mark the bar aria-hidden=\"true\".",
      "evidence": "<div data-cy=\"sidebar-file-status-…\" style={getFileStatusIndicatorStyle(f.enabled)} /> and textDecoration: f.enabled ? 'none' : 'line-through'",
      "component": "FileSidebar",
      "foundBy": [
        "alt-text-headings",
        "aria-specialist"
      ],
      "alsoReportedAs": [
        "ARIA-STATE-004"
      ]
    },
    {
      "rule": "KBD-DRAG-ONLY-POINTER",
      "wcag": "2.5.7 AA",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:608",
      "summary": "Reordering .cfg entries with a pointer requires a drag; clicking the handle button does nothing (onClick only stops propagation), and the Arrow-key alternative does not serve pointer-only users, so there is no single-pointer way to reorder.",
      "fix": "Add single-click controls, e.g. 'Move up' / 'Move down' icon buttons in the actions cell or a small menu on the handle button (onClick opens Move up / Move down / Move to top), calling the same handleReorder.",
      "evidence": "draggable={dragArmedIndex === index} (588); handle button onClick={(e) => e.stopPropagation()} (613)",
      "component": "CfgEditor",
      "foundBy": [
        "keyboard-navigator"
      ]
    },
    {
      "rule": "KBD-FOCUS-LOST-REMOVED",
      "wcag": "2.4.3 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/hooks/useFileActions.ts:82",
      "summary": "After a file is deleted, selectFile(null) unmounts the toolbar holding the Delete button the Moonstone Modal returns focus to, so focus falls to <body> and the keyboard user has to start again from the top of the page.",
      "fix": "After a successful delete, move focus explicitly: select the next file in the list and focus the file-list container (pass a ref from FileSidebar), or focus the list container / 'New' button when the list is empty. Do it after fetchFiles() resolves.",
      "evidence": "await osgiService.delete(f.name); if (selectedFile?.name === f.name) { selectFile(null); } fetchFiles();",
      "foundBy": [
        "keyboard-navigator"
      ]
    },
    {
      "rule": "KBD-REORDER-FOCUS",
      "wcag": "2.1.1 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:584",
      "summary": "Rows are keyed by index, so after Arrow Up/Down on a reorder handle focus stays put while the entry moves; the next press moves the displaced neighbour back, so an entry cannot move more than one step by keyboard.",
      "fix": "Key rows by a stable id (assign one when parsing entries), and after handleReorder(index, target) focus the reorder button of the moved entry at its new index (ref map + requestAnimationFrame). Skip hidden neighbours (filtered rows, hidden comments/empty lines) when computing target, and disable keyboard reorder while filtering as the drag is (line 600). Announce the new position via a polite live region.",
      "evidence": "<TableRow key={index} ...> with onKeyDown: if (e.key === 'ArrowUp' && index > 0) handleReorder(index, index - 1) (lines 614-621); reorder runs even when filtering or when the neighbour row is hidden",
      "component": "CfgEditor",
      "foundBy": [
        "keyboard-navigator"
      ]
    },
    {
      "rule": "KBD-TRAP-EDITOR",
      "wcag": "2.1.2 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:742",
      "summary": "The Monaco editor captures Tab and Shift+Tab (indent/outdent) and the module neither enables tabFocusMode nor tells users the exit key (Ctrl+M, Ctrl+Shift+M on macOS), so a keyboard user entering the raw/YAML editor cannot Tab out of it.",
      "fix": "Keep Tab for indentation but tell users how to leave: add a visible hint in the raw editor toolbar (e.g. 'Press Ctrl+M (Ctrl+Shift+M on macOS) to make Tab move focus'), optionally with a toolbar toggle button calling editorRef.current.trigger('keyboard', 'editor.action.toggleTabFocusMode', null). Also pass ariaLabel to monaco.editor.create and document the key in README.",
      "evidence": "monaco.editor.create(containerRef.current, { value, language, theme, wordBasedSuggestions, minimap, ... }) - no tabFocusMode, no ariaLabel; no addCommand/addAction anywhere; README has no Ctrl+M mention",
      "foundBy": [
        "keyboard-navigator",
        "playwright-scanner"
      ],
      "alsoReportedAs": [
        "RT-KBD-MONACO-TRAP"
      ],
      "component": "MonacoEditor"
    },
    {
      "rule": "LINK-CONTROL-ELEMENT",
      "wcag": "4.1.2 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:137",
      "summary": "Each file entry is a table row with onClick that loads the file: exposed as a plain row, Enter/Space on the focused row do nothing, and the current file is marked only by the isHighlighted class.",
      "fix": "Selecting a file does not change the URL, so use button semantics, not a link: render the list as <ul> with one <button type=\"button\" aria-current={isSelected ? 'true' : undefined}> per file, or a role=\"listbox\" with role=\"option\" aria-selected items driven by the existing ArrowUp/ArrowDown handler (FileSidebar.jsx:77). Use <a href> only if file selection gets its own route.",
      "evidence": "<TableRow ... isHighlighted={selectedFile?.name === f.name} onClick={() => handleFileClick(f)} style={{ cursor: 'pointer' }}>",
      "component": "FileSidebar",
      "foundBy": [
        "link-checker"
      ]
    },
    {
      "rule": "LIVE-ERR-001",
      "wcag": "4.1.3 AA",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/index.jsx:249",
      "summary": "A file load error (e.g. a filtered/blacklisted file) is shown in a StatusBanner that has no role and is mounted with its text, while the toolbar disappears, so screen reader users get no indication why the editor is empty.",
      "fix": "Give StatusBanner an optional role prop and use role=\"alert\" for tone=\"error\": <div role={tone === 'error' ? 'alert' : undefined} ...>. Better: keep an always-mounted <div role=\"alert\"> in the editor pane and render {error} inside it, so the region exists before the text changes.",
      "evidence": "{error && <StatusBanner tone=\"error\" message={error} />}  // AppChrome.jsx:131 <div data-cy={dataCy} style=...> without role",
      "component": "StatusBanner",
      "foundBy": [
        "live-region-controller"
      ]
    },
    {
      "rule": "LIVE-FILTER-002",
      "wcag": "4.1.3 AA",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:535",
      "summary": "The visual editor's filter count ('n properties match') is a visible status message but has no role=\"status\" and is mounted only once filtering starts, so it is never announced.",
      "fix": "Keep the element mounted and give it a status role: <Typography role=\"status\" variant=\"caption\" data-cy=\"cfg-filter-count\" ...>{filtering ? t('editor.filter.count', {count}) : ''}</Typography>. Compute count once (useMemo) instead of inline.",
      "evidence": "{filtering && (<Typography variant=\"caption\" data-cy=\"cfg-filter-count\" ...>{t('editor.filter.count', {...})}</Typography>)}",
      "component": "CfgEditor",
      "foundBy": [
        "aria-specialist",
        "live-region-controller"
      ],
      "alsoReportedAs": [
        "ARIA-LIVE-015"
      ]
    },
    {
      "rule": "LIVE-REORDER-001",
      "wcag": "2.4.3 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:614",
      "summary": "Keyboard reordering announces nothing, and with key={index} (line 584) focus stays on the same position, so a second Arrow key moves the other row back; it also runs while filtering, swapping with hidden rows.",
      "fix": "Key rows by a stable id, not index, so focus follows the moved row; after handleReorder announce through a role=\"status\" region t('editor.reorder.moved', {name: key, position: newIndex + 1, total: entries.length}); in onKeyDown return early when filtering, as the drag handlers already do.",
      "evidence": "<TableRow key={index} ...> ... onKeyDown: if (e.key === 'ArrowUp' && index > 0) { e.preventDefault(); handleReorder(index, index - 1); }",
      "component": "CfgEditor",
      "foundBy": [
        "aria-specialist",
        "live-region-controller",
        "tables-data-specialist"
      ],
      "alsoReportedAs": [
        "ARIA-FOCUS-032",
        "TABLE-REORDER-FOCUS"
      ]
    },
    {
      "rule": "LIVE-TOAST-002",
      "wcag": "4.1.3 AA",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/hooks/useToast.tsx:37",
      "summary": "Errors (save failure useOsgiConfigs.ts:447, delete/toggle/create/upload failures, encryptFailed, decryptRefused) use the same polite, transient toast as successes, so a failed save is easy to miss.",
      "fix": "Add a second always-mounted region <div role=\"alert\">{errorToast && ...}</div> used only by error(); keep success/warning/info in the role=\"status\" region. Error toasts should stay until dismissed (duration: null) and start with a text prefix such as t('notification.errorPrefix') ('Error:').",
      "evidence": "const error = useCallback((msg) => notify(msg, 'error'), [notify]); // same 6000 ms, same container as success",
      "component": "ToastProvider",
      "foundBy": [
        "live-region-controller"
      ]
    },
    {
      "rule": "LIVE-TOAST-003",
      "wcag": "2.2.1 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/hooks/useToast.tsx:30",
      "summary": "Every toast, errors included, disappears after a fixed 6 s with no close button and no pause on hover/focus, too short for long messages such as notification.undecryptableValues or raw server error text.",
      "fix": "Add a close Button (aria-label={t('notification.dismiss')}) inside the Paper; clear the timer on mouseenter/focusin and restart it on mouseleave/focusout; do not auto-dismiss error toasts; for others scale duration with length, e.g. Math.max(6000, message.length * 60).",
      "evidence": "timeoutRef.current = window.setTimeout(() => { setToast(null); ... }, duration); // duration = 6000, no dismiss control rendered",
      "component": "ToastProvider",
      "foundBy": [
        "live-region-controller"
      ]
    },
    {
      "rule": "LIVE-VALID-001",
      "wcag": "3.3.1 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/Dialogs.jsx:458",
      "summary": "The 'identifier already exists' error mounts with its text, is not tied to the identifier input and is shown in red only, while Create is silently disabled, so screen reader users cannot learn why.",
      "fix": "Give the message an id and keep it in an always-mounted container: <Typography id=\"factory-id-error\" role=\"alert\" ...>{isFactoryIdentifierTaken ? t('modal.create.factoryIdentifierExists') : ''}</Typography>; on the Input set aria-invalid={isFactoryIdentifierTaken} and aria-describedby=\"factory-id-error\".",
      "evidence": "{isFactoryIdentifierTaken && (<Typography variant=\"caption\" style={{color: 'var(--color-danger)'}}>{t('modal.create.factoryIdentifierExists')}</Typography>)}",
      "component": "ModalDialog",
      "foundBy": [
        "forms-specialist",
        "live-region-controller",
        "modal-specialist"
      ],
      "alsoReportedAs": [
        "FORM-ERR-001",
        "MODAL-ERROR-NOT-ANNOUNCED"
      ]
    },
    {
      "rule": "LIVE-VALID-002",
      "wcag": "3.3.1 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/CfgMetatypePropertyDialog.jsx:210",
      "summary": "The 'property already exists' message mounts silently, in colour only, and pressing Enter with that name closes the dialog without adding anything or saying so.",
      "fix": "Keep an always-mounted <Typography id=\"cfg-picker-msg\" role=\"status\"> holding customAlreadyExists / knownProperty text; set aria-describedby=\"cfg-picker-msg\" and aria-invalid={customAlreadyExists} on the search Input; in the Enter handler (line 124-130) do not call onClose() when customAlreadyExists.",
      "evidence": "{customAlreadyExists && (<Typography variant=\"caption\" style={{ color: '#db3d44' }}>...)}; onKeyDown: if (exactMatch) ... else if (!customAlreadyExists) ...; onClose();",
      "component": "CfgMetatypePropertyDialog",
      "foundBy": [
        "live-region-controller"
      ]
    },
    {
      "rule": "LIVE-VALID-003",
      "wcag": "3.3.1 A",
      "severity": "serious",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/components/SelectedFileHeader.jsx:25",
      "summary": "When YAML/properties content is invalid, Save is silently disabled and the errors exist only as Monaco markers (squiggles), so a screen reader user gets no text explaining why Save no longer works.",
      "fix": "Have onValidate report the error markers (count + first message/line). Show near Save an always-mounted <Typography id=\"save-validation\" role=\"status\">{t('editor.validation.errors', {count, line, message})}</Typography>, reference it with aria-describedby on Save, and mention F8 (next problem) in it.",
      "evidence": "const isSaveDisabled = !hasUnsaved || ((isRawMode || isYamlFile) && !isYamlValid);  // MonacoEditor.jsx:826-829, 977-979 only pass a boolean",
      "component": "SelectedFileHeader",
      "foundBy": [
        "live-region-controller"
      ]
    },
    {
      "rule": "MODAL-CUSTOM-BACKGROUND-NOT-INERT",
      "wcag": "2.4.3 A",
      "severity": "serious",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/hooks/useDialogA11y.ts:53",
      "summary": "DiffModal and CfgMetatypePropertyDialog leave the page behind focusable and exposed; the Tab trap wraps only from the exact first/last item, so focus elsewhere (e.g. after clicking dialog text) lets Tab escape.",
      "fix": "Prefer a native <dialog> opened with showModal(). Otherwise, in useDialogA11y set inert on the app root (and other body children except the dialog portal) while open and remove it on close; also handle Tab when document.activeElement is outside the container by moving focus to first/last.",
      "evidence": "if (event.shiftKey && active === first) {...} else if (!event.shiftKey && active === last) {...}  // no inert/aria-hidden applied anywhere; DiffModal is not portalled",
      "component": "useDialogA11y",
      "foundBy": [
        "modal-specialist"
      ]
    },
    {
      "rule": "MODAL-DIFF-SCROLL-REGION",
      "wcag": "2.1.1 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/DiffModal.tsx:155",
      "summary": "The review-before-save diff is a scrollable div (60vh, overflow auto) with no tabindex: without focusable-scroller support keyboard users cannot scroll a long diff, and the hook's trap ignores it.",
      "fix": "Give the diff container tabIndex={0}, role=\"region\" and aria-label (e.g. t('modal.diff.title')) plus a visible focus style; tabindex=0 also makes the hook's FOCUSABLE_SELECTOR include it in the Tab cycle.",
      "evidence": "<div style={{ ... maxHeight: '60vh', overflowY: 'auto' ... }}> with only <span> children",
      "component": "DiffModal",
      "foundBy": [
        "keyboard-navigator",
        "modal-specialist",
        "playwright-scanner",
        "tables-data-specialist"
      ],
      "alsoReportedAs": [
        "KBD-SCROLL-REGION",
        "RT-AXE-SCROLL-REGION",
        "DATA-SCROLL-REGION"
      ]
    },
    {
      "rule": "MODAL-FOCUS-RETURN-LOST",
      "wcag": "2.4.3 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/CfgMetatypePropertyDialog.jsx:120",
      "summary": "The autoFocus search input takes focus before useDialogA11y records document.activeElement, so the hook saves the input as the element to return to; on Cancel, Escape or backdrop click focus falls to <body>.",
      "fix": "Capture the trigger before the dialog mounts: record document.activeElement in useLayoutEffect, or pass a triggerRef/returnFocusRef to useDialogA11y and focus it on close; remove autoFocus and let the hook move focus to the input. Selecting a property already focuses the new value via focusEntryValue, keep that.",
      "evidence": "jsdom probe with Moonstone Input autoFocus + the hook's logic: captured previouslyFocused = <input class=\"moonstone-baseInput-element ...\">; activeElement after close = BODY",
      "component": "CfgMetatypePropertyDialog / useDialogA11y",
      "foundBy": [
        "modal-specialist"
      ]
    },
    {
      "rule": "MODAL-NAME-SELF-REFERENCE",
      "wcag": "4.1.2 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/Dialogs.jsx:272",
      "summary": "Moonstone Modal sets aria-labelledby to the dialog's own id and the module does not override it, so the dialog's accessible name is its entire text content (close button, message, every Metatype in the Create list, footer labels).",
      "fix": "Pass aria-labelledby to <Modal> (Moonstone spreads extra props after its own): give the title an id, e.g. wrap config.title in an element with id={titleId} or pass id={headerId} to ModalHeader and point aria-labelledby at the title only, and add aria-describedby={messageId} for config.message.",
      "evidence": "Runtime probe of Moonstone 2.21.0 Modal: role=dialog id=moonstone-modal_:r2: aria-labelledby=moonstone-modal_:r2: aria-modal=true",
      "component": "ModalDialog (all confirm/prompt/alert/createConfig dialogs)",
      "foundBy": [
        "aria-specialist",
        "modal-specialist"
      ],
      "alsoReportedAs": [
        "ARIA-IDREF-020"
      ]
    },
    {
      "rule": "NONTEXT-CONTRAST-001",
      "wcag": "1.4.11 AA",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:81",
      "summary": "Key/value inputs of the visual .cfg editor are bounded only by a --color-gray_light40 border (#dadada at 40%), 1.14:1 against white.",
      "fix": "Use an opaque border reaching 3:1, e.g. 1px solid var(--color-gray) (#7a7f88, 4.0:1 on white). Same issue applies to any other inline border built on gray_light40 that identifies a control.",
      "evidence": "cfgTextInputStyle.border: '1px solid var(--color-gray_light40)' -> composited #f0f0f0 on #fff = 1.14:1",
      "component": "CfgEditor",
      "foundBy": [
        "contrast-master"
      ]
    },
    {
      "rule": "REFLOW-001",
      "wcag": "1.4.10 AA",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:97",
      "summary": "The file sidebar has a fixed 350px width inside a non-wrapping, overflow-hidden flex row, so at 320 CSS px the editor pane collapses to zero width and its content is lost.",
      "fix": "Make the layout responsive: e.g. width: 'min(350px, 100%)' with flex: '0 1 350px', and below ~768px switch APP_LAYOUT_STYLE (AppChrome.jsx:19) to flexDirection: 'column' (or flexWrap: 'wrap') with overflow: 'auto' so sidebar and editor stack.",
      "evidence": "Paper style={{ ...PANEL_STYLE, width: '350px', height: '100%' }}; APP_LAYOUT_STYLE { display: 'flex', overflow: 'hidden' } with no wrap or media query",
      "component": "FileSidebar",
      "foundBy": [
        "contrast-master"
      ]
    },
    {
      "rule": "REFLOW-002",
      "wcag": "1.4.10 AA",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/DiffModal.tsx:105",
      "summary": "The diff dialog has no max-height and its fixed overlay does not scroll, so at 400% zoom (320x256 CSS px) the header and the Save/Cancel footer are clipped off-screen; the non-wrapping header also clips the title and secrets toggle.",
      "fix": "Give the Paper maxHeight: 'calc(100vh - 32px)' with the body as the only flex: 1 / minHeight: 0 / overflow: auto region (replace maxHeight: '60vh'), set overflow: 'auto' on the overlay, and flexWrap: 'wrap' on the header row (line 123).",
      "evidence": "Paper: width 900px, maxWidth 90%, overflow hidden, no maxHeight; body maxHeight 60vh + 24/28px paddings + header + footer > 256px",
      "component": "DiffModal",
      "foundBy": [
        "contrast-master"
      ]
    },
    {
      "rule": "RT-AXE-LABEL",
      "wcag": "4.1.2 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:778",
      "summary": "axe 'label' fails on every per-row encryption checkbox (11 in the sample file) and on the 'Search in content' switch: inputs with no accessible name.",
      "fix": "aria-label on each Checkbox naming the property ('Encrypt value of {{key}}'); associate the switch with its visible text via id/htmlFor or aria-labelledby.",
      "evidence": "input[data-cy=cfg-encrypted-3..19], input[data-cy=deep-search-toggle-control]",
      "component": "CfgEditor / FileSidebar",
      "foundBy": [
        "playwright-scanner"
      ]
    },
    {
      "rule": "RT-MODAL-NAME",
      "wcag": "4.1.2 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/Dialogs.jsx:272",
      "summary": "The delete confirmation (all Moonstone ModalDialogs) is aria-labelledby itself, so its name is its whole content; it has no aria-describedby, opens on the X button named 'Cancel', and its buttons read 'Cancel', 'CANCEL', 'OK'.",
      "fix": "Pass aria-labelledby pointing at the title only and aria-describedby at the message, use role=alertdialog for confirmations, label the X 'Close' and the confirm button with the action ('Delete').",
      "evidence": "role=dialog, aria-labelledby === own id, describedby=null, buttons ['Cancel','CANCEL','OK'], initial focus on X",
      "component": "ModalDialog",
      "foundBy": [
        "playwright-scanner"
      ]
    },
    {
      "rule": "RT-REFLOW-320",
      "wcag": "1.4.10 AA",
      "severity": "serious",
      "confidence": "medium",
      "location": "http://localhost:8080/jahia/administration/osgi-configurations-manager",
      "summary": "At 320 CSS px (1280 at 400%) the module needs about 1100 px of horizontal scrolling even with the secondary navigation collapsed (h1 975px wide), and with it open the module is not visible at all.",
      "fix": "Same layout change as RT-REFLOW-CLIP for the module; the shell's navigation covering the viewport is Jahia's and should be reported to the platform team.",
      "evidence": "320x256, secondary nav collapsed: document scrollWidth=1119, module h1 width=975",
      "component": "App layout",
      "foundBy": [
        "playwright-scanner"
      ]
    },
    {
      "rule": "SEM-DIFF-001",
      "wcag": "1.3.1 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/DiffModal.tsx:177",
      "summary": "In the review-before-save diff, added and removed lines are distinguished only by green/red colour on plain spans, so the changes the dialog exists to show are not conveyed in structure or text.",
      "fix": "Render added parts as <ins> and removed parts as <del>, each with a visually hidden prefix ('Added:' / 'Removed:') since ins/del are not announced by every screen reader, and show a visible '+' / '−' gutter so the distinction does not rely on colour (1.4.1).",
      "evidence": "<span key={index} style={{ backgroundColor: part.added ? '#e6ffec' : part.removed ? '#ffebe9' : 'transparent', … }}>",
      "component": "DiffModal",
      "foundBy": [
        "alt-text-headings",
        "tables-data-specialist"
      ],
      "alsoReportedAs": [
        "DATA-DIFF-SEMANTICS"
      ]
    },
    {
      "rule": "SEM-DIV-BUTTON-002",
      "wcag": "4.1.2 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/DiffModal.tsx:145",
      "summary": "The review-before-save dialog's close control is a div with an onClick around a bare Close icon: no role, no accessible name, not in the tab order.",
      "fix": "Replace with the pattern already used in Dialogs.jsx:285: <Button variant=\"ghost\" size=\"small\" icon={<Close/>} aria-label={t('modal.cancel')} onClick={onClose}/>. Drop the inline onMouseOver/onMouseOut colour hack.",
      "evidence": "<div style={{ cursor: 'pointer', ... }} onClick={onClose} onMouseOver=... ><Close /></div>",
      "component": "DiffModal",
      "foundBy": [
        "alt-text-headings",
        "aria-specialist",
        "keyboard-navigator",
        "link-checker",
        "modal-specialist"
      ],
      "alsoReportedAs": [
        "ARIA-NAME-023",
        "KBD-CLICK-NONFOCUSABLE",
        "LINK-CONTROL-ELEMENT",
        "MODAL-CLOSE-ICON-NOT-BUTTON"
      ]
    },
    {
      "rule": "SEM-DIV-BUTTON-003",
      "wcag": "4.1.2 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/CfgMetatypePropertyDialog.jsx:112",
      "summary": "The Add-property dialog's close control is a div with an onClick around a bare Close icon: no role, no accessible name, not focusable.",
      "fix": "Use <Button variant=\"ghost\" size=\"small\" icon={<Close/>} aria-label={t('modal.cancel')} onClick={onClose}/> as in Dialogs.jsx:285.",
      "evidence": "<div style={{ cursor: 'pointer' }} onClick={onClose}><Close /></div>",
      "component": "CfgMetatypePropertyDialog",
      "foundBy": [
        "alt-text-headings",
        "aria-specialist",
        "forms-specialist",
        "keyboard-navigator",
        "link-checker",
        "modal-specialist"
      ],
      "alsoReportedAs": [
        "ARIA-NAME-025",
        "FORM-CTRL-001",
        "KBD-CLICK-NONFOCUSABLE",
        "LINK-CONTROL-ELEMENT",
        "MODAL-CLOSE-ICON-NOT-BUTTON"
      ]
    },
    {
      "rule": "SEM-LIST-002",
      "wcag": "4.1.2 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:137",
      "summary": "Each file row is a <tr> that Moonstone makes focusable (tabIndex 0) with an onClick but no role, no Enter/Space activation and no exposed selected state (selection is only highlight + bold).",
      "fix": "Make each entry a <button type=\"button\" aria-current={selected ? 'true' : undefined} onClick={() => handleFileClick(f)}> inside an <li>; native buttons give Enter/Space. If arrow-key navigation is kept, use the listbox pattern instead: container role=\"listbox\" aria-label, rows role=\"option\" aria-selected, focus via aria-activedescendant or roving tabindex.",
      "evidence": "<TableRow id=... isHighlighted={selectedFile?.name === f.name} onClick={() => handleFileClick(f)} style={{ cursor: 'pointer' }}> (Moonstone TableRow sets tabIndex: 0)",
      "component": "FileSidebar",
      "foundBy": [
        "alt-text-headings",
        "playwright-scanner"
      ],
      "alsoReportedAs": [
        "RT-KBD-ROW-ENTER"
      ]
    },
    {
      "rule": "STATE-INDICATOR-001",
      "wcag": "1.4.11 AA",
      "severity": "serious",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/components/Dialogs.jsx:75",
      "summary": "The selected metatype/factory card in the Create dialog is shown only by background var(--color-accent_light80), a token Moonstone 2.21 does not define, so the selected state is invisible (and would be colour-only even if defined).",
      "fix": "Use a defined token and a non-colour cue: e.g. background var(--color-accent_light_plain20) plus a 2px left border var(--color-accent_dark) (5.20:1) and a check icon or bold 'Selected' text; also expose selection with aria-selected/aria-pressed. Replace --color-gray_light98 (lines 33, 48), also undefined.",
      "evidence": "background: isSelected ? 'var(--color-accent_light80)' : 'transparent'; no --color-accent_light80 / --color-gray_light98 in @jahia/moonstone 2.21.0 legacy-global-bundle.css",
      "component": "CreateOptionCard",
      "foundBy": [
        "contrast-master"
      ]
    },
    {
      "rule": "TABLE-CELL-CONTROL-NAME",
      "wcag": "4.1.2 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/Editor.jsx:125",
      "summary": "In the YAML table the encryption checkbox (line 125) and the value editors shown on edit (MultilineInput line 87, Input line 93) have no accessible name.",
      "fix": "Add aria-label with the property: Checkbox aria-label 'Encrypt value of {{key}}'; Input and textarea aria-label 'Value of {{key}}' (pass rowLabel or keyString into LeafRow's editors).",
      "evidence": "<Checkbox checked={node.encrypted} onChange={() => handlePropUpdate(currentPath, 'encrypted', !node.encrypted)} />",
      "component": "LeafRow",
      "foundBy": [
        "tables-data-specialist"
      ]
    },
    {
      "rule": "TABLE-HEADER-TD",
      "wcag": "1.3.1 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:179",
      "summary": "The .cfg visual editor's header row is built from TableBodyCell, which renders <td>, so the table has no <th>: Property / Key, Value and Security are not associated with the cells or controls below them.",
      "fix": "Use moonstone's TableHeadCell (renders <th>) or <TableBodyCell component=\"th\" scope=\"col\"> for every cell of CfgEditorHeader, with scope=\"col\".",
      "evidence": "<thead><TableRow><TableBodyCell ...></TableBodyCell>... <TableBodyCell data-cy=\"cfg-header-property\"><Typography ...>{t('editor.header.property')}</Typography></TableBodyCell>",
      "component": "CfgEditorHeader",
      "foundBy": [
        "tables-data-specialist"
      ]
    },
    {
      "rule": "TABLE-HEADER-TD",
      "wcag": "1.3.1 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/Editor.jsx:326",
      "summary": "The YAML visual editor's header row (Property / Key, Value, Security, Actions) uses TableBodyCell, i.e. <td>, so no cell has a column header.",
      "fix": "Replace the four TableBodyCell in the <thead> with <TableHeadCell scope=\"col\"> (or TableBodyCell component=\"th\" scope=\"col\"), keeping the sticky styles.",
      "evidence": "<thead><TableRow><TableBodyCell style={{ flex: '0 0 25%', position: 'sticky', ... }}><Typography variant=\"caption\" weight=\"bold\">{t('editor.header.property')}</Typography></TableBodyCell>",
      "component": "ConfigEditor",
      "foundBy": [
        "tables-data-specialist"
      ]
    },
    {
      "rule": "TABLE-INLINE-EDIT",
      "wcag": "2.1.1 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/Editor.jsx:105",
      "summary": "A YAML value becomes editable only on double-click of a non-focusable div, so keyboard users cannot edit values in the visual editor (only the raw Monaco mode remains).",
      "fix": "Make the value cell's trigger focusable: a <button type=\"button\" aria-label={`Edit value of ${rowLabel}`}> that sets editingValueKey on click/Enter, or always render the Input. Return focus to that trigger when the editor blurs.",
      "evidence": "<div onMouseEnter=... onDoubleClick={() => { onHideOverlay(); setEditingValueKey(keyString); }} style={{ cursor: 'text', ... }}>",
      "component": "LeafRow",
      "foundBy": [
        "tables-data-specialist"
      ]
    },
    {
      "rule": "TREE-COLLAPSE-CONTROL",
      "wcag": "2.1.1 A",
      "severity": "serious",
      "location": "src/javascript/osgiConfigManager/App/components/Editor.jsx:170",
      "summary": "YAML sections collapse through onClick on a <td> with chevron icons: not focusable, no button role, no aria-expanded, so keyboard and screen reader users cannot open or close a section or know its state.",
      "fix": "Put a real button in the container cell: <button type=\"button\" aria-expanded={!isCollapsed} onClick={toggleCollapse}>{chevron}{folder}{displayLabel}</button>, with the icons aria-hidden. Keep the Add Property button outside it.",
      "evidence": "<TableBodyCell colSpan={4} style={{ ..., cursor: 'pointer' }} onClick={toggleCollapse}>{isCollapsed ? <ChevronRight size=\"small\" /> : <ChevronDown size=\"small\" />}",
      "component": "ContainerRow",
      "foundBy": [
        "tables-data-specialist"
      ]
    },
    {
      "rule": "ARIA-DESC-011",
      "wcag": "3.3.1 A",
      "severity": "moderate",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/components/SelectedFileHeader.jsx:73",
      "summary": "When the raw/YAML content is invalid, Save is silently disabled; the Monaco markers are not announced and nothing tells a screen reader user why Save is unavailable.",
      "fix": "Render a status message when !isYamlValid, e.g. <p id=\"save-blocked-reason\" role=\"status\">{t('editor.invalidContent')}</p>, and link it: aria-describedby={isSaveDisabled && !isYamlValid ? 'save-blocked-reason' : undefined} on the Save button. Moonstone Button spreads rest props onto <button>.",
      "evidence": "const isSaveDisabled = !hasUnsaved || ((isRawMode || isYamlFile) && !isYamlValid); <ActionButton ... disabled={isSaveDisabled}/>",
      "component": "SelectedFileHeader",
      "foundBy": [
        "aria-specialist"
      ]
    },
    {
      "rule": "ARIA-DESC-018",
      "wcag": "3.3.1 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/Dialogs.jsx:459",
      "summary": "When the factory identifier already exists, a red caption appears and Create is disabled, but the input is not marked invalid nor linked to the message, so screen reader users do not learn why.",
      "fix": "<Input id=\"factory-id\" aria-invalid={isFactoryIdentifierTaken} aria-describedby={isFactoryIdentifierTaken ? 'factory-id-error' : 'factory-id-hint'} …/> and <Typography id=\"factory-id-error\" role=\"alert\" …>. Give the suggested-filename caption id=\"factory-id-hint\".",
      "evidence": "{isFactoryIdentifierTaken && (<Typography variant=\"caption\" style={{color: 'var(--color-danger)'}}>{t('modal.create.factoryIdentifierExists')}</Typography>)}",
      "component": "ModalDialog",
      "foundBy": [
        "aria-specialist"
      ]
    },
    {
      "rule": "ARIA-LIVE-014",
      "wcag": "4.1.3 AA",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/AppChrome.jsx:111",
      "summary": "InlineLoader ('Loading files…', 'Loading file…') is a CSS spinner with text and no status role; the loading state and its end are not announced and the editor pane carries no aria-busy.",
      "fix": "<div role=\"status\" aria-live=\"polite\">…spinner aria-hidden=\"true\"…{label}</div>, and aria-busy={loadingFile} on the editor container in index.jsx:281.",
      "evidence": "<div style={{... animation: 'osgi-config-manager-spin 0.8s linear infinite'}} /> {label && <Typography variant=\"body\">{label}</Typography>}",
      "component": "InlineLoader",
      "foundBy": [
        "aria-specialist"
      ]
    },
    {
      "rule": "ARIA-NAME-031",
      "wcag": "2.4.6 AA",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:792",
      "summary": "Row delete buttons are icon-only and named solely by a title ('Delete this property'), identical on every row; title-only names are unreliable and do not say which property is deleted.",
      "fix": "aria-label={t('editor.aria.deleteProperty', {key: key || t('editor.emptyLine')})} on the Button (rest props reach <button>); keep title or a Tooltip for sighted users. Apply the same to the show/hide-secret button (line 764) and Editor.jsx:131.",
      "evidence": "<Button data-cy={`cfg-delete-${index}`} icon={<Close />} variant=\"ghost\" color=\"danger\" size=\"small\" title={t('tooltip.deleteProperty')} />",
      "component": "CfgEditor",
      "foundBy": [
        "alt-text-headings",
        "aria-specialist"
      ],
      "alsoReportedAs": [
        "SEM-NAME-001"
      ]
    },
    {
      "rule": "ARIA-NAME-036",
      "wcag": "4.1.2 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:742",
      "summary": "monaco.editor.create is called without ariaLabel, so the raw editor is announced with Monaco's generic name and nothing says which file or format is being edited.",
      "fix": "Add ariaLabel: t('editor.raw.ariaLabel', {name: filename}) and keep Monaco's hint in it (e.g. '… Press Alt+F1 for accessibility options'), since overriding ariaLabel removes Monaco's default hint. Update it with editor.updateOptions when filename changes.",
      "evidence": "monaco.editor.create(containerRef.current, { value, language, theme, minimap: { enabled: false }, lineNumbers: 'on', ... })  // no ariaLabel",
      "component": "MonacoEditor",
      "foundBy": [
        "alt-text-headings",
        "aria-specialist",
        "forms-specialist",
        "playwright-scanner"
      ],
      "alsoReportedAs": [
        "SEM-NAME-003",
        "FORM-LABEL-008",
        "RT-NAME-MONACO"
      ]
    },
    {
      "rule": "ARIA-PRIV-037",
      "wcag": "n/a",
      "severity": "moderate",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:1017",
      "summary": "Secrets are masked only by a CSS inline decoration (transparent text); the characters stay in the model, so Monaco's screen-reader textarea and hover/announce paths read the secret aloud while sighted users see dots.",
      "fix": "Treat AT like the visual editor: when secrets are masked and accessibilitySupport is on, either make the editor readOnly with a masked copy, or hand Monaco a masked model and map edits back. At minimum document it and default secretsVisible=false to a read-only view for AT.",
      "evidence": "options: {inlineClassName: MASKED_SECRET_CLASS} -> .ocm-masked-secret { color: transparent !important; ... }",
      "component": "MonacoEditor",
      "foundBy": [
        "aria-specialist"
      ]
    },
    {
      "rule": "ARIA-ROLE-009",
      "wcag": "4.1.2 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/AppHeaderBar.jsx:37",
      "summary": "role=\"toolbar\" is set on the header actions without an accessible name or the toolbar keyboard model (one tab stop, arrow keys), so it promises behaviour that is not there.",
      "fix": "Either drop role=\"toolbar\" (three independent buttons need no composite role), or keep it with aria-label={t('app.actions')} and a roving tabindex handling ArrowLeft/ArrowRight/Home/End.",
      "evidence": "<div role=\"toolbar\" className=\"flexRow_between alignCenter moonstone-header_toolbar\">",
      "component": "AppHeaderBar",
      "foundBy": [
        "aria-specialist"
      ]
    },
    {
      "rule": "ARIA-SEM-010",
      "wcag": "1.3.1 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/SelectedFileHeader.jsx:31",
      "summary": "The selected file name is styled as a heading (Typography variant 'heading') but renders a <p>, so after the page <h1> there is no heading for the open configuration to navigate to.",
      "fix": "Pass a heading element: typographyProps={{variant: 'heading', component: 'h2'}}. Do the same for the dialog titles in DiffModal.tsx:131 and CfgMetatypePropertyDialog.jsx:109 and reference them with aria-labelledby.",
      "evidence": "<OverflowPreviewText text={selectedFile.name} typographyProps={{variant: 'heading'}} />  (Typography defaults to component 'p')",
      "component": "SelectedFileHeader",
      "foundBy": [
        "aria-specialist"
      ]
    },
    {
      "rule": "ARIA-SEM-028",
      "wcag": "1.3.1 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:178",
      "summary": "The visual editor's header row uses TableBodyCell (<td>) inside <thead>, and three header cells are empty, so cells are not associated with 'Property', 'Value', 'Security' columns.",
      "fix": "Render header cells as <th scope=\"col\">: <TableBodyCell component=\"th\" scope=\"col\" …> (TableBodyCell accepts component) or Moonstone TableHeadCell, and give the empty ones visually hidden text (Reorder, Type, Actions). Same fix in Editor.jsx:326.",
      "evidence": "<thead><TableRow><TableBodyCell ...></TableBodyCell><TableBodyCell ...></TableBodyCell><TableBodyCell data-cy=\"cfg-header-property\">...",
      "component": "CfgEditor",
      "foundBy": [
        "aria-specialist"
      ]
    },
    {
      "rule": "ARIA-STATE-034",
      "wcag": "4.1.2 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:157",
      "summary": "'Toggle Comments' and 'Toggle Empty Lines' are toggle buttons whose on/off state is shown only by an eye icon; no aria-pressed, so screen readers cannot tell whether comments are shown.",
      "fix": "Pass aria-pressed={showComments} and aria-pressed={showEmptyLines} to the Buttons (Moonstone Button spreads rest props onto <button>). Avoid Moonstone ButtonToggle here: it calls blur() on click, dropping keyboard focus.",
      "evidence": "<EditorToolbarButton dataCy=\"cfg-toggle-comments\" label={t('editor.button.toggleComments')} icon={showComments ? <Visibility/> : <Hidden/>} onClick={onToggleComments} />",
      "component": "CfgEditorFooter",
      "foundBy": [
        "aria-specialist"
      ]
    },
    {
      "rule": "ARIA-STATE-038",
      "wcag": "4.1.2 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:1406",
      "summary": "'Add property' opens the Metatype side panel but does not expose aria-expanded/aria-controls, and the panel is an unlabelled div that does not receive focus, so screen reader users are not told it appeared.",
      "fix": "On the button: aria-expanded={showPropertyPanel} aria-controls=\"metatype-property-panel\". On the panel: id=\"metatype-property-panel\" role=\"region\" aria-labelledby its heading (render the 'Available properties' Typography as an h3 with an id), and move focus to the search input when it opens; return focus to the button on Hide.",
      "evidence": "<RawToolbarButton dataCy=\"editor-add-metatype-property\" onClick={() => supportsMetatypeAssistance && setShowPropertyPanel(true)} ... /> ... <div data-cy=\"metatype-property-panel\" style={RAW_EDITOR_PANEL_STYLE}>",
      "component": "MonacoEditor",
      "foundBy": [
        "aria-specialist"
      ]
    },
    {
      "rule": "COG-003",
      "wcag": "3.3.2 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/Dialogs.jsx:502",
      "summary": "The import conflict dialog asks 'What do you want to do?' and the code passes a Rename choice, but ModalDialog never renders otherLabel/onOther, so only Cancel and Overwrite appear and the safer option promised by the wording is missing.",
      "fix": "Render a third footer button when config.otherLabel is set (calling onClose then config.onOther), so 'Rename' is available; or, if renaming is dropped, change modal.conflict.message to 'The file {{name}} already exists. Overwrite it?'.",
      "evidence": "useFileActions.ts:266-284 sets otherLabel: t('modal.conflict.rename') and onOther; Dialogs.jsx:502-525 renders only cancelLabel and confirmLabel.",
      "component": "ModalDialog",
      "foundBy": [
        "cognitive-accessibility"
      ]
    },
    {
      "rule": "COG-004",
      "wcag": "3.3.4 AA",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/hooks/useFileActions.ts:235",
      "summary": "Import overwrites a configuration without the review-before-save diff used by Save, and when the existing file is the .disabled twin it also deletes that file and makes the configuration active, which the conflict message does not say.",
      "fix": "Route an import over an existing file through the DiffModal (old content vs uploaded content), and state the side effect in the conflict message, e.g. 'Importing replaces {{name}}. The configuration will be enabled because the imported file is not .disabled.'",
      "evidence": "await osgiService.save(payload); ... if (existingConflict) { await osgiService.delete(existingConflict.name); }",
      "component": "useFileActions",
      "foundBy": [
        "cognitive-accessibility"
      ]
    },
    {
      "rule": "COG-007",
      "wcag": "3.3.7 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/hooks/useOsgiConfigs.ts:629",
      "summary": "The tree editor's 'Add Property' prompt closes before the duplicate check; a duplicate name opens a separate error dialog and the administrator must start again and retype the name.",
      "fix": "Check the name against existing keys inside the prompt and show the error under the input without closing it, keeping the typed value.",
      "confidence": "medium",
      "evidence": "onConfirm: (key) => { const onError = msg => setTimeout(() => setModalConfig({... message: msg ...}), 100); addProperty(path, key, onError); }",
      "component": "useOsgiConfigs handleAddProperty",
      "foundBy": [
        "cognitive-accessibility"
      ]
    },
    {
      "rule": "COG-008",
      "wcag": "2.4.6 AA",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/hooks/useFileActions.ts:72",
      "summary": "The delete-file confirmation's action button reads only 'OK' and the message does not say the file is permanently removed from the server; the delete-property confirmation (useOsgiConfigs.ts:670) also falls back to 'OK'.",
      "fix": "Pass confirmLabel: 'Delete file' (and 'Delete property'), and reword modal.deleteFile.message to 'Delete {{name}} from the server? This cannot be undone. Download it first if you may need it again.'",
      "evidence": "setModalConfig({type:'confirm', severity:'warning', title, message}) with no confirmLabel, so Dialogs.jsx:519 renders t('modal.ok') = 'OK'; en.json:71 'Are you sure you want to delete {{name}}?'",
      "component": "useFileActions",
      "foundBy": [
        "cognitive-accessibility"
      ]
    },
    {
      "rule": "COG-009",
      "wcag": "2.4.6 AA",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/SelectedFileHeader.jsx:64",
      "summary": "The header button that discards every unsaved edit in the file is labelled 'Cancel', the same word used to dismiss dialogs, so its effect (revert the file to its saved state) is not described.",
      "fix": "Label it 'Discard changes' (matching modal.unsaved.confirm 'Discard Changes') or 'Revert', with tooltip 'Reload the saved version and discard your edits'.",
      "evidence": "<ActionButton dataCy=\"cancel-config-button\" tooltip={t('modal.cancel')} label={t('modal.cancel')} onClick={onCancel} />",
      "component": "SelectedFileHeader",
      "foundBy": [
        "cognitive-accessibility"
      ]
    },
    {
      "rule": "COG-010",
      "wcag": "2.4.6 AA",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:196",
      "summary": "The encryption checkbox in each .cfg row sits under a column titled only 'Security', so nothing says that ticking it stores the value as ENC(...) on save.",
      "fix": "Rename the column 'Encrypted' (en.json editor.header.security) and give each checkbox a label and tooltip such as 'Encrypt the value of {{key}} when saving'.",
      "evidence": "Header t('editor.header.security') = 'Security'; cell title='Security'; <Checkbox checked={isEncrypted} onChange=... /> with no label (lines 777-786).",
      "component": "CfgEditor",
      "foundBy": [
        "cognitive-accessibility"
      ]
    },
    {
      "rule": "COG-011",
      "wcag": "2.4.6 AA",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/Dialogs.jsx:209",
      "summary": "In 'Create new configuration' the tabs 'Manual', 'Configuration' and 'Factory' and the heading 'Filter' do not say what each path creates, and 'Created file:' labels a file that does not exist yet.",
      "fix": "Use descriptive labels: 'Empty file', 'From Metatype', 'Factory instance'; 'Filter available configurations'; and 'File to create:' instead of 'Created file:' (en.json modal.create.tabs.*, filterLabel, suggestedFilename).",
      "evidence": "en.json:42-47 filterLabel 'Filter', tabs 'Manual' / 'Configuration' / 'Factory'; en.json:53 suggestedFilename 'Created file'.",
      "component": "ModalDialog createConfig",
      "foundBy": [
        "cognitive-accessibility"
      ]
    },
    {
      "rule": "COG-012",
      "wcag": "3.2.2 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:77",
      "summary": "Arrow keys in the file list immediately open the next file, replacing the editor, toolbar and banners (and opening a discard-changes dialog on each press when edits are unsaved), without any instruction that arrows open files.",
      "fix": "Let arrow keys move focus only and open a file on Enter or Space (or click); if selection must follow focus, add a visible hint above the list, e.g. 'Use Arrow keys to move, Enter to open'.",
      "confidence": "medium",
      "evidence": "if (e.key === 'ArrowDown') { e.preventDefault(); handleFileClick(processedFiles[nextIndex]); } on a tabIndex=0 div with no role or instructions (lines 129-133).",
      "component": "FileSidebar",
      "foundBy": [
        "cognitive-accessibility"
      ]
    },
    {
      "rule": "COG-013",
      "wcag": "n/a",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:1146",
      "summary": "When Metatype help is available, pressing Enter opens the suggestion list on the new empty line, so a second Enter inserts the first suggested property instead of another blank line.",
      "fix": "Do not open suggestions automatically on newline (users can press Ctrl+Space), or set acceptSuggestionOnEnter: 'off' (or 'smart') in the editor options so Enter keeps inserting a line.",
      "confidence": "medium",
      "evidence": "editor.onDidChangeModelContent(event => { if (... change.text.includes('\\n')) ... editor.trigger('metatype','editor.action.triggerSuggest', {}) }); no acceptSuggestionOnEnter option is set.",
      "component": "MonacoEditor",
      "foundBy": [
        "cognitive-accessibility"
      ]
    },
    {
      "rule": "COG-014",
      "wcag": "3.3.2 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:1192",
      "summary": "The raw editor's Encrypt and Decrypt tooltips promise to act on the selection, but both act on the value of the cursor's line; Encrypt silently does nothing when that line has no value or is already encrypted.",
      "fix": "Reword tooltips to 'Encrypt the value on the cursor's line' and 'Decrypt the ENC(...) value on the cursor's line' (en.json tooltip.encryptSelection, tooltip.decryptSelection), and show a warning toast when Encrypt finds nothing to encrypt, as Decrypt already does.",
      "evidence": "en.json:250 'Encrypt current line value or selection', en.json:251 'Decrypt selected text'; MonacoEditor.jsx:1209-1218 'if (!match) return; if (!valuePart) return; if (valueTrimmed.startsWith(\"ENC(\")) return;'",
      "component": "MonacoEditor",
      "foundBy": [
        "cognitive-accessibility"
      ]
    },
    {
      "rule": "COG-015",
      "wcag": "n/a",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/SelectedFileHeader.jsx:25",
      "summary": "Nothing visible says the open file has unsaved changes; the only cue is that Save and Cancel become enabled, so administrators must remember whether they edited the file. The 'app.unsaved' label exists but is never used.",
      "fix": "Show an 'Unsaved changes' chip next to the file name when hasUnsaved is true, using t('app.unsaved'), and mark the file's row in the sidebar.",
      "evidence": "isSaveDisabled = !hasUnsaved || ...; en.json:17 \"unsaved\": \"Unsaved Changes\" has no reference in src/javascript.",
      "component": "SelectedFileHeader",
      "foundBy": [
        "cognitive-accessibility"
      ]
    },
    {
      "rule": "COG-016",
      "wcag": "n/a",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/index.jsx:110",
      "summary": "Unsaved edits are guarded for in-app actions but not when leaving the page: a reload, a click in the Jahia admin menu, or a sign-in after an expired session discards them with no warning.",
      "fix": "Register a beforeunload handler while hasUnsaved is true, and guard the Jahia route change if the app shell provides a hook for it.",
      "evidence": "runWithUnsavedConfirmation covers file switch, refresh, create, import, toggle and mark-as-default; no beforeunload handler exists under src/javascript/osgiConfigManager.",
      "component": "AppContent",
      "foundBy": [
        "cognitive-accessibility"
      ]
    },
    {
      "rule": "COLOR-ONLY-002",
      "wcag": "1.4.1 A",
      "severity": "moderate",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/hooks/useToast.tsx:58",
      "summary": "Error and warning toasts use the same Warning icon and differ only by the colour of the icon and the 4px left border.",
      "fix": "Use a distinct icon for errors (e.g. a cross/close-circle icon) and/or prefix the message with a visible 'Error:'/'Warning:' label, so the toast type does not depend on colour.",
      "evidence": "warning: <Warning style={{color:'var(--color-warning)'}}/>, error: <Warning style={{color:'var(--color-danger)'}}/>",
      "component": "ToastProvider",
      "foundBy": [
        "contrast-master",
        "live-region-controller"
      ],
      "alsoReportedAs": [
        "LIVE-TOAST-005"
      ]
    },
    {
      "rule": "CONTRAST-TEXT-005",
      "wcag": "1.4.3 AA",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/SelectedFileHeader.jsx:43",
      "summary": "The selected file's path (caption size) uses CHROME_TOKENS.subtleTextColor = --color-gray_dark60 (#293136 at 60%), 3.82:1 on white.",
      "fix": "Change CHROME_TOKENS.subtleTextColor (AppChrome.jsx:9) to an opaque colour, e.g. var(--color-gray_dark) (12.9:1) or #5c6166 (~6:1). This also fixes EMPTY_STATE_STYLE and InlineLoader text.",
      "evidence": "subtleTextColor: 'var(--color-gray_dark60)' -> #7f8386 on #fff = 3.82:1 (3.70:1 on #f6f6f6)",
      "component": "AppChrome CHROME_TOKENS",
      "foundBy": [
        "contrast-master"
      ]
    },
    {
      "rule": "CONTRAST-TEXT-006",
      "wcag": "1.4.3 AA",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:536",
      "summary": "The filter match count caption uses --color-gray_dark60, 3.82:1 on white.",
      "fix": "Use CHROME_TOKENS.subtleTextColor once fixed, or var(--color-gray_dark).",
      "evidence": "style={{color: 'var(--color-gray_dark60)'}} -> 3.82:1",
      "component": "CfgEditor",
      "foundBy": [
        "contrast-master"
      ]
    },
    {
      "rule": "CONTRAST-TEXT-007",
      "wcag": "1.4.3 AA",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:674",
      "summary": "The '(empty line)' placeholder text uses --color-gray_dark40 italic caption, 2.26:1 on white (2.21:1 on the selected row).",
      "fix": "Use an opaque colour reaching 4.5:1, e.g. #5c6166, keeping the italic style.",
      "evidence": "style={{ color: 'var(--color-gray_dark40)', fontStyle: 'italic' }} -> #a9adaf on #fff = 2.26:1",
      "component": "CfgEditor",
      "foundBy": [
        "contrast-master"
      ]
    },
    {
      "rule": "CONTRAST-TEXT-008",
      "wcag": "1.4.3 AA",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/Dialogs.jsx:459",
      "summary": "The 'identifier already exists' error caption uses --color-danger #f44053, 3.68:1 on white.",
      "fix": "Use a darker red reaching 4.5:1, e.g. #c62828 (5.6:1), and keep an icon or 'Error:' prefix so the error is not colour-only.",
      "evidence": "style={{color: 'var(--color-danger)'}} on FACTORY_DETAILS_STYLE white background",
      "component": "ModalDialog",
      "foundBy": [
        "contrast-master"
      ]
    },
    {
      "rule": "CONTRAST-TEXT-009",
      "wcag": "1.4.3 AA",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/CfgMetatypePropertyDialog.jsx:211",
      "summary": "The 'property already exists' caption uses #db3d44, 4.41:1 on white (just under 4.5:1).",
      "fix": "Darken to #c62828 (5.6:1) or the same token chosen for Dialogs.jsx:459.",
      "evidence": "style={{ color: '#db3d44' }} -> 4.41:1",
      "component": "CfgMetatypePropertyDialog",
      "foundBy": [
        "contrast-master"
      ]
    },
    {
      "rule": "FORCED-COLORS-001",
      "wcag": "n/a",
      "severity": "moderate",
      "confidence": "low",
      "location": "src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:103",
      "summary": "Secret masking in the raw editor relies on color: transparent plus a gradient background; in Windows forced-colors mode the UA may force the text colour and drop the gradient, showing the secret in clear.",
      "fix": "Add @media (forced-colors: active) { .ocm-masked-secret { forced-color-adjust: none; color: transparent !important; background-image: radial-gradient(circle, CanvasText 2px, transparent 2.5px); } } and verify in Edge with forced colors on.",
      "evidence": ".ocm-masked-secret { color: transparent !important; background-image: radial-gradient(... #4a5561 ...) }",
      "component": "MonacoEditor",
      "foundBy": [
        "contrast-master"
      ]
    },
    {
      "rule": "FORM-AUTOFILL-001",
      "wcag": "n/a",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:735",
      "summary": "The masked secret field is <input type=\"password\"> without autocomplete. A browser password manager can offer or autofill the admin's saved Jahia password into a configuration secret, which would then be saved to the file.",
      "fix": "Add autoComplete=\"new-password\" (Chrome ignores 'off' on password fields) to the Moonstone Input; it is spread onto the native input. Also add spellCheck={false} and autoCapitalize=\"off\" to the key and value textareas, so mobile autocorrect does not change keys.",
      "confidence": "medium",
      "evidence": "<Input ... type={!isSecretVisible ? 'password' : 'text'} placeholder={t('editor.placeholder.value')} />",
      "component": "CfgEditor row",
      "foundBy": [
        "forms-specialist"
      ]
    },
    {
      "rule": "FORM-ERR-002",
      "wcag": "3.3.7 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/hooks/useFileActions.ts:118",
      "summary": "A manual filename with a wrong extension is rejected only after the Create dialog has closed, in a separate error modal. The typed name is lost, so the user must reopen the dialog and type it again.",
      "fix": "Validate the extension inside ModalDialog before calling onClose(): show the 'Filename must end with .cfg, .yml, .cfg.disabled or .yml.disabled' message inline, linked to the input with aria-describedby and aria-invalid, and keep focus and the value in the field. Keep the server-side check as a fallback.",
      "evidence": "if (!isValid) { setModalConfig({ type: 'confirm', severity: 'warning', title: t('modal.error.title'), message: t('modal.error.invalidExtension'), ... }); return; }",
      "component": "ModalDialog createConfig",
      "foundBy": [
        "forms-specialist"
      ]
    },
    {
      "rule": "FORM-ERR-003",
      "wcag": "3.3.1 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/CfgMetatypePropertyDialog.jsx:123",
      "summary": "When the typed name already exists in the file, pressing Enter closes the dialog without adding or focusing anything. The 'already exists' message (line 210) is not linked or announced, so the user is not told what happened.",
      "fix": "On Enter with customAlreadyExists, keep the dialog open, set aria-invalid on the input and link the message with aria-describedby and role=\"alert\". Alternatively, call onCreateCustomProperty(trimmedQuery), whose insertOrFocusProperty already focuses the existing row, then close the dialog.",
      "evidence": "if (exactMatch) {...} else if (!customAlreadyExists) { onCreateCustomProperty(trimmedQuery); } onClose();",
      "component": "CfgMetatypePropertyDialog",
      "foundBy": [
        "forms-specialist"
      ]
    },
    {
      "rule": "FORM-ERR-005",
      "wcag": "3.3.1 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/hooks/useOsgiConfigs.ts:345",
      "summary": "Duplicate keys in the visual editor are reported only in a modal. The offending rows get no aria-invalid and no inline message, and focus does not move to the first duplicate once the modal is closed.",
      "fix": "Keep the modal text, and also mark the duplicate rows: aria-invalid=\"true\" plus aria-describedby pointing to an inline message 'Duplicate key' on each key textarea. Once the modal closes, focus the first duplicate's key field (inputRefs[index].key.focus()).",
      "confidence": "medium",
      "evidence": "if (duplicateKeys.size > 0) { setModalConfig({ type: 'alert', title: t('modal.error.title'), message: t('modal.error.duplicateKeys', {...}) }); return; }",
      "component": "Visual editor save",
      "foundBy": [
        "forms-specialist"
      ]
    },
    {
      "rule": "FORM-ERR-006",
      "wcag": "3.3.1 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/utils/configUtils.ts:370",
      "summary": "A property row with an empty key is saved as ' = value' without any warning. The raw editor flags the same line as an error (missingKey), but visual mode does not detect it, so a broken line can be written to a server configuration.",
      "fix": "In handleSave (useOsgiConfigs.ts, next to the duplicate check), refuse property entries with an empty key: show an error that names the row, set aria-invalid on its key field and focus it. Or drop empty rows explicitly, with a notice.",
      "confidence": "medium",
      "evidence": "if (type === 'property') { return `${key} = ${withLineContinuations(key, value)}`; }",
      "component": "Visual editor save",
      "foundBy": [
        "forms-specialist"
      ]
    },
    {
      "rule": "FORM-NAME-001",
      "wcag": "1.3.1 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/CfgMetatypePropertyDialog.jsx:153",
      "summary": "Each property option button sets aria-label={property.id}, which replaces the visible type, default value and description: screen-reader users hear only the identifier and lose the information needed to choose.",
      "fix": "Remove the aria-label so the name comes from the button content, or keep the name short and add aria-describedby pointing to the type, default and description elements (give them ids).",
      "evidence": "<button type=\"button\" ... aria-label={property.id} onClick=...>",
      "component": "CfgMetatypePropertyDialog",
      "foundBy": [
        "alt-text-headings",
        "aria-specialist",
        "forms-specialist"
      ],
      "alsoReportedAs": [
        "SEM-NAME-002",
        "ARIA-NAME-027"
      ]
    },
    {
      "rule": "FORM-PREVENT-001",
      "wcag": "n/a",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/hooks/useFileActions.ts:267",
      "summary": "The upload-conflict dialog sets otherLabel/onOther ('Rename'), but ModalDialog never renders a third button. The only choices are Overwrite or Cancel, so the documented non-destructive way to keep both files cannot be used.",
      "fix": "Render config.otherLabel in ModalDialog's footer (Dialogs.jsx:502-524) as a button that calls onClose() and then config.onOther(). Add a Cypress check that the conflict dialog shows three actions.",
      "evidence": "otherLabel: t('modal.conflict.rename'), onOther: () => { ... setModalConfig({ type: 'prompt', title: t('modal.rename.title'), ... }) }",
      "component": "ModalDialog",
      "foundBy": [
        "forms-specialist"
      ]
    },
    {
      "rule": "FORM-REQ-001",
      "wcag": "3.3.2 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:750",
      "summary": "Metatype properties declared mandatory (optional: false) are not marked as required in the visual editor: there is no visible indicator and no aria-required. The only way to learn it is the hover tooltip ('Optional: No').",
      "fix": "When propertyMap.get(key)?.optional === false, add aria-required=\"true\" to the value textarea or Input, and a visible marker with text next to the key (for example '*' plus visually hidden '(required)'), explained once above the table.",
      "confidence": "medium",
      "evidence": "buildPropertyDocumentation: details.push(`${t('editor.metatype.optional')}: ...`) - shown only in the tooltip",
      "component": "CfgEditor row",
      "foundBy": [
        "forms-specialist"
      ]
    },
    {
      "rule": "FORM-REQ-002",
      "wcag": "3.3.2 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/Dialogs.jsx:224",
      "summary": "The Create dialog's required inputs are not marked as required, and the .cfg/.yml extension rule is not stated before submitting. Create is natively disabled, so it leaves the tab order with no reason given.",
      "fix": "Add required / aria-required=\"true\" to the filename and identifier inputs, and state the allowed extensions in a hint linked by aria-describedby. Prefer to keep Create enabled and validate on click: show an inline error with aria-invalid and move focus to the field, instead of disabling silently.",
      "evidence": "const isConfirmDisabled = isCreateConfig ? ((activeCreateTab === 'manual' && !manualFilename.trim()) || ...) : false;",
      "component": "ModalDialog createConfig",
      "foundBy": [
        "forms-specialist"
      ]
    },
    {
      "rule": "FORM-SEARCH-001",
      "wcag": "3.3.2 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:528",
      "summary": "The property filter (Moonstone SearchInput) has no label, only the placeholder 'Filter by property name or value', which disappears when typing. Its role=\"search\" wrapper has no name either.",
      "fix": "Pass aria-label={t('editor.filter.label')} to SearchInput (rest props reach the native <input role=\"searchbox\">), or render a visible <label htmlFor> with an id on the input. Keep the placeholder as a hint only.",
      "evidence": "<SearchInput value={filter} placeholder={t('editor.filter.placeholder')} onChange=... onClear=.../>",
      "component": "SearchInput usage",
      "foundBy": [
        "forms-specialist"
      ]
    },
    {
      "rule": "FORM-SEARCH-002",
      "wcag": "3.3.2 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:101",
      "summary": "The sidebar file filter has only the placeholder 'Filter configs...' as its label. The filtered list then changes with no announced result count, and a deep search refetches from the server silently.",
      "fix": "Add aria-label={t('app.searchLabel')} (or a visible label) to SearchInput. Add an always-present <div role=\"status\" aria-live=\"polite\"> stating the result count, for example '12 configurations', updated after filtering or after the deep-search fetch resolves.",
      "evidence": "<SearchInput value={searchTerm} placeholder={t('app.searchPlaceholder')} onChange=... onClear=.../>",
      "component": "SearchInput usage",
      "foundBy": [
        "forms-specialist"
      ]
    },
    {
      "rule": "FORM-STATUS-001",
      "wcag": "4.1.3 AA",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:536",
      "summary": "The property filter's result count ('Matching properties: N') appears without a live region, so screen-reader users get no feedback that rows were hidden or how many remain.",
      "fix": "Wrap the count in an element that is always in the DOM, <div role=\"status\" aria-live=\"polite\">, and render the text inside it only while filtering (do not mount the live region conditionally).",
      "evidence": "{filtering && (<Typography variant=\"caption\" data-cy=\"cfg-filter-count\">{t('editor.filter.count', ...)}</Typography>)}",
      "component": "CfgEditor filter",
      "foundBy": [
        "forms-specialist",
        "tables-data-specialist"
      ],
      "alsoReportedAs": [
        "TABLE-FILTER-STATUS"
      ]
    },
    {
      "rule": "FORM-TYPE-001",
      "wcag": "3.3.2 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:750",
      "summary": "Every Metatype type (Boolean, Integer, option lists) is edited in the same free-text field. Allowed values and format are neither offered nor stated, so the user must guess ('true' or 'TRUE'? option key or label?).",
      "fix": "Render the control from the Metatype type: a native <select> (or Moonstone Dropdown) for properties with options; a checkbox, or a select with true/false, for Boolean; <input inputMode=\"numeric\"> for Integer/Long. If free text is kept, show the type and allowed values as visible hint text linked with aria-describedby.",
      "confidence": "medium",
      "evidence": "<AutoResizeTextArea data-cy={`cfg-value-${index}`} ... placeholder={t('editor.placeholder.value')}/> used for every type",
      "component": "CfgEditor row",
      "foundBy": [
        "forms-specialist"
      ]
    },
    {
      "rule": "HEAD-001",
      "wcag": "1.3.1 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/SelectedFileHeader.jsx:34",
      "summary": "The selected file name is styled as a heading but rendered as <p> (Moonstone Typography defaults to p whatever the variant), so the editor panel has no heading under the module's h1.",
      "fix": "Pass the element: typographyProps={{variant: 'heading', component: 'h2'}} (OverflowPreviewText spreads typographyProps into Typography). Outline target: h1 app title > h2 file list (LAND-001) > h2 selected file name.",
      "evidence": "<OverflowPreviewText text={selectedFile.name} showPreview={false} typographyProps={{variant: 'heading'}} />",
      "component": "SelectedFileHeader",
      "foundBy": [
        "alt-text-headings"
      ]
    },
    {
      "rule": "KBD-DIALOG-FOCUS-RESET",
      "wcag": "2.4.3 A",
      "severity": "moderate",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/hooks/useDialogA11y.ts:91",
      "summary": "useDialogA11y re-runs whenever onClose changes; callers pass inline arrows, so any parent re-render while a dialog is open (e.g. a toast appearing or expiring) moves focus back to the dialog's first control.",
      "fix": "Store onClose in a ref inside the hook (const onCloseRef = useRef(onClose); onCloseRef.current = onClose) and depend on [isOpen] only; memoize the ToastContext value with useMemo in useToast.tsx:74; optionally wrap the callers' onClose in useCallback.",
      "evidence": "}, [isOpen, onClose]); and onClose={() => setDiffConfig(prev => ({ ...prev, isOpen: false }))}",
      "component": "useDialogA11y",
      "foundBy": [
        "keyboard-navigator",
        "modal-specialist"
      ],
      "alsoReportedAs": [
        "MODAL-HOOK-EFFECT-DEPS"
      ]
    },
    {
      "rule": "KBD-FOCUS-LOST-DISABLED",
      "wcag": "2.4.3 A",
      "severity": "moderate",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/components/SelectedFileHeader.jsx:82",
      "summary": "After Save (focus is returned to the Save button when the review dialog closes) or Cancel, hasUnsaved becomes false and the focused button gets disabled, which drops focus to <body>.",
      "fix": "Keep Save/Cancel focusable when nothing is pending (aria-disabled=\"true\" and a no-op handler instead of the disabled attribute), or after the save/cancel completes move focus to a stable target such as the selected file heading (tabIndex={-1}) or the editor.",
      "evidence": "disabled={isSaveDisabled} (82), disabled={!hasUnsaved} (70); save flow useOsgiConfigs.ts:390-442",
      "component": "SelectedFileHeader",
      "foundBy": [
        "keyboard-navigator"
      ]
    },
    {
      "rule": "KBD-FOCUS-LOST-REMOVED",
      "wcag": "2.4.3 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:798",
      "summary": "Deleting a .cfg entry returns focus to the delete button's DOM node, which, with index keys, now belongs to the next entry (a second Enter targets a different row), or is gone when the last row was deleted, leaving focus on <body>.",
      "fix": "With stable row keys, after deleteProperty move focus to the key field of the entry now at that index, or to the previous row when the last one was deleted, or to the 'Add property' button when the list is empty.",
      "evidence": "onClick={(e) => { e.stopPropagation(); handleDeleteProperty([index]); }} with <TableRow key={index}> (584)",
      "component": "CfgEditor",
      "foundBy": [
        "keyboard-navigator"
      ]
    },
    {
      "rule": "KBD-HOVER-ONLY",
      "wcag": "1.4.13 AA",
      "severity": "moderate",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/components/AppChrome.jsx:199",
      "summary": "OverflowPreviewText reveals the full text of truncated file names (sidebar) and the file path (header) only on mouseenter, so keyboard users cannot read long names that are cut with an ellipsis.",
      "fix": "Show the preview on focus as well (onFocus/onBlur on the focusable ancestor, or render it for the active row of the list), or let the text wrap instead of truncating. For the selected file header, which uses showPreview={false} (SelectedFileHeader.jsx:33), allow the heading to wrap.",
      "evidence": "onMouseEnter={showPreviewIfNeeded} onMouseLeave={hidePreview} - no focus trigger",
      "component": "OverflowPreviewText",
      "foundBy": [
        "keyboard-navigator"
      ]
    },
    {
      "rule": "KBD-PANEL-FOCUS",
      "wcag": "2.4.3 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:1409",
      "summary": "Opening the Metatype 'Add property' panel leaves focus on the toolbar, the panel sits after the Tab-capturing Monaco editor in DOM order, and closing it unmounts the focused Hide button, dropping focus to <body>.",
      "fix": "On open, focus the panel's search Input (ref + useEffect on showPropertyPanel); on close, return focus to the 'Add property' toolbar button; close on Escape. Consider placing the panel before the editor canvas in DOM order (visual order can stay with CSS order).",
      "evidence": "onClick={() => supportsMetatypeAssistance && setShowPropertyPanel(true)} (1409); panel rendered at 1434 after the editor container (1420); hide button onClick={() => setShowPropertyPanel(false)} (1458)",
      "component": "MonacoEditor",
      "foundBy": [
        "keyboard-navigator"
      ]
    },
    {
      "rule": "KBD-STICKY-OBSCURES",
      "wcag": "2.4.11 AA",
      "severity": "moderate",
      "confidence": "low",
      "location": "src/javascript/osgiConfigManager/App/hooks/useToast.tsx:80",
      "summary": "The toast is position: fixed at bottom-right for 6 s with no Escape dismissal and can sit over the bottom-right controls of the editor (e.g. the .cfg footer 'Toggle empty lines' button) while a keyboard user tabs onto them.",
      "fix": "Place the toast where it cannot overlap the editor footer (e.g. top-right of the content area), or dismiss it on Escape without moving focus, and pause/close it when focus moves under it. Verify at runtime with the e2e keyboard scan.",
      "evidence": "position: 'fixed', bottom: '20px', right: '20px', zIndex: 10000, minWidth: '280px'",
      "component": "ToastProvider",
      "foundBy": [
        "keyboard-navigator"
      ]
    },
    {
      "rule": "LAND-001",
      "wcag": "1.3.1 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:97",
      "summary": "The two panes (file list, editor) and the raw editor's property side panel are anonymous divs with no heading or region name, so they cannot be reached by landmark or heading navigation.",
      "fix": "Wrap the sidebar in <nav aria-labelledby=\"ocm-files-heading\"> (or <section>) with an <h2 id=\"ocm-files-heading\"> (visually hidden is fine), the editor Paper (index.jsx:231) in <section aria-labelledby> pointing to the file-name h2 (HEAD-001), and the panel at MonacoEditor.jsx:1435 in <aside aria-labelledby> pointing to its h3. Paper accepts component or wrap it.",
      "evidence": "<Paper style={{ ...PANEL_STYLE, width: '350px', height: '100%' }}> / <Paper style={{ ...PANEL_STYLE, flex: '1 1 0%', … }}>",
      "component": "FileSidebar / App / MonacoEditor",
      "foundBy": [
        "alt-text-headings"
      ]
    },
    {
      "rule": "LIVE-FILTER-001",
      "wcag": "4.1.3 AA",
      "severity": "moderate",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:136",
      "summary": "Typing in the sidebar search or toggling deep search changes the file list without any result count or 'no match' message, so screen reader users do not know how many files match or that none do.",
      "fix": "Below the Switch add an always-mounted <Typography role=\"status\" variant=\"caption\">{t('app.searchCount', {count: processedFiles.length, total: files.length})}</Typography> (debounce ~500 ms, as the deep search already is), and show t('app.searchNoResults') in it when the list is empty.",
      "evidence": "{processedFiles.map(f => (<TableRow ...>))}  // no count, no empty state",
      "component": "FileSidebar",
      "foundBy": [
        "live-region-controller"
      ]
    },
    {
      "rule": "LIVE-FILTER-003",
      "wcag": "4.1.3 AA",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/Dialogs.jsx:370",
      "summary": "In the create dialog, the template/factory filter shows 'no configuration'/'no factory' messages that mount with their text and gives no result count, so filtering is silent for screen reader users.",
      "fix": "Add one always-mounted <Typography role=\"status\" variant=\"caption\"> under the filter input (Dialogs.jsx:353) carrying t('modal.create.filterCount', {count}) or the empty-state text for the active tab; keep the visible empty items as they are.",
      "evidence": "{availableMetatypes.length === 0 && (<div style={EMPTY_LIST_ITEM_STYLE}><Typography ...>{t('modal.create.emptyMetatypes')}</Typography></div>)}",
      "component": "ModalDialog",
      "foundBy": [
        "live-region-controller"
      ]
    },
    {
      "rule": "LIVE-FILTER-004",
      "wcag": "4.1.3 AA",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:1490",
      "summary": "The raw editor's 'Available properties' search shows its no-results text by conditional mount and gives no count, so results are not announced.",
      "fix": "Add an always-mounted <Typography role=\"status\" variant=\"caption\"> below the Input at line 1469 that holds t('editor.metatype.searchCount', {count: filteredProperties.length}) or t('editor.metatype.noResults').",
      "evidence": "{filteredProperties.length === 0 && (<Typography variant=\"caption\" color=\"textSecondary\">{t('editor.metatype.noResults')}</Typography>)}",
      "component": "MonacoEditor",
      "foundBy": [
        "live-region-controller"
      ]
    },
    {
      "rule": "LIVE-FILTER-005",
      "wcag": "4.1.3 AA",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/CfgMetatypePropertyDialog.jsx:146",
      "summary": "The visual editor's property picker filters its list with no count and no empty-state text at all, so a screen reader user typing a query gets no feedback.",
      "fix": "Add an always-mounted <Typography role=\"status\" variant=\"caption\"> after the Input (line 118) with t('editor.metatype.searchCount', {count: filteredProperties.length}), and a visible no-results line when the list is empty.",
      "evidence": "{filteredProperties.map(property => (<button ...>))}  // nothing rendered when empty",
      "component": "CfgMetatypePropertyDialog",
      "foundBy": [
        "live-region-controller"
      ]
    },
    {
      "rule": "LIVE-FOCUS-001",
      "wcag": "2.4.3 A",
      "severity": "moderate",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/index.jsx:282",
      "summary": "After a confirmed save, the Save button becomes disabled and the editor is swapped for the loader, so keyboard focus is likely dropped to the page body and the user loses their place.",
      "fix": "Before the reload, move focus to a stable target (e.g. the file-name heading with tabIndex={-1}, or the editor container) and restore it to the editor once loadingFile is false; keep the loader inside the existing container rather than replacing it.",
      "evidence": "{loadingFile ? (<div ...><InlineLoader label={t('app.loadingFile')} /></div>) : (<>...editors...</>)}",
      "foundBy": [
        "live-region-controller"
      ]
    },
    {
      "rule": "LIVE-LOAD-001",
      "wcag": "4.1.3 AA",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/AppChrome.jsx:109",
      "summary": "InlineLoader ('Loading file...', 'Loading files...') has no status role, its spinner has no text alternative, and it is mounted together with its label, so loading is not announced.",
      "fix": "Render the loader inside a region that already exists: <div role=\"status\" aria-live=\"polite\">{loadingFile && t('app.loadingFile')}</div> in the editor pane (index.jsx:281), mark the spinner aria-hidden=\"true\", and set aria-busy={loadingFile} on the editor container. Announce completion briefly (e.g. '{{name}} loaded').",
      "evidence": "export const InlineLoader = ({label}) => (<div style=...><div style={{animation: 'osgi-config-manager-spin ...'}}/>{label && <Typography>{label}</Typography>}</div>);",
      "component": "InlineLoader",
      "foundBy": [
        "live-region-controller"
      ]
    },
    {
      "rule": "LIVE-LOAD-002",
      "wcag": "4.1.3 AA",
      "severity": "moderate",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/hooks/useOsgiConfigs.ts:397",
      "summary": "Saving has no in-progress state: nothing visible or announced between confirming the diff and the server reply, and Save stays enabled, so a screen reader user cannot tell a slow save from a lost click.",
      "fix": "Add a saving flag set before osgiService.save and cleared in finally; expose it to SelectedFileHeader to disable Save and show t('app.saving') ('Saving...') inside the editor pane's always-mounted role=\"status\" region.",
      "evidence": "try { await osgiService.save({...}); ... setLoadingFile(true); success(t('notification.saveSuccess'));",
      "foundBy": [
        "live-region-controller"
      ]
    },
    {
      "rule": "LIVE-LOAD-003",
      "wcag": "4.1.3 AA",
      "severity": "moderate",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/index.jsx:235",
      "summary": "The file-list loading indicator is only rendered in the empty state; with a file open, Refresh and deep search (useOsgiConfigs.ts:224-238) reload the list with no visible or announced progress or completion.",
      "fix": "Expose loadingFiles to FileSidebar, set aria-busy={loadingFiles} on the list container, and update the sidebar's always-mounted role=\"status\" region: t('app.loadingFiles') while loading, then the result count (see LIVE-FILTER-001). After Refresh, announce t('notification.refreshed').",
      "evidence": "{!selectedFile ? (<div ...>{loadingFiles && <InlineLoader label={t('app.loadingFiles')} />}</div>) : (...)}",
      "component": "FileSidebar",
      "foundBy": [
        "live-region-controller"
      ]
    },
    {
      "rule": "LIVE-RAW-001",
      "wcag": "n/a",
      "severity": "moderate",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:1257",
      "summary": "Encrypt and Decrypt in the raw editor rewrite the current line without any confirmation, so a screen reader user on the toolbar button cannot tell the value was encrypted or decrypted (failures do raise a toast).",
      "fix": "After editor.executeEdits succeeds, call a polite announcement through the toast region or a raw-editor role=\"status\" region: t('notification.encryptedLine', {line: position.lineNumber}) / t('notification.decryptedLine', {...}). Never put the value itself in the announcement.",
      "evidence": "editor.executeEdits('source', [{ range, text: result.encryptedValue }]);  // no success feedback; same at line 1311 for decrypt",
      "component": "MonacoEditor",
      "foundBy": [
        "live-region-controller"
      ]
    },
    {
      "rule": "LIVE-TOAST-004",
      "wcag": "4.1.3 AA",
      "severity": "moderate",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/hooks/useToast.tsx:24",
      "summary": "The toast has a single slot and each notify() replaces the previous one; after a save, the success toast can be overwritten by the undecryptable-values warning raised by the reload before it is read.",
      "fix": "Keep a short queue (array state) and render each message as its own child of the live region, removing each when it expires or is dismissed; or concatenate pending messages. Avoid clearing a message that is less than ~1 s old.",
      "evidence": "useOsgiConfigs.ts:408 success(saveSuccess) -> :442 fetchFileContent -> :194 warnAboutUndecryptedValues -> toastWarning(...) clears the timer and replaces the toast",
      "component": "ToastProvider",
      "foundBy": [
        "live-region-controller"
      ]
    },
    {
      "rule": "LIVE-TOAST-006",
      "wcag": "4.1.3 AA",
      "severity": "moderate",
      "confidence": "low",
      "location": "src/javascript/osgiConfigManager/App/hooks/useFileActions.ts:190",
      "summary": "When loading templates fails, the error toast fires and the fallback modal opens in the same tick; if the Moonstone Modal hides content outside itself (aria-hidden/inert), the toast is unreachable and unannounced.",
      "fix": "Show the failure inside the fallback modal (prefix its message with the error) instead of, or in addition to, the toast; or render the toast region via portal inside the open modal. Verify at runtime whether Moonstone Modal sets aria-hidden on siblings.",
      "evidence": "toastError(t('modal.error.create', { error: e.message })); setModalConfig({ type: 'prompt', ... });",
      "foundBy": [
        "live-region-controller"
      ]
    },
    {
      "rule": "MODAL-CONFIRM-NOT-ALERTDIALOG",
      "wcag": "4.1.2 A",
      "severity": "moderate",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/components/Dialogs.jsx:272",
      "summary": "Delete, disable, discard-changes, overwrite and error dialogs render as role=dialog with the message not referenced by aria-describedby, so they are not announced as alerts and the question is not exposed as the description.",
      "fix": "When config.type is 'confirm' or 'alert' (or isWarning), pass role=\"alertdialog\" and aria-describedby={messageId} to <Modal>; render config.message in an element with that id (ModalHeader children or ModalBody).",
      "evidence": "<Modal data-cy=\"modal-dialog\" isOpen size=... onOpenChange=...>  // no role, aria-labelledby or aria-describedby override",
      "component": "ModalDialog",
      "foundBy": [
        "modal-specialist"
      ]
    },
    {
      "rule": "MODAL-DESTRUCTIVE-WORDING",
      "wcag": "2.4.6 AA",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/hooks/useFileActions.ts:73",
      "summary": "The delete-file confirmation sets no confirmLabel/cancelLabel, so its danger-coloured button reads 'OK', and the message ('Are you sure you want to delete {{name}}?') does not say the deletion cannot be undone.",
      "fix": "Set confirmLabel: t('modal.deleteFile.confirm') = 'Delete' (or 'Delete configuration') and cancelLabel: t('modal.cancel'), add the keys to every locale, and extend modal.deleteFile.message with 'This cannot be undone.'",
      "evidence": "setModalConfig({ type: 'confirm', severity: 'warning', title: t('modal.deleteFile.title'), message: t('modal.deleteFile.message', { name: f.name }), onConfirm: ... })  // footer falls back to t('modal.ok')",
      "component": "ModalDialog / delete file",
      "foundBy": [
        "modal-specialist"
      ]
    },
    {
      "rule": "MODAL-FILTER-COUNT-NOT-ANNOUNCED",
      "wcag": "4.1.3 AA",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/CfgMetatypePropertyDialog.jsx:146",
      "summary": "Typing in the property search (and in the Create dialog filter, Dialogs.jsx:353) filters the list with no announced result count, so screen reader users do not know whether anything matched.",
      "fix": "Add a polite live region (role=\"status\") in each dialog announcing e.g. t('...resultCount', {count: filteredProperties.length}), debounced; give the result list an accessible name.",
      "evidence": "{filteredProperties.map(property => (<button ...>))}  // no count, no live region",
      "component": "CfgMetatypePropertyDialog / ModalDialog",
      "foundBy": [
        "modal-specialist"
      ]
    },
    {
      "rule": "MODAL-FOCUS-LOST-AFTER-DELETE",
      "wcag": "2.4.3 A",
      "severity": "moderate",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/hooks/useFileActions.ts:81",
      "summary": "After a confirmed delete, focus returns to the toolbar Delete button, then selectFile(null) unmounts the toolbar, so keyboard and screen reader focus drops to <body>.",
      "fix": "After a successful delete, move focus explicitly to a stable target, e.g. the file list/search field in FileSidebar or the sidebar heading (tabindex=-1), once fetchFiles resolves; the success toast covers the announcement.",
      "evidence": "if (selectedFile?.name === f.name) { selectFile(null); }  // trigger: SelectedFileToolbar.jsx:91-99 delete-file-button",
      "component": "Delete file flow",
      "foundBy": [
        "modal-specialist"
      ]
    },
    {
      "rule": "MODAL-FOCUS-LOST-AFTER-SAVE",
      "wcag": "2.4.3 A",
      "severity": "moderate",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/hooks/useOsgiConfigs.ts:389",
      "summary": "Confirming the diff returns focus to the header Save button, which becomes disabled once the save clears hasUnsaved (SelectedFileHeader.jsx:25), so the browser drops focus to <body>.",
      "fix": "Keep the Save button focusable after saving (aria-disabled instead of the disabled attribute), or after a successful save move focus to a stable element such as the editor or the file title (tabindex=-1).",
      "evidence": "onConfirm: () => { setDiffConfig(prev => ({ ...prev, isOpen: false })); void handleSaveRef.current?.(confirmedContent); }",
      "component": "DiffModal / save flow",
      "foundBy": [
        "modal-specialist"
      ]
    },
    {
      "rule": "MODAL-INPUT-NO-LABEL",
      "wcag": "1.3.1 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/Dialogs.jsx:301",
      "summary": "Dialog text fields have only a placeholder; the visible captions above them are unassociated <p> elements, here and at Dialogs.jsx:337, :353, :445 and CfgMetatypePropertyDialog.jsx:118.",
      "fix": "Give each Input an id and associate the visible caption (<label htmlFor> or aria-labelledby pointing at the caption's id); for the prompt input use the dialog message or title. Moonstone Input passes aria-label/aria-labelledby through to the <input>.",
      "evidence": "<Input data-cy=\"modal-prompt-input\" autoFocus value={promptValue} ... placeholder={t('modal.prompt.placeholder')} />",
      "component": "ModalDialog / CfgMetatypePropertyDialog",
      "foundBy": [
        "modal-specialist"
      ]
    },
    {
      "rule": "MODAL-METATYPE-TOOLTIP-NOT-FOCUSABLE",
      "wcag": "2.1.1 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:695",
      "summary": "The Metatype documentation popover for a property opens only on hover over a non-focusable 'i' div, so keyboard users cannot open it and screen readers read a bare 'i'.",
      "fix": "Make the trigger a <button type=\"button\" aria-label={t('...propertyInfo', {name: key})}> with aria-describedby or a toggletip/popover that opens on focus and click and closes on Escape; mark the 'i' glyph aria-hidden.",
      "evidence": "<Tooltip label={<CfgMetatypeInfoTooltip .../>}><div data-cy={`cfg-metatype-info-${index}`} style={{cursor: 'help', ...}}>i</div></Tooltip>",
      "component": "CfgEditor metatype info tooltip",
      "foundBy": [
        "modal-specialist"
      ]
    },
    {
      "rule": "NONTEXT-CONTRAST-002",
      "wcag": "1.4.11 AA",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/hooks/useToast.tsx:50",
      "summary": "Toast type icons and left borders fall below 3:1 on the white toast: warning #fb0 1.70:1, success #6abb6d 2.35:1, info #00a0e3 2.94:1 (error #f44053 3.68:1 passes).",
      "fix": "Use darker variants for icon and border colours (e.g. warning #a36b00, success #2e7d32, info var(--color-accent_dark) #0072b1), each at least 3:1 on #fff.",
      "evidence": "borderLeft: `4px solid ${toastMeta?.borderColor}`; icon colours var(--color-warning|success|accent)",
      "component": "ToastProvider",
      "foundBy": [
        "contrast-master"
      ]
    },
    {
      "rule": "REFLOW-003",
      "wcag": "1.4.10 AA",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:163",
      "summary": "File names, the selected file heading and its path are truncated with an ellipsis; the full text appears only in a mouse-hover preview (none for the heading), so at 320 CSS px or with text spacing keyboard and touch users lose the names.",
      "fix": "Allow wrapping (overflow-wrap: anywhere, no isNowrap) in the sidebar and in SelectedFileHeader.jsx:31-44, or show the preview on focus too; also remove whiteSpace: 'nowrap' from FLOATING_TOOLTIP_STYLE (AppChrome.jsx:78) and cap it at calc(100vw - 32px).",
      "evidence": "OverflowPreviewText: isNowrap + textOverflow: 'ellipsis', preview on onMouseEnter only; heading uses showPreview={false}",
      "component": "OverflowPreviewText",
      "foundBy": [
        "contrast-master"
      ]
    },
    {
      "rule": "REFLOW-004",
      "wcag": "1.4.10 AA",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:79",
      "summary": "The metatype property panel is a fixed 340px non-shrinking column beside the raw editor in a non-wrapping flex row, squeezing the editor to zero width on narrow viewports.",
      "fix": "Let RAW_EDITOR_SURFACE_STYLE wrap (flexWrap: 'wrap') or stack below ~768px, and give the panel flex: '1 1 340px', maxWidth: '100%'.",
      "evidence": "RAW_EDITOR_PANEL_STYLE { flex: '0 0 340px', width: '340px' }",
      "component": "MonacoEditor",
      "foundBy": [
        "contrast-master"
      ]
    },
    {
      "rule": "REFLOW-005",
      "wcag": "1.4.10 AA",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/CfgMetatypePropertyDialog.jsx:117",
      "summary": "At 400% zoom the property picker body (overflow: hidden) shrinks inside the max-height dialog and clips the 'custom property' section and its button with no way to scroll to them.",
      "fix": "Set overflow: 'auto' and minHeight: 0 on the body section and let the inner list use flex: '1 1 auto' instead of a fixed maxHeight: 360px.",
      "evidence": "Paper maxHeight: calc(100vh - 60px), overflow hidden; body div overflow: 'hidden'; list maxHeight: '360px'",
      "component": "CfgMetatypePropertyDialog",
      "foundBy": [
        "contrast-master"
      ]
    },
    {
      "rule": "RT-AXE-CONTRAST-MOONSTONE",
      "wcag": "1.4.3 AA",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:137",
      "summary": "Moonstone colours used by the module fail 4.5:1: selected file row (2.89:1), Delete button (3.68:1), outlined Add Property (2.94:1), Create-dialog tabs (2.89 and 3.95:1).",
      "fix": "Override these within the module (darker accent #0072b1 for the selected row and outlined buttons, #c62828 for danger) and raise a Moonstone token issue.",
      "evidence": "axe color-contrast nodes: sidebar-file-name (bold 14px), .moonstone-button_danger, .moonstone-button_outlined_accent, .moonstone-tabItem_selected",
      "component": "Moonstone theme",
      "foundBy": [
        "playwright-scanner"
      ]
    },
    {
      "rule": "RT-FOCUS-PROMPT-LOST",
      "wcag": "2.4.3 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/Dialogs.jsx:301",
      "summary": "Closing the Add Property prompt with Escape drops focus to <body> instead of returning it to the Add Property button; the prompt input is named only 'Type here...'.",
      "fix": "Return focus to the trigger when the prompt closes (it is unmounted-and-remounted, so keep a ref to the trigger), and name the input with the prompt's question.",
      "evidence": "activeElement after Escape: BODY; prompt input accessible name from placeholder 'Type here...'",
      "component": "ModalDialog prompt",
      "foundBy": [
        "playwright-scanner"
      ]
    },
    {
      "rule": "RT-FOCUS-RING-CONTRAST",
      "wcag": "1.4.11 AA",
      "severity": "moderate",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/components/AppHeaderBar.jsx:37",
      "summary": "The focus ring on Moonstone buttons, search fields and switch is a 2px #63d1ff outline, about 1.7:1 against the white panels, so focus is hard to see.",
      "fix": "Override the focus ring inside the module (e.g. .osgi-config-manager :focus-visible { outline: 2px solid var(--color-accent_dark) }, #0072b1 = 5.2:1) and report the token to the Moonstone team.",
      "evidence": "computed outline on New/Import/Refresh/Cancel: solid 2px rgb(99, 209, 255); focus-search.png, focus-switch.png",
      "component": "Moonstone focus ring",
      "foundBy": [
        "playwright-scanner"
      ]
    },
    {
      "rule": "SEM-LIST-001",
      "wcag": "1.3.1 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:134",
      "summary": "The configuration file list is marked up as a headerless data table (Moonstone Table/TableRow/TableBodyCell) instead of a list, so AT announces a 2-column table with no headers rather than a list of N files.",
      "fix": "Render <ul aria-labelledby=\"<sidebar heading id>\"> with one <li> per file, each containing a <button type=\"button\"> (see SEM-LIST-002). Keep Moonstone styling via classes or switch to Moonstone ListItem if it fits.",
      "evidence": "<Table ...><TableBody>{processedFiles.map(f => <TableRow ...><TableBodyCell>status bar</TableBodyCell><TableBodyCell>name + badge</TableBodyCell>",
      "component": "FileSidebar",
      "foundBy": [
        "alt-text-headings"
      ]
    },
    {
      "rule": "SEM-LIST-003",
      "wcag": "4.1.2 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:129",
      "summary": "The file-list scroll container is a focusable div (tabIndex 0) that handles ArrowUp/ArrowDown but has no role or accessible name, so focusing it announces nothing.",
      "fix": "If the arrow-key behaviour is kept, give this element role=\"listbox\" and aria-label/aria-labelledby (sidebar heading) and wire aria-activedescendant to the selected option; otherwise remove tabIndex and onKeyDown and rely on the per-file buttons. Its outline:'none' also hides focus (focus specialist).",
      "evidence": "<div style={{ flex: 1, overflowY: 'auto', outline: 'none' }} tabIndex={0} onKeyDown={handleKeyDown}>",
      "component": "FileSidebar",
      "foundBy": [
        "alt-text-headings",
        "aria-specialist"
      ],
      "alsoReportedAs": [
        "ARIA-NAME-003"
      ]
    },
    {
      "rule": "SEM-TABLE-001",
      "wcag": "1.3.1 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:181",
      "summary": "The .cfg visual editor's header row uses TableBodyCell (<td>) inside <thead> instead of header cells, and three header cells are empty, so inputs, checkboxes and buttons in rows get no column context.",
      "fix": "Use Moonstone TableHeadCell (renders <th>) with scope=\"col\" for every header cell, and give the drag, type and actions columns visually hidden text (e.g. 'Reorder', 'Type', 'Actions'). Same pattern in Editor.jsx:328 if that editor is kept.",
      "evidence": "<thead><TableRow><TableBodyCell style={…drag}></TableBodyCell><TableBodyCell style={…type}></TableBodyCell><TableBodyCell data-cy=\"cfg-header-property\">…",
      "component": "CfgEditorHeader",
      "foundBy": [
        "alt-text-headings",
        "forms-specialist",
        "tables-data-specialist"
      ],
      "alsoReportedAs": [
        "FORM-LABEL-004",
        "TABLE-EMPTY-HEADER"
      ]
    },
    {
      "rule": "SEM-TABLE-002",
      "wcag": "2.4.3 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:583",
      "summary": "Every .cfg row is an extra unnamed tab stop: Moonstone TableRow sets tabIndex 0 on the <tr>, and the module only uses it for an onClick that selects the row.",
      "fix": "Pass tabIndex={-1} to TableRow here (props spread after Moonstone's default) so focus goes straight to the row's controls; selection already follows focus through handleInputFocus.",
      "evidence": "<TableRow key={index} data-cy={`cfg-row-${index}`} … onClick={() => handleRowClick(index)}>",
      "component": "CfgEditor",
      "foundBy": [
        "alt-text-headings",
        "tables-data-specialist"
      ],
      "alsoReportedAs": [
        "TABLE-ROW-TABSTOP"
      ]
    },
    {
      "rule": "SEM-TABS-001",
      "wcag": "4.1.2 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/Dialogs.jsx:319",
      "summary": "The Create dialog uses Moonstone Tab/TabItem (role tablist/tab, aria-selected) but the content below is not a tabpanel: no role=\"tabpanel\", aria-controls or aria-labelledby, and the tablist has no name.",
      "fix": "Give each TabItem an id and aria-controls, wrap the active tab's content (Dialogs.jsx:332-497) in <div role=\"tabpanel\" id=… aria-labelledby={tabId}>, and add aria-label (e.g. the dialog title) to <Tab>.",
      "evidence": "<Tab>{createTabs.map(tab => <TabItem key={tab.id} isSelected={…} label={tab.label} onClick={…}/>)}</Tab> followed by plain <div style={SECTION_STYLE}>",
      "component": "ModalDialog",
      "foundBy": [
        "alt-text-headings",
        "aria-specialist",
        "modal-specialist"
      ],
      "alsoReportedAs": [
        "ARIA-TABS-019",
        "MODAL-TABS-NO-PANEL"
      ]
    },
    {
      "rule": "TABLE-CAPTION",
      "wcag": "1.3.1 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:545",
      "summary": "The .cfg properties table has no <caption>, aria-label or aria-labelledby, so screen readers announce an unnamed table.",
      "fix": "Name the table after the file: <Table aria-label={t('editor.table.label', {name: filename})}> or a visually hidden <caption> as the first child (CfgEditor needs the filename prop, available in index.jsx as selectedFile.name).",
      "evidence": "<Table style={{ width: '100%' }}><CfgEditorHeader t={t} />",
      "component": "CfgEditor",
      "foundBy": [
        "tables-data-specialist"
      ]
    },
    {
      "rule": "TABLE-CAPTION",
      "wcag": "1.3.1 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/Editor.jsx:325",
      "summary": "The YAML properties table has no <caption> or accessible name.",
      "fix": "Add a visually hidden <caption> or aria-label naming the file, e.g. 'Properties of {{name}}', as for CfgEditor.",
      "evidence": "<Table style={{ width: '100%' }}><thead>...",
      "component": "ConfigEditor",
      "foundBy": [
        "tables-data-specialist"
      ]
    },
    {
      "rule": "TEXT-SPACING-001",
      "wcag": "1.4.12 AA",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:218",
      "summary": "AutoResizeTextArea recomputes its height only when its value changes and has overflow: hidden, so wrapping added by user text spacing, zoom or a narrower viewport clips the text.",
      "fix": "Also resize on width/font changes: observe the textarea with a ResizeObserver (and on window resize), or drop JS sizing for CSS field-sizing: content with overflow: auto as fallback.",
      "evidence": "useEffect(() => { resize(); }, [value]); style { overflow: 'hidden', ... }",
      "component": "AutoResizeTextArea",
      "foundBy": [
        "contrast-master"
      ]
    },
    {
      "rule": "TREE-HIERARCHY",
      "wcag": "1.3.1 A",
      "severity": "moderate",
      "location": "src/javascript/osgiConfigManager/App/components/Editor.jsx:65",
      "summary": "The nesting of YAML keys is shown only by left padding (level * 20px), a blue left border and backgrounds; a screen reader reads a flat list of rows where 'port' under two parents is indistinguishable.",
      "fix": "Simplest: make the key cell a row header (th scope=\"row\") holding a visually hidden parent path, e.g. 'server › http › ' before the key. Full option: role=\"treegrid\" with aria-level, aria-expanded and aria-posinset/setsize, which also requires grid keyboard navigation; prefer the simple option.",
      "evidence": "paddingLeft: `${level * 20 + 20}px` (LeafRow) / paddingLeft: `${level * 20 + 10}px`, borderLeft: level > 0 ? '4px solid #007cb0' : 'none' (ContainerRow, line 164)",
      "component": "ConfigEditor",
      "foundBy": [
        "tables-data-specialist"
      ]
    },
    {
      "rule": "ARIA-HOVER-041",
      "wcag": "1.4.13 AA",
      "severity": "minor",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/components/AppChrome.jsx:216",
      "summary": "The full-text previews for truncated names and values appear on mouse hover only, with pointer-events: none (cannot be hovered) and no Escape dismissal; keyboard users never see them.",
      "fix": "Also show the preview on focus of the focusable ancestor, drop pointerEvents:'none' or keep it open while hovered, close on Escape, and mark it role=\"tooltip\" referenced by aria-describedby. Same pattern in CfgEditor.jsx:507 and Editor.jsx:291.",
      "evidence": "onMouseEnter={showPreviewIfNeeded} onMouseLeave={hidePreview} ... FLOATING_TOOLTIP_STYLE = {..., pointerEvents: 'none'}",
      "component": "OverflowPreviewText",
      "foundBy": [
        "aria-specialist"
      ]
    },
    {
      "rule": "ARIA-NAME-021",
      "wcag": "2.4.6 AA",
      "severity": "minor",
      "location": "src/javascript/osgiConfigManager/App/components/Dialogs.jsx:286",
      "summary": "The icon-only close button of ModalDialog is labelled 'Cancel', the same name as the footer Cancel button, so two controls share one name while the icon reads as 'close'.",
      "fix": "aria-label={t('modal.close')} (add the key to every locale) and keep the footer button as Cancel.",
      "evidence": "<Button aria-label={t('modal.cancel')} icon={<Close/>} size=\"small\" variant=\"ghost\" onClick={onClose}/>",
      "component": "ModalDialog",
      "foundBy": [
        "aria-specialist"
      ]
    },
    {
      "rule": "ARIA-NAME-024",
      "wcag": "4.1.2 A",
      "severity": "minor",
      "location": "src/javascript/osgiConfigManager/App/components/DiffModal.tsx:90",
      "summary": "The dialog name is a copy of the visible title passed as aria-label instead of a reference to it, and the title itself renders as a <p>; the two can drift apart and the title is not a heading.",
      "fix": "Render the title as a heading with an id and reference it: <Typography id=\"diff-modal-title\" component=\"h2\" …> and aria-labelledby=\"diff-modal-title\" on the role=\"dialog\" element.",
      "evidence": "role=\"dialog\" aria-modal=\"true\" aria-label={t('modal.diff.title', { name: filename })} ... <Typography variant=\"heading\" weight=\"bold\">",
      "component": "DiffModal",
      "foundBy": [
        "aria-specialist"
      ]
    },
    {
      "rule": "ARIA-NAME-040",
      "wcag": "2.4.6 AA",
      "severity": "minor",
      "location": "src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:1535",
      "summary": "Every property card has an 'Insert' (or 'Already present') button with the same name, so in a buttons list screen reader users cannot tell which property each one inserts.",
      "fix": "aria-label={t('editor.metatype.insertNamed', {name: property.id})} (and the 'already present' variant), keeping the visible 'Insert' text at the start of the name (2.5.3).",
      "evidence": "<Button data-cy={`metatype-property-insert-...`} label={alreadyPresent ? t('editor.metatype.alreadyPresent') : t('editor.metatype.insert')} />",
      "component": "MonacoEditor",
      "foundBy": [
        "aria-specialist"
      ]
    },
    {
      "rule": "ARIA-STATE-035",
      "wcag": "1.3.1 A",
      "severity": "minor",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:573",
      "summary": "The selected row, which decides where 'Add property/comment/empty line' inserts, is shown only by a background colour, so screen reader users cannot tell where new entries will go.",
      "fix": "Expose the current row: aria-current=\"true\" on the selected TableRow (or aria-selected inside a grid), and include the insertion point in the add buttons' description, e.g. aria-describedby to 'Inserted after line {n}'.",
      "evidence": "backgroundColor: isSelected ? CHROME_TOKENS.selectionColor : 'transparent' ... onClick={() => handleRowClick(index)}",
      "component": "CfgEditor",
      "foundBy": [
        "aria-specialist"
      ]
    },
    {
      "rule": "COG-017",
      "wcag": "3.2.4 AA",
      "severity": "minor",
      "location": "src/javascript/osgiConfigManager/App/components/DiffModal.tsx:145",
      "summary": "The same close function is a named 'Cancel' button in ModalDialog but an unnamed clickable icon in the review and Add Property dialogs, and the X icon also deletes rows in the .cfg editor while file delete uses a trash icon.",
      "fix": "Use one Close button (Moonstone Button, icon Close, aria-label 'Close') in all three dialogs, and use the Delete icon with label 'Delete property' for row deletion (CfgEditor.jsx:792-803).",
      "confidence": "medium",
      "evidence": "Dialogs.jsx:285-291 Button aria-label={t('modal.cancel')}; DiffModal.tsx:145-150 and CfgMetatypePropertyDialog.jsx:112-114 <div onClick={onClose}><Close/></div>; CfgEditor.jsx:794 icon={<Close/>} for delete.",
      "component": "Dialogs",
      "foundBy": [
        "cognitive-accessibility"
      ]
    },
    {
      "rule": "COG-018",
      "wcag": "n/a",
      "severity": "minor",
      "location": "src/main/resources/javascript/locales/en.json:6",
      "summary": "Terms vary for one thing: 'Import' button vs 'Upload' in its tooltip, toast and rename dialog; menu label 'OSGi Config Manager' vs title 'OSGi Configurations Manager'; and 'Add Property' names two different actions.",
      "fix": "Pick one verb (for example 'Import') for app.import, tooltip.uploadFile, notification.uploadSuccess and modal.rename.title; align label with app.title; and name the raw editor's button 'Browse Metatype properties'.",
      "evidence": "en.json:2 'OSGi Config Manager', :4 'OSGi Configurations Manager', :6 'Import', :25 'Uploaded {{name}}', :116 'Rename uploaded file', :232 'Upload configuration file'; :134-135 both 'Add Property'.",
      "foundBy": [
        "cognitive-accessibility"
      ]
    },
    {
      "rule": "COG-019",
      "wcag": "2.4.6 AA",
      "severity": "minor",
      "location": "src/main/resources/javascript/locales/en.json:138",
      "summary": "Some English labels do not say what they act on or set: 'Hide' (Metatype panel), 'Toggle Comments' and 'Toggle Empty Lines' (state shown only by an eye icon), 'Type here...', and 'Format YAML code' also on .cfg files.",
      "fix": "Use 'Hide available properties', 'Show comments'/'Hide comments' and 'Show empty lines'/'Hide empty lines' (with aria-pressed), a specific placeholder or none, and tooltip 'Format the file'.",
      "evidence": "en.json:138 'Hide', :146-147 'Toggle Comments' / 'Toggle Empty Lines', :120 'Type here...', :247 'Format YAML code'; CfgEditor.jsx:157-172 icon={showComments ? <Visibility/> : <Hidden/>}.",
      "foundBy": [
        "cognitive-accessibility"
      ]
    },
    {
      "rule": "COG-020",
      "wcag": "n/a",
      "severity": "minor",
      "location": "src/javascript/osgiConfigManager/App/hooks/useOsgiConfigs.ts:447",
      "summary": "Error messages name the operation and append raw server text but do not suggest a next step; a failed Save shows the bare server message, and 'Toggled status for {{name}}' does not say whether the file is now enabled or disabled.",
      "fix": "Use the 'Error saving: {{error}}' key on the Save path, add a recovery hint (e.g. 'Your changes are still in the editor. Try again or download the file.'), and split the toggle toast into '{{name}} enabled' / '{{name}} disabled'.",
      "evidence": "toastError(e.message); en.json:21 'Toggled status for {{name}}'; en.json:98-102 'Error saving: {{error}}' etc.",
      "foundBy": [
        "cognitive-accessibility"
      ]
    },
    {
      "rule": "COG-021",
      "wcag": "n/a",
      "severity": "minor",
      "location": "src/javascript/osgiConfigManager/App/hooks/useOsgiConfigs.ts:660",
      "summary": "Deleting a comment or empty line asks 'Are you sure you want to delete Add Comment?' (or 'Add Empty Line') because the button labels are reused as the item's name.",
      "fix": "Use dedicated strings, e.g. 'Delete this comment?' and 'Delete this empty line?', instead of editor.button.addComment / addEmptyLine.",
      "evidence": "displayName = t('editor.button.addComment') / t('editor.button.addEmptyLine'); message t('modal.deleteProp.message', {name: displayName}).",
      "foundBy": [
        "cognitive-accessibility"
      ]
    },
    {
      "rule": "COG-022",
      "wcag": "n/a",
      "severity": "minor",
      "location": "src/javascript/osgiConfigManager/App/hooks/useOsgiConfigs.ts:346",
      "summary": "The duplicate-keys alert shows two buttons, 'Cancel' and 'OK', that do the same thing, which suggests a choice that does not exist.",
      "fix": "Pass confirmLabel: null and cancelLabel: t('modal.ok') as the other error alerts do (useOsgiConfigs.ts:316-323).",
      "evidence": "setModalConfig({type: 'alert', title, message}); Dialogs.jsx:503-524 renders cancelLabel || 'Cancel' and confirmLabel || 'OK'.",
      "foundBy": [
        "cognitive-accessibility"
      ]
    },
    {
      "rule": "COG-023",
      "wcag": "3.3.2 A",
      "severity": "minor",
      "location": "src/javascript/osgiConfigManager/App/components/SelectedFileHeader.jsx:82",
      "summary": "Save is disabled while the YAML or raw content is invalid, and 'Mark as Default' is disabled for module files, with no text near the button saying why; the 'invalid YAML' explanation in handleSave cannot be reached.",
      "fix": "Show an inline message beside Save when the content is invalid ('Fix the errors marked in the editor to save') and a reason under Mark as Default when it is unavailable, instead of relying on tooltips on disabled buttons.",
      "confidence": "medium",
      "evidence": "disabled={isSaveDisabled} with isSaveDisabled = !hasUnsaved || ((isRawMode || isYamlFile) && !isYamlValid); SelectedFileToolbar.jsx:82 disabled={!canMarkAsDefault}; useOsgiConfigs.ts:315-325.",
      "component": "SelectedFileHeader",
      "foundBy": [
        "cognitive-accessibility"
      ]
    },
    {
      "rule": "COG-024",
      "wcag": "n/a",
      "severity": "minor",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:614",
      "summary": "Keyboard reordering stays active while the filter is on or comments and empty lines are hidden, so Arrow Up/Down swaps the row with a hidden one: the visible row seems not to move while hidden lines are reordered.",
      "fix": "Disable the reorder handle while filtering (as the drag zone already is), and when rows are hidden move the entry past the previous or next visible row.",
      "confidence": "medium",
      "evidence": "onKeyDown: if (e.key === 'ArrowUp' && index > 0) handleReorder(index, index - 1); there is no check for 'filtering', showComments or showEmptyLines.",
      "component": "CfgEditor",
      "foundBy": [
        "cognitive-accessibility"
      ]
    },
    {
      "rule": "CONTRAST-TEXT-010",
      "wcag": "1.4.3 AA",
      "severity": "minor",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/components/Editor.jsx:120",
      "summary": "The '(empty)' placeholder in the generic ConfigEditor is #ccc italic, 1.61:1 on white.",
      "fix": "Use #6b6b6b or darker (at least 4.5:1). Editor.jsx is only rendered for files whose extension is not exactly lower-case .cfg/.yml, hence minor.",
      "evidence": "<span style={{ color: '#ccc', fontStyle: 'italic' }}>",
      "component": "ConfigEditor",
      "foundBy": [
        "contrast-master"
      ]
    },
    {
      "rule": "DATA-LIST-AS-TABLE",
      "wcag": "1.3.1 A",
      "severity": "minor",
      "location": "src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:134",
      "summary": "The file list is a one-dimensional list drawn as a two-column <table> with no headers or caption; the first column holds only a colour bar, so table navigation adds noise and Chromium may expose it as a layout table.",
      "fix": "Use list or listbox semantics instead of a table (see link-checker LINK-CONTROL-ELEMENT at FileSidebar.jsx:137): <ul aria-label={t('app.fileListLabel')}> with one item per file, or role=\"listbox\". 1.3.1 does not require table semantics here.",
      "evidence": "<Table style={{ width: '100%', tableLayout: 'fixed' }}><TableBody>{processedFiles.map(f => (<TableRow ...><TableBodyCell className=\"osgi-sidebar-status-cell\" width=\"12px\">",
      "component": "FileSidebar",
      "foundBy": [
        "tables-data-specialist"
      ]
    },
    {
      "rule": "DATA-LIST-SEMANTICS",
      "wcag": "1.3.1 A",
      "severity": "minor",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:1496",
      "summary": "Collections of property and template cards are bare divs (here, CfgMetatypePropertyDialog.jsx:146 and Dialogs.jsx:369/409), so screen readers do not announce a list or the number of items.",
      "fix": "Wrap each collection in <ul role=\"list\"> with one <li> per card (role=\"list\" keeps semantics when list-style is none in Safari), keeping the button or radio inside each item.",
      "evidence": "{filteredProperties.map(property => (<div data-cy={`metatype-property-card-...`} key={property.id} style={{ border: ..., borderRadius: '6px', ... }}>",
      "component": "MonacoEditor property panel, CfgMetatypePropertyDialog, Dialogs",
      "foundBy": [
        "tables-data-specialist"
      ]
    },
    {
      "rule": "FORM-REDUNDANT-001",
      "wcag": "3.3.7 A",
      "severity": "minor",
      "location": "src/javascript/osgiConfigManager/App/components/Dialogs.jsx:389",
      "summary": "Clicking a Metatype or factory option clears the filename already typed in the Manual tab, so a user who looks at the other tabs and comes back must type it again.",
      "fix": "Do not reset manualFilename when a Metatype or factory option is picked. The active tab already decides which payload is sent (handleConfirm), so the manual value can safely stay.",
      "evidence": "onClick={() => { setSelectedPid(definition.pid); setManualFilename(''); }}  (also line 429)",
      "component": "ModalDialog createConfig",
      "foundBy": [
        "forms-specialist"
      ]
    },
    {
      "rule": "FORM-SEARCH-004",
      "wcag": "3.3.2 A",
      "severity": "minor",
      "location": "src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:1471",
      "summary": "The raw editor's 'Available properties' search input is labelled only by the placeholder 'Filter properties...', and the 'no results' text is not announced.",
      "fix": "Add aria-label (or a <label> linked to an id) to the Input, and put the result count and the no-results message in an always-present role=\"status\" region.",
      "evidence": "<Input data-cy=\"raw-editor-property-search\" ... placeholder={t('editor.metatype.searchPlaceholder')} style={RAW_EDITOR_SEARCH_STYLE}/>",
      "component": "MonacoEditor property panel",
      "foundBy": [
        "forms-specialist"
      ]
    },
    {
      "rule": "HEAD-002",
      "wcag": "1.3.1 A",
      "severity": "minor",
      "location": "src/javascript/osgiConfigManager/App/components/DiffModal.tsx:131",
      "summary": "Visual headings in the dialogs and side panel are plain <p> (Typography variant heading/subheading without component), and the custom dialogs repeat their title in aria-label instead of referencing a heading.",
      "fix": "DiffModal.tsx:131 and CfgMetatypePropertyDialog.jsx:109: component=\"h2\" with an id, and aria-labelledby on the role=dialog in place of aria-label. CfgMetatypePropertyDialog.jsx:207 and MonacoEditor.jsx:1450: component=\"h3\". Dialogs.jsx:334/350 are field captions: make them <label htmlFor>; Dialogs.jsx:365/405 head option lists: the <legend> of the radio group (SEM-DIV-BUTTON-001).",
      "evidence": "<Typography variant=\"heading\" weight=\"bold\" …>{t('modal.diff.title', …)}</Typography> renders <p class=\"moonstone-variant_heading\">",
      "component": "DiffModal / CfgMetatypePropertyDialog / Dialogs / MonacoEditor",
      "foundBy": [
        "alt-text-headings",
        "modal-specialist"
      ],
      "alsoReportedAs": [
        "MODAL-HEADING-SEMANTICS"
      ]
    },
    {
      "rule": "IMG-ICON-003",
      "wcag": "1.1.1 A",
      "severity": "minor",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/components/AppChrome.jsx:128",
      "summary": "Decorative Moonstone SVG icons placed outside a named control are not hidden from AT (Moonstone renders <svg> with no aria-hidden or focusable=false), so some screen readers announce an unnamed graphic.",
      "fix": "Pass aria-hidden=\"true\" focusable=\"false\" to the icon (SvgWrapper spreads props onto the <svg>): StatusBanner icon AppChrome.jsx:128, toast icons useToast.tsx:50/55/60/65, Chip icon ConfigStateBadge.jsx:30 when the label is shown, comment-row icon CfgEditor.jsx:630. Icons inside labelled buttons need nothing.",
      "evidence": "<Warning size=\"small\" style={{color: variant.iconColor, flexShrink: 0}}/> next to <Typography>{message}</Typography>",
      "component": "AppChrome / useToast / ConfigStateBadge / CfgEditor",
      "foundBy": [
        "alt-text-headings"
      ]
    },
    {
      "rule": "KBD-LIST-KEYS",
      "wcag": "n/a",
      "severity": "minor",
      "location": "src/javascript/osgiConfigManager/App/components/FileSidebar.jsx:77",
      "summary": "The file list supports only Arrow Up/Down, and selection follows focus: each arrow press loads the file and, with unsaved changes, opens the confirmation dialog, so Home/End and moving without loading are not possible.",
      "fix": "Add Home/End (and optionally type-ahead). Consider moving an active descendant on arrows and loading the file on Enter/Space, or debounce loading, so browsing past files with unsaved changes does not raise a dialog per keystroke.",
      "evidence": "if (e.key === 'ArrowDown') {... handleFileClick(processedFiles[nextIndex]); } else if (e.key === 'ArrowUp') {...}",
      "component": "FileSidebar",
      "foundBy": [
        "keyboard-navigator"
      ]
    },
    {
      "rule": "KBD-SCROLL-REGION",
      "wcag": "2.1.1 A",
      "severity": "minor",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/components/Dialogs.jsx:475",
      "summary": "The 'Existing instances' list of the factory tab scrolls (max-height 140px) but holds only static text and has no tabindex, so its overflow cannot be scrolled by keyboard in Safari.",
      "fix": "Add tabIndex={0} role=\"region\" aria-label={t('modal.create.existingInstances')} to the INSTANCES_LIST_STYLE container.",
      "evidence": "<div style={INSTANCES_LIST_STYLE}> (maxHeight: '140px', overflow: 'auto')",
      "component": "ModalDialog",
      "foundBy": [
        "keyboard-navigator"
      ]
    },
    {
      "rule": "KBD-TOOLTIP-NONFOCUSABLE",
      "wcag": "2.1.1 A",
      "severity": "minor",
      "location": "src/javascript/osgiConfigManager/App/components/ConfigStateBadge.jsx:48",
      "summary": "In the sidebar the compact (icon-only) state chip explains the configuration state only through a hover tooltip on a non-focusable Chip, so keyboard users cannot read the state of non-selected files.",
      "fix": "Expose the state as text in the row (visually hidden text or the row's accessible name) rather than relying on the tooltip; the full labelled badge in the header covers only the selected file.",
      "evidence": "<Tooltip label={t(config.tooltipKey)}>{chip}</Tooltip> with label '' when compact",
      "component": "ConfigStateBadge",
      "foundBy": [
        "keyboard-navigator"
      ]
    },
    {
      "rule": "LAND-002",
      "wcag": "4.1.2 A",
      "severity": "minor",
      "location": "src/javascript/osgiConfigManager/App/components/AppHeaderBar.jsx:37",
      "summary": "role=\"toolbar\" is declared with no accessible name and without the arrow-key roving focus the role promises; the three buttons are ordinary tab stops.",
      "fix": "Either remove the role (a plain div of buttons is valid), or keep it with aria-label={t('…toolbarLabel')} and implement roving tabindex with Left/Right arrows. Semantic HTML first: removing the role is the smaller change.",
      "evidence": "<div role=\"toolbar\" className=\"flexRow_between alignCenter moonstone-header_toolbar\">",
      "component": "AppHeaderBar",
      "foundBy": [
        "alt-text-headings"
      ]
    },
    {
      "rule": "LINK-NEW-WINDOW",
      "wcag": "3.2.5 AAA",
      "severity": "minor",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:742",
      "summary": "The raw editor leaves Monaco's link detection on (links defaults to true), so URLs inside configuration values become Ctrl/Cmd+click links that open a new window without warning and are not exposed to assistive technology.",
      "fix": "Add links: false to the monaco.editor.create options: configuration values are data to edit, not navigation. If following URLs is wanted, keep it and document the new-window behaviour in the editor help text. Recommendation only (AAA, beyond the AA target).",
      "evidence": "monaco.editor.create(containerRef.current, { value, language, ... lineNumbers: 'on', glyphMargin: true, folding: true, ... }) - no links option",
      "component": "MonacoEditor",
      "foundBy": [
        "link-checker"
      ]
    },
    {
      "rule": "LIVE-DIRTY-001",
      "wcag": "n/a",
      "severity": "minor",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/components/SelectedFileHeader.jsx:64",
      "summary": "Unsaved changes are signalled only by Save/Cancel becoming enabled; there is no text indicator, so screen reader users editing a field get no cue that the file is now modified.",
      "fix": "Add a visible 'Unsaved changes' label next to the file name rendered in an always-mounted <span role=\"status\">{hasUnsaved ? t('app.unsavedChanges') : ''}</span>, announced once when the state flips (not on every keystroke).",
      "evidence": "disabled={!hasUnsaved}  // Cancel; Save: disabled={isSaveDisabled}; no other dirty indicator",
      "component": "SelectedFileHeader",
      "foundBy": [
        "live-region-controller"
      ]
    },
    {
      "rule": "MODAL-DIFF-INITIAL-FOCUS",
      "wcag": "2.4.3 A",
      "severity": "minor",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/components/DiffModal.tsx:134",
      "summary": "When the file holds secrets, the diff dialog's first focusable control, and so its initial focus, is 'Show secrets', so an early Enter reveals masked values instead of letting the user read the change.",
      "fix": "Focus a static element first for this complex dialog: render the title as <h2 id tabIndex={-1}>, focus it on open (let useDialogA11y take an initialFocusRef), and point aria-labelledby at it.",
      "evidence": "useDialogA11y: focusables[0].focus()  // first = diff-modal-toggle-secrets Button when hasSecrets",
      "component": "DiffModal",
      "foundBy": [
        "modal-specialist"
      ]
    },
    {
      "rule": "MODAL-FOOTER-REVERSED-ORDER",
      "wcag": "2.4.3 A",
      "severity": "minor",
      "confidence": "low",
      "location": "src/javascript/osgiConfigManager/App/components/Dialogs.jsx:502",
      "summary": "Moonstone ModalFooter lays children out with flex-direction: row-reverse, so Tab goes Cancel then Confirm while they appear right-to-left (Confirm left, Cancel right).",
      "fix": "Verify at runtime; if the reversal is confirmed, render the buttons in the order you want them read and tabbed rather than relying on row-reverse (e.g. wrap them in your own flex container inside ModalFooter).",
      "evidence": "Moonstone xE (ModalFooter): className ['flexRow_reverse', ...]; DOM order here: modal-cancel-button, modal-confirm-button",
      "component": "ModalDialog",
      "foundBy": [
        "modal-specialist"
      ]
    },
    {
      "rule": "MODAL-INITIAL-FOCUS",
      "wcag": "2.4.3 A",
      "severity": "minor",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/components/Dialogs.jsx:285",
      "summary": "Confirmation dialogs open with focus on the top-right X icon (Floating UI initialFocus=0), whose aria-label is 'Cancel' even where the footer's safe action is 'Keep Editing', giving two differently-worded controls for one action.",
      "fix": "For confirm/alert dialogs, put autoFocus on the footer cancel Button (the least destructive action; the focus manager keeps focus already inside), and label the X with t('modal.close') ('Close').",
      "evidence": "Probe: active after open = button aria-label=\"Cancel\" (icon X), before footer Cancel/Keep Editing",
      "component": "ModalDialog",
      "foundBy": [
        "modal-specialist"
      ]
    },
    {
      "rule": "MONACO-THEME-001",
      "wcag": "n/a",
      "severity": "minor",
      "location": "src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx:745",
      "summary": "YAML files use theme 'vs-light', which is not a Monaco built-in theme name; Monaco silently falls back to 'vs'.",
      "fix": "Use 'vs' explicitly (keep autoDetectHighContrast at its default true so forced-colors users get hc-light/hc-black).",
      "evidence": "theme: language === 'properties' ? 'properties-theme' : 'vs-light'",
      "component": "MonacoEditor",
      "foundBy": [
        "contrast-master"
      ]
    },
    {
      "rule": "MOTION-001",
      "wcag": "2.3.3 AAA",
      "severity": "minor",
      "location": "src/javascript/osgiConfigManager/App/components/DiffModal.tsx:118",
      "summary": "No prefers-reduced-motion handling anywhere: modal slide-in, overlay transition, infinite loader spin (AppChrome.jsx:118) and smooth scrollIntoView (FileSidebar.jsx:72) always animate.",
      "fix": "Add @media (prefers-reduced-motion: reduce) in the App <style> block (index.jsx:364) disabling modalSlideIn and transitions, slowing or replacing the spinner, and pass behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' to scrollIntoView.",
      "evidence": "animation: 'modalSlideIn 0.3s ease-out'; transition: 'all 0.2s ease'; animation: 'osgi-config-manager-spin 0.8s linear infinite'; behavior: 'smooth'",
      "component": "DiffModal / InlineLoader / FileSidebar",
      "foundBy": [
        "contrast-master"
      ]
    },
    {
      "rule": "NONTEXT-CONTRAST-003",
      "wcag": "1.4.11 AA",
      "severity": "minor",
      "location": "src/javascript/osgiConfigManager/App/components/AppChrome.jsx:84",
      "summary": "The 3px enabled/disabled bar in the sidebar is #6abb6d (2.35:1) vs #7a7f88 at 40% (1.61:1) on white, 1.71:1 from each other, and disappears in forced-colors mode.",
      "fix": "The line-through on disabled names is a non-colour cue, so keep it; darken the bar colours (e.g. #2e7d32 and var(--color-gray) #7a7f88 opaque) and render the bar as a border-left rather than a background so it survives forced colors, or add a visible 'Disabled' text/icon.",
      "evidence": "backgroundColor: enabled ? 'var(--color-success)' : 'var(--color-gray40)'",
      "component": "FileSidebar",
      "foundBy": [
        "contrast-master"
      ]
    },
    {
      "rule": "NONTEXT-CONTRAST-004",
      "wcag": "1.4.11 AA",
      "severity": "minor",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/components/AppChrome.jsx:97",
      "summary": "StatusBanner icons are below 3:1 on their tinted backgrounds: warning #fb0 on #fff1cc 1.51:1, error #f44053 on #fbd7db 2.78:1 (info #0072b1 on #def4fd 4.57:1 passes).",
      "fix": "Use darker icon colours (e.g. warning #8a5a00, error #b71c1c). Low impact since the banner text carries the message.",
      "evidence": "BANNER_VARIANTS.warning.iconColor 'var(--color-warning)', error.iconColor 'var(--color-danger)'",
      "component": "StatusBanner",
      "foundBy": [
        "contrast-master"
      ]
    },
    {
      "rule": "NONTEXT-CONTRAST-005",
      "wcag": "1.4.11 AA",
      "severity": "minor",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/components/Editor.jsx:34",
      "summary": "The multiline value textarea of the generic ConfigEditor has a #ccc border, 1.61:1 on white.",
      "fix": "Use a border of at least 3:1, e.g. #8a8a8a or var(--color-gray).",
      "evidence": "border: '1px solid #ccc'",
      "component": "ConfigEditor",
      "foundBy": [
        "contrast-master"
      ]
    },
    {
      "rule": "REFLOW-006",
      "wcag": "1.4.10 AA",
      "severity": "minor",
      "confidence": "low",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:52",
      "summary": "The visual .cfg table columns sum to at least 704px of min-width, forcing horizontal scrolling at 320 CSS px.",
      "fix": "A key/value data table may qualify for the two-dimensional-layout exception; if not, lower the property/value minWidth (e.g. 120px) or switch to a stacked key-over-value layout below ~600px.",
      "evidence": "property/value minWidth 240px each + 48+40+88+48px fixed columns",
      "component": "CfgEditor",
      "foundBy": [
        "contrast-master"
      ]
    },
    {
      "rule": "SEM-LIST-004",
      "wcag": "1.3.1 A",
      "severity": "minor",
      "location": "src/javascript/osgiConfigManager/App/components/Dialogs.jsx:476",
      "summary": "Collections are rendered as div stacks rather than lists: existing factory instances, the metatype property options, and the raw editor's property cards.",
      "fix": "Use <ul>/<li> (list-style: none) for Dialogs.jsx:476-489, CfgMetatypePropertyDialog.jsx:137-197 and MonacoEditor.jsx:1489-1572 so AT announces the count and allows list navigation.",
      "evidence": "<div style={INSTANCES_LIST_STYLE}>{instances.map(instance => <div key=… style={EXISTING_INSTANCE_STYLE}>…</div>)}</div>",
      "component": "ModalDialog / CfgMetatypePropertyDialog / MonacoEditor",
      "foundBy": [
        "alt-text-headings"
      ]
    },
    {
      "rule": "TABLE-EMPTY-STATE",
      "wcag": "n/a",
      "severity": "minor",
      "confidence": "medium",
      "location": "src/javascript/osgiConfigManager/App/components/CfgEditor.jsx:547",
      "summary": "When a file has no entries (or every row is hidden by filter or comment toggles) the .cfg and YAML tables (Editor.jsx:334) render only their header row, with no message.",
      "fix": "When no row renders, add <TableRow><TableBodyCell colSpan={6}>{t('editor.noEntries')}</TableBodyCell></TableRow> (colSpan={4} in Editor.jsx), with a filter-specific text when filtering.",
      "evidence": "<TableBody>{Array.isArray(entries) && entries.map(...)}</TableBody>",
      "component": "CfgEditor, ConfigEditor",
      "foundBy": [
        "tables-data-specialist"
      ]
    },
    {
      "rule": "TABLE-ROW-HEADER",
      "wcag": "1.3.1 A",
      "severity": "minor",
      "location": "src/javascript/osgiConfigManager/App/components/Editor.jsx:62",
      "summary": "In the YAML table the property key cell identifies each row but is a <td>, so the Value, Security and Actions cells are not announced with their property name.",
      "fix": "Render the key cell as <TableBodyCell component=\"th\" scope=\"row\">. Include the parent path in it as visually hidden text (see TREE-HIERARCHY) so a nested key is unambiguous.",
      "evidence": "<TableBodyCell style={{ flex: '0 0 25%', paddingLeft: `${level * 20 + 20}px`, ... }}><div ...><Typography variant=\"caption\">{rowLabel}</Typography>",
      "component": "LeafRow",
      "foundBy": [
        "tables-data-specialist"
      ]
    }
  ],
  "passed": [
    "1.3.5 Identify Input Purpose: not applicable. No field collects the user's own personal data, so no autocomplete token from the WCAG list applies.",
    "1.4.4 Resize text: all font sizes are px/rem and scale with browser zoom; no viewport-unit font sizes; fixed 48px sidebar row heights still fit one 200% text line",
    "2.1.4 Character Key Shortcuts: no single-character shortcut registered; no document-level key listener except Escape/Tab inside open dialogs (useDialogA11y), no Monaco addCommand/addAction, Monaco default bindings are modifier-based and active only while the editor has focus.",
    "2.2.2 Pause, Stop, Hide: the only animation is the loading spinner, which appears only while data loads.",
    "2.4.6 Page title h1 'OSGi Configurations Manager', dialog titles ('Review Changes: {{name}}', 'Disable configuration', 'Unsaved Changes') and the unsaved-changes buttons are descriptive.",
    "3.2.1 On Focus: focusing a .cfg input only highlights its row; no focus handler opens dialogs, navigates or submits.",
    "3.2.2 On Input: the 'Search in content' switch, the encryption checkbox and the show/hide-secrets buttons change only the current view or a pending edit.",
    "3.2.3 Consistent Navigation: a single admin route; the header toolbar (New, Import, Refresh) and the file toolbar (Disable/Enable, Mark as Default, Download, Delete) keep the same order and position for every file.",
    "3.3.3 Error Suggestion: the invalid-extension messages name the accepted extensions (modal.error.invalidExtension, invalidExtensionUpload), and the duplicate-key message names the keys.",
    "3.3.4 Disable and Mark as Default ask for confirmation, with a specific action label ('Disable', 'Mark as Default') (useFileActions.ts:59-69, 93-101).",
    "3.3.4 Encryption: the visual-mode checkbox and the raw Encrypt button only change the editor, so the change is reviewed in the save diff before it reaches the server.",
    "3.3.4 Error Prevention (destructive actions): deleting a file, disabling a file, deleting a property, marking a file as default, overwriting on upload and discarding unsaved changes all ask for confirmation first (useFileActions.ts:59-116, useOsgiConfigs.ts:670-675, index.jsx:110-125).",
    "3.3.4 Error Prevention (save): every save of a changed configuration goes through a review-before-save diff (useOsgiConfigs.ts:381-394, DiffModal) with separate Cancel and Confirm.",
    "3.3.4 Save: every save goes through a review-before-save diff that must be confirmed (useOsgiConfigs.ts:382-395, DiffModal.tsx), with secrets masked.",
    "3.3.4 Unsaved edits are guarded before switching file, refreshing, creating, importing, toggling and marking as default ('Discard Changes' / 'Keep Editing', index.jsx:110-202).",
    "3.3.7 Create: the filter text is kept when switching between the Configuration and Factory tabs; factory instance identifiers already in use are flagged live before submission (Dialogs.jsx:200-207, 458-462).",
    "3.3.8 Accessible Authentication: not applicable. The module has no sign-in; Jahia's own login handles it. The cryptoSecret passphrase is configuration data, not a login step.",
    "Actions are buttons: modal close (Dialogs.jsx:285), Metatype options (CfgMetatypePropertyDialog.jsx:149), reorder handle (CfgEditor.jsx:608), toolbar actions (SelectedFileToolbar.jsx, MonacoEditor.jsx:1355-1412).",
    "All dialog triggers are real buttons (Moonstone Button/ActionButton)",
    "CfgEditor drag-handle icon gray_dark60: 3.82:1 on white, 3.63:1 on selected row (1.4.11)",
    "CfgEditor reorder handle is a native <button> with an aria-label and an Arrow Up/Down alternative to drag-and-drop (2.5.7).",
    "CfgEditor row onClick (selection) has a keyboard equivalent: focusing any field of the row selects it (handleInputFocus).",
    "CfgMetatypePropertyDialog: #666 on white 5.74:1, #555 on #fafafa 7.14:1, #0077b6 on white 4.87:1; tooltip doc text #fff/#d7e2e8/#f1f5f7 on dark tooltip >= 13:1 (assuming Moonstone tooltip bg #131c21)",
    "CfgMetatypePropertyDialog: role=dialog, aria-modal, aria-label; useDialogA11y moves focus into the dialog, keeps Tab inside it, closes on Escape and gives focus back on close.",
    "Comment rows: italic + '#' marker + Comments icon give a non-colour cue (contrast fails separately)",
    "ConfigStateBadge: MODULE / MODULE_DEFAULT / USER differ by icon shape (Build/Module/Edit) and label, not colour alone",
    "Ctrl+Shift+M (macOS) does release Tab from the Monaco editor; no other keyboard trap found",
    "Custom dialogs (DiffModal, CfgMetatypePropertyDialog) move focus in, trap Tab/Shift+Tab, close on Escape and restore focus via useDialogA11y.",
    "Custom dialogs DiffModal and CfgMetatypePropertyDialog use role=\"dialog\" + aria-modal=\"true\" and useDialogA11y: focus moves in, Tab/Shift+Tab trapped, Escape closes, focus restored to the trigger.",
    "Deep search server query is debounced 500 ms (useOsgiConfigs.ts:223-238); no high-frequency updates found that would need further debouncing.",
    "DiffModal and CfgMetatypePropertyDialog: role=dialog + aria-modal=true + non-empty aria-label; Escape closes via useDialogA11y; focus moves inside on open; Paper forwards the ref so the trap container is attached",
    "DiffModal close icon #888 on white 3.54:1 (1.4.11)",
    "DiffModal context text #333 on #f5f5f5 11.59:1; title #111 18.88:1; added 4.86:1 and removed 4.77:1 each pass 1.4.3 individually",
    "DiffModal: a unified single-column diff with no line numbers or side-by-side columns is not tabular data; 1.3.1 does not require table semantics, only change markers (reported separately).",
    "DiffModal: focus returns to the Save trigger on Cancel/Escape/backdrop (no autoFocus inside)",
    "Disabled config files: line-through on name and Enable/Disable label in toolbar give a non-colour cue",
    "Drag reordering has a keyboard alternative (reorder button, CfgEditor.jsx:608-622), so it is not drag-only (2.5.7).",
    "Each dialog has a visible Cancel/OK action; ModalDialog's X is a real Button with an aria-label",
    "Editor.jsx floating overlay #333 on #fff 12.63:1",
    "File upload: a native <input type=\"file\" accept=\".yml,.cfg\"> opened by a labelled button (AppHeaderBar.jsx:65-72); the file name is checked and an error is shown when it is wrong.",
    "Header, file toolbar, raw-editor toolbar and footer buttons all have visible text labels; no icon-only button there lacks a name.",
    "Hidden file input (display:none) is only triggered from the labelled Import button.",
    "Icons inside buttons that have a visible label or aria-label (ActionButton, raw editor toolbar, reorder button, show/hide secret button, Dialogs close button) are presentational children of the button and need no text alternative.",
    "InlineLoader spinner (AppChrome.jsx:111) is a CSS-only element with a visible text label beside it.",
    "Label in name (2.5.3): the Metatype option buttons (CfgMetatypePropertyDialog.jsx:149-153) use aria-label={property.id}, which matches their visible bold label.",
    "Locale parity: all six locale files have the same 193 keys, so no label falls back to a raw key.",
    "Masked values in the YAML table show a text placeholder ('*****', Editor.jsx:120) rather than an empty cell.",
    "Masked-secret dots #4a5561: 7.60:1 on white, 5.01:1 on Monaco selection #add6ff",
    "Metatype info badge 'i' #0072b1 on #def4fd 4.57:1",
    "Metatype metadata inside cards ('Type: x', 'Optional: yes', 'Default: y', MonacoEditor.jsx:1551-1567; CfgMetatypePropertyDialog.jsx:179-188) keeps the label in the same text as the value, so <dl> markup is not required.",
    "Metatype property cards in the raw editor panel: onDoubleClick insertion has a keyboard-operable 'Insert' button equivalent (MonacoEditor.jsx:1534).",
    "Metatype property options in CfgMetatypePropertyDialog are native <button type=\"button\"> elements.",
    "Metatype property options in CfgMetatypePropertyDialog are native <button> elements (CfgMetatypePropertyDialog.jsx:149).",
    "Metatype property picker dialog options are native <button> elements (CfgMetatypePropertyDialog.jsx:149).",
    "Modal dialogs (DiffModal, CfgMetatypePropertyDialog) carry role=\"dialog\", aria-modal and an accessible name.",
    "Module h1 'OSGi Configurations Manager' is inside the shell's <main> landmark",
    "Monaco 'properties-theme' token colours on #fffffe: key #0000FF 8.59:1, comment #008000 5.13:1, delimiter/string #000000 21:1",
    "Moonstone Modal (Dialogs.jsx ModalDialog) uses floating-ui FloatingFocusManager (modal trap, returnFocus=true) and useDismiss (Escape), checked in @jahia/moonstone 2.20.3 dist/index.js.",
    "Moonstone Modal (ModalDialog) uses floating-ui FloatingFocusManager with role=dialog and aria-modal.",
    "Moonstone Modal (ModalDialog): role=dialog, aria-modal=true, focus moved inside on open, Tab trapped by Floating UI focus guards, background siblings set aria-hidden=true while open (probe)",
    "Moonstone Modal: Escape and outside mousedown close via onOpenChange(false) -> onClose; focus returns to the still-connected trigger on close (probe: activeElement = trigger)",
    "Moonstone ModalDialog: focus moves inside on open, background is aria-hidden while open, Escape closes, focus returns to the Delete button",
    "Moonstone TabItem in the create dialog renders role=tab buttons with a horizontal roving arrow-key hook.",
    "Moonstone Tooltip opens on focus as well as hover (useFocus), so tooltips on Buttons (ActionButton, EditorToolbarButton, secret toggle) are keyboard-reachable.",
    "Moonstone tooltip label CSS (index.jsx:371-383) wraps and caps width at calc(100vw - 32px) - reflow-safe",
    "No <a> element is rendered anywhere in scope: Editor.jsx, CfgEditor.jsx and FileSidebar.jsx contain no anchors or hrefs (their grep hits were table markup).",
    "No <img>, <picture>, <figure>, <video>, <audio>, <canvas> or CSS background image carrying information in the module.",
    "No ambiguous link text (click here, read more, learn more, here) and no raw URL used as link text, in JSX or in locales/en.json.",
    "No aria-labelledby / aria-describedby / aria-controls IDREFs authored by the module, hence none broken (dangling references come from Moonstone, see notes).",
    "No aria-live=\"assertive\" or role=\"alert\" misuse on routine updates (the module declares no live regions at all).",
    "No document.title or lang handling in the module; both belong to the Jahia shell.",
    "No href=\"#\", javascript: URL, or anchor used as a button.",
    "No live region hidden with display:none or visibility:hidden.",
    "No nested modals: chained dialogs (upload conflict -> rename prompt, add-property error) close the first and open the next after a 100 ms timeout",
    "No positive tabindex anywhere in scope (only tabIndex={0} on the file list and tabindex=-1 set programmatically by useDialogA11y).",
    "No positive tabindex values in module code.",
    "No repeated identical link texts pointing to different destinations, and no adjacent icon + text link duplicates.",
    "No role=\"button\"/\"link\"/\"checkbox\" or landmark roles added to native elements in module code (no redundant ARIA authored by the module).",
    "No role=\"grid\" or treegrid misuse, and no layout table needing role=\"presentation\" (the file list is reported as a list drawn as a table).",
    "No sortable columns, pagination, select-all checkbox or row multi-selection, so aria-sort, aria-current pagination and indeterminate-state checks do not apply.",
    "No streaming transcript or log-style content in scope.",
    "No target=\"_blank\", window.open or other new-tab navigation in application code.",
    "Page title is a real <h1> (AppHeaderBar Typography component=\"h1\").",
    "Password visibility toggle: a native button whose aria-label follows its state, 'Show secret value' or 'Hide secret value' (CfgEditor.jsx:762-773).",
    "Prompt inputs submit on Enter, and every dialog has a real <button> (Moonstone Button renders <button type=\"button\">).",
    "Property picker options are real <button> elements; choosing one moves focus to the new value field (focusEntryValue)",
    "Raw editor toolbar dividers (MonacoEditor.jsx:97) are empty decorative divs with no semantics, which is correct.",
    "Reorder handle is a native <button> with an aria-label describing the Arrow Up/Down interaction (keyboard alternative to drag exists, defects aside).",
    "Reorder handle is a native <button> with aria-label and keyboard reordering (CfgEditor.jsx:608).",
    "Show/hide secret buttons (CfgEditor.jsx:764) carry an aria-label that switches with state.",
    "The .cfg and YAML property lists are real tables (moonstone Table/TableBody/TableRow/TableBodyCell render <table>/<tbody>/<tr>/<td>), not div grids, so 1.3.1 does not require converting div layouts there.",
    "The hidden file input (AppHeaderBar.jsx:65) is display:none and opened by a labelled button.",
    "The module renders one h1 (AppHeaderBar.jsx:27, component=\"h1\") holding the app title.",
    "The only anchor is the detached download anchor built in index.jsx:98-107 (href to a blob URL, download=file.name), clicked programmatically and removed; the user-facing trigger is a real Button labelled Download (SelectedFileToolbar.jsx:85-89) next to the selected file's name.",
    "The reorder handle is a native <button type=\"button\"> with an aria-label that explains Arrow Up/Down (CfgEditor.jsx:608-626).",
    "Toast: minWidth 280px + 20px offset fits a 320px viewport; maxWidth 520px",
    "Toasts do not steal focus (useToast.tsx renders without focusing).",
    "Toolbar and header actions (New, Import, Refresh, Save, Cancel, Enable/Disable, Mark as default, Download, Delete, raw-editor toolbar) are Moonstone Buttons, i.e. native buttons.",
    "Toolbar buttons (New, Import, Refresh, Cancel, Delete) show a visible focus outline",
    "Unsaved-changes confirmation wording is explicit ('Discard Changes' / 'Keep Editing'); disable and overwrite confirmations name the action",
    "Upload: the hidden file input is triggered from a real button; no keyboard dead end.",
    "WCAG 1.4.12 text-spacing override (line-height 1.5, letter 0.12em, word 0.16em, paragraph 2em): no clipped text detected on the initial page",
    "YAML filenames in sidebar var(--color-accent_dark) #0072b1 on white 5.20:1; file type also stated by the extension, not colour-only",
    "axe target-size (2.5.8): no violation in any of the 15 states",
    "axe: no duplicate-id, button-name, image-alt, list or heading-order violation inside the module",
    "colSpan values match the column count: CfgEditor comment row 1+1+2+1+1 = 6 columns (line 636), YAML container row colSpan=4 for 4 columns (Editor.jsx:162).",
    "useDialogA11y restores focus to the trigger on close (useDialogA11y.ts:84-89), so feedback after a confirm dialog starts from a known focus point.",
    "useDialogA11y.ts:4 includes a[href] in its focusable selector, so a future link inside a dialog stays inside the focus trap."
  ],
  "notes": [
    {
      "skill": "alt-text-headings",
      "note": "Contrary to the brief, the module owns the page h1: AppHeaderBar.jsx:23-32 renders <header> plus <Typography component=\"h1\">. Runtime check needed: confirm the Jahia shell does not add another h1, and that this <header> sits inside the shell's <main> (Moonstone LayoutModule renders main); if it does not, it becomes a second banner landmark."
    },
    {
      "skill": "alt-text-headings",
      "note": "Moonstone ModalHeader (used by Dialogs.jsx:293) renders the dialog title as an <h4> inside a <header>; the level is not configurable from the module. Dialog headings conventionally restart at h2; raise it with the Moonstone team if the jump from h1 matters."
    },
    {
      "skill": "alt-text-headings",
      "note": "Moonstone TableRow/TableBodyCell apply flex classes to <tr>/<td>. Some browsers drop table semantics when table elements get display:flex; the runtime a11y tree should confirm whether the CfgEditor table is still exposed as a table."
    },
    {
      "skill": "alt-text-headings",
      "note": "Editor.jsx (ConfigEditor) is only rendered for files that are neither .cfg nor .yml (index.jsx:326), and the server only lists .cfg/.yml and their .disabled forms (OsgiConfigService.java:43), so it is effectively dead code. It would add: a td-as-button collapse toggle with no aria-expanded (Editor.jsx:161-171), a double-click-only value editor div (Editor.jsx:102-121), and decorative Chevron/Folder icons. Not reported as findings; delete the component or fix those if it is ever reached."
    },
    {
      "skill": "alt-text-headings",
      "note": "Outside WCAG, but in line with the project's secret-masking invariant: MonacoEditor masks secrets with a CSS decoration that makes the characters transparent (MonacoEditor.jsx:103-111). The plaintext stays in the Monaco model, which Monaco exposes to screen readers, so a screen reader reads the 'masked' secret aloud. The CfgEditor (type=password) and DiffModal (text replaced) do not have this problem. Worth a decision by the maintainer."
    },
    {
      "skill": "alt-text-headings",
      "note": "Left to the forms/ARIA specialists: the 'Search in content' Switch is not associated with its visible text (FileSidebar.jsx:117-124); the editor-mode Dropdown has no label (SelectedFileToolbar.jsx:104); SearchInput and dialog Inputs rely on placeholders; the encryption Checkbox per row has no label (CfgEditor.jsx:778, title is on the td). Status banners and the toast have no live-region role (AppChrome.jsx:131, useToast.tsx:77)."
    },
    {
      "skill": "alt-text-headings",
      "note": "Moonstone Tooltip clones a fixed id 'moonstone-tooltip_label' into aria-describedby on its child; with several tooltips open in sequence that is fine, but the id is not unique per instance (Moonstone internal)."
    },
    {
      "skill": "aria-specialist",
      "note": "Moonstone defects the module can only work around: Dropdown puts role=\"listbox\" on the trigger with a role=\"option\" span and no aria-expanded; Modal labels itself (aria-labelledby = its own id); TableRow forces tabIndex=0; TabItem keeps every tab at tabIndex 0 (no roving) and arrows do not wrap; Switch and Checkbox add redundant role=\"checkbox\"/aria-checked on native checkboxes; Tooltip clones aria-describedby=\"moonstone-tooltip_label\" (a constant id, absent from the DOM while closed, duplicated if two tooltips open); SearchInput wraps the field in an unlabelled role=\"search\" landmark; clear buttons use a hardcoded English aria-label \"Reset\"; ModalHeader renders an <h4> (level skip from the page h1); icons are <svg> without aria-hidden. Worth an upstream Moonstone issue."
    },
    {
      "skill": "aria-specialist",
      "note": "Tooltips that repeat the button label (Cancel: tooltip 'Cancel'; Save: 'Save changes' vs 'Save Changes') add a redundant aria-describedby; tooltips on disabled buttons (Mark as Default, Save) are unreachable by keyboard because disabled buttons cannot take focus."
    },
    {
      "skill": "aria-specialist",
      "note": "AppHeaderBar renders <header>; outside a sectioning element it maps to a banner landmark. Whether that duplicates the Jahia admin shell's banner, and whether a <main> wraps the route, must be checked in the runtime scan."
    },
    {
      "skill": "aria-specialist",
      "note": "Editor.jsx (ConfigEditor tree) is only reached for files whose extension is not lowercase .cfg/.yml (index.jsx tests endsWith case-sensitively while the server lowercases), so its findings are low confidence for reachability, not for the defects."
    },
    {
      "skill": "aria-specialist",
      "note": "Behavioural bug seen while reviewing: the keyboard reorder handler (CfgEditor.jsx:614) does not check `filtering`, unlike the drag path, so Arrow Up/Down reorders against hidden neighbours while a filter is active."
    },
    {
      "skill": "aria-specialist",
      "note": "Monaco captures Tab inside the editor; the escape (Ctrl+M / tab focus mode) is only discoverable through Alt+F1. Keep that hint in any custom ariaLabel (2.1.2)."
    },
    {
      "skill": "aria-specialist",
      "note": "Selection-follows-focus in the file list: Arrow Up/Down opens each file (and the unsaved-changes dialog when dirty). With a listbox, consider moving focus with arrows and opening on Enter."
    },
    {
      "skill": "aria-specialist",
      "note": "Not checked here (runtime half): computed accessible names in the browser, Moonstone Menu roles when the Dropdown is open, focus order across panes, contrast of state colours."
    },
    {
      "skill": "cognitive-accessibility",
      "note": "2.2.1 session: the session timeout is Jahia's, not the module's. The module has no expiry warning or extension, and a request after expiry fails with a 6 s error toast (COG-001), then signing in again loses edits (COG-016). Check the platform's session length and warning in the running instance."
    },
    {
      "skill": "cognitive-accessibility",
      "note": "3.2.6 Consistent Help: N/A. The app offers no help mechanism (contact, help link or chat), so nothing has to stay in the same place."
    },
    {
      "skill": "cognitive-accessibility",
      "note": "3.3.8 Accessible Authentication: N/A. The module has no sign-in step; authentication is Jahia's."
    },
    {
      "skill": "cognitive-accessibility",
      "note": "3.2.2 editor mode: choosing 'Raw Edit' / 'Visual Edit' in the dropdown replaces the editor straight away. The user chose it and the option is labelled, so it is not flagged, but tooltip.modeRaw and tooltip.modeVisual are unused and could tell users the mode is remembered."
    },
    {
      "skill": "cognitive-accessibility",
      "note": "3.2.2 create dialog: choosing a factory card moves focus into the identifier field (autoFocus, Dialogs.jsx:447). This is a user click and the field is the next step, so it is not flagged."
    },
    {
      "skill": "cognitive-accessibility",
      "note": "Hand-off to forms and aria specialists: visible labels are Typography that is not linked to its input (Dialogs.jsx:334-344, 350-359, 442-452); the deep-search Switch has no accessible name (FileSidebar.jsx:117-121); CreateOptionCard is a clickable div with no keyboard access (Dialogs.jsx:90-115); table header cells are TableBodyCell inside thead (CfgEditor.jsx:178-205)."
    },
    {
      "skill": "cognitive-accessibility",
      "note": "Hand-off to the live-region controller: the toast Paper (useToast.tsx:77-97) has no role=status/alert, so screen readers may not announce the outcome of any action."
    },
    {
      "skill": "cognitive-accessibility",
      "note": "Unused English keys that point to missing UI: app.unsaved, tooltip.modeRaw, tooltip.modeVisual, configState.badgeCompact.*, sidebar.on/off, modal.create.or. The sidebar shows a disabled file only by strikethrough and a grey bar (FileSidebar.jsx:158, 173); that is a 1.4.1/1.3.1 question for the visual specialist."
    },
    {
      "skill": "cognitive-accessibility",
      "note": "AAA/COGA advisory, not flagged one by one: the audience is server administrators, so OSGi terms (PID, Metatype, factory, ENC(...)) are fine as domain vocabulary. 'materialized' (modal.create.message) and 'Redo reversed change' (tooltip.redo) could be plainer."
    },
    {
      "skill": "cognitive-accessibility",
      "note": "Editor.jsx (tree editor) only renders for files that are neither .cfg nor .yml, which the UI cannot create; it was reviewed lightly (COG-007)."
    },
    {
      "skill": "contrast-master",
      "note": "Moonstone 2.21 tokens with suffix 20/40/60 (e.g. --color-gray_dark60 = #29313699) are alpha colours; ratios above are computed after compositing on the actual background. Every text use of an alpha token in this module fails 4.5:1."
    },
    {
      "skill": "contrast-master",
      "note": "Third-party, for runtime confirmation and possible upstream report (not counted as findings): Moonstone focus ring outline 2px var(--moon-color-accent_light) #63d1ff is 1.74:1 on white (fails 1.4.11 / 2.4.7 contrast); ghost accent buttons use #00a0e3 text (2.94:1); default accent button colours, Typography color=textSecondary, Chip colours and TableRow isHighlighted were not measured from source."
    },
    {
      "skill": "contrast-master",
      "note": "Whether Typography inherits EMPTY_STATE_STYLE / InlineLoader colour (subtleTextColor 3.82:1) depends on Moonstone's Typography class; confirm in the runtime contrast pass."
    },
    {
      "skill": "contrast-master",
      "note": "Editor.jsx (generic ConfigEditor) is reached only when a listed file's extension is not exactly lower-case .cfg/.yml (backend matches case-insensitively, the UI uses case-sensitive endsWith); its other hard-coded colours (#007cb0 folder icon 4.46:1 on #fafafa, gradient #f0f4f7) are decorative or pass."
    },
    {
      "skill": "contrast-master",
      "note": "Monaco marker squiggles distinguish error vs warning by colour; this is Monaco's built-in rendering and markers are also listed in the hover/problems text."
    },
    {
      "skill": "contrast-master",
      "note": "For other specialists: the DiffModal close control (DiffModal.tsx:145) and CfgMetatypePropertyDialog close (line 112) are non-focusable divs with no accessible name; toasts have no live region; the compact sidebar ConfigStateBadge has no text alternative besides a hover tooltip."
    },
    {
      "skill": "contrast-master",
      "note": "Windows forced-colors mode was reviewed from source only: background-only cues (diff colours, sidebar status bar, selected create card, selected cfg row) disappear there; verify in Edge with forced colors active."
    },
    {
      "skill": "forms-specialist",
      "note": "Moonstone 2.21.0 was read from a sibling checkout (osgi-configurations-manager-lotA/node_modules), the version yarn.lock pins. This worktree has no node_modules."
    },
    {
      "skill": "forms-specialist",
      "note": "Moonstone Input/SearchInput render a native <input> with no <label>; extra props (aria-label, aria-describedby, aria-invalid, autoComplete, id) are spread onto the input, so every fix above can be made in the module. Props do not reach the SearchInput wrapper div that carries role=\"search\", so the two search landmarks (sidebar, property filter) stay unnamed unless the module wraps them in its own <search>/<form role=\"search\" aria-label>."
    },
    {
      "skill": "forms-specialist",
      "note": "Moonstone defects to report upstream, not fixable here: the SearchInput clear button has the English-only aria-label 'Reset'; Checkbox and Switch set aria-checked on a native checkbox, which ARIA in HTML forbids; Modal sets aria-labelledby to its own id, so its accessible name is the whole dialog text, and the ModalHeader message is not linked with aria-describedby."
    },
    {
      "skill": "forms-specialist",
      "note": "The task mentions checkboxes and selects for Metatype types: the visual .cfg editor has none. Every value is a free-text textarea or a password Input (see FORM-TYPE-001). The only checkbox is the per-row encryption toggle."
    },
    {
      "skill": "forms-specialist",
      "note": "Monaco's own accessibility (Alt+F1 help, F8 to step through markers with announcement, Ctrl+M to stop Tab being captured) was not checked at runtime. Confirm in the runtime scan with NVDA/VoiceOver that markers are announced and that Ctrl+M lets focus leave the editor (2.1.2)."
    },
    {
      "skill": "forms-specialist",
      "note": "Keyboard operation of the sidebar file list (a focusable div with arrow keys, rows with no role or option semantics) and the Create dialog's Tab/TabItem pattern are outside the forms scope; they are left to the keyboard and ARIA specialists."
    },
    {
      "skill": "forms-specialist",
      "note": "Moonstone Input receives an 'inputRef' prop at CfgEditor.jsx:737 that is spread onto the DOM input as an unknown attribute. Not an accessibility defect, but React logs a warning about it."
    },
    {
      "skill": "keyboard-navigator",
      "note": "Editor.jsx (ConfigEditor) is unreachable today: the backend lists only .cfg/.yml (OsgiConfigService.SUPPORTED_CONFIG_EXTENSIONS) and index.jsx routes those to CfgEditor/MonacoEditor. If it is ever re-enabled, it has mouse-only value editing (onDoubleClick, Editor.jsx:105), a clickable non-focusable collapse cell (Editor.jsx:170) and a sticky header (Editor.jsx:328) that can hide focused small buttons when Shift+Tabbing upward (2.4.11); consider deleting the file."
    },
    {
      "skill": "keyboard-navigator",
      "note": "2.4.1 Bypass Blocks / skip link: the module renders inside the Jahia administration shell (LayoutContent); a skip link to the editor is the shell's responsibility. Within the module the tab sequence before the editor is short (header actions, search, deep-search switch, file list, Save/Cancel, file toolbar)."
    },
    {
      "skill": "keyboard-navigator",
      "note": "Runtime checks for the orchestrator's keyboard scan: (1) whether the Moonstone Modal's FloatingFocusManager initial focus overrides autoFocus on the prompt/filename inputs (Dialogs.jsx:303, 339) and lands on the close button placed before the header (Dialogs.jsx:284); (2) focus ring visibility of Moonstone ghost Buttons, Switch, Dropdown and SearchInput in the admin theme; (3) whether the native reorder <button> keeps a visible default outline under Moonstone's global CSS; (4) Moonstone Dropdown (editor mode, SelectedFileToolbar.jsx:104) arrow-key and Escape behaviour."
    },
    {
      "skill": "keyboard-navigator",
      "note": "Focus after file selection is preserved: arrow-key selection keeps focus on the list container and auto-scrolls the selected row into view (FileSidebar.jsx:65-75); clicking a row does not move focus, which is acceptable."
    },
    {
      "skill": "keyboard-navigator",
      "note": "Screen-reader semantics of the file list (listbox/option, aria-activedescendant), the Moonstone Modal aria-labelledby pointing at its own id, the toast lacking role=status and the lack of a live announcement after keyboard reorder are left to the ARIA/live-region specialists."
    },
    {
      "skill": "link-checker",
      "note": "Premise correction: the task said FileSidebar.jsx, Editor.jsx and CfgEditor.jsx contain anchors/hrefs. They do not. The clickable non-button elements found instead are reported above as LINK-CONTROL-ELEMENT."
    },
    {
      "skill": "link-checker",
      "note": "The YAML editor's collapsible container row (Editor.jsx:161-171, onClick on a td) and the double-click-to-edit value (Editor.jsx:105) are also non-button controls. They are reported by tables-data-specialist (they are table cells), not repeated here."
    },
    {
      "skill": "link-checker",
      "note": "Repeated identical button names without row context (Delete this property, Reorder this entry, Insert) are not link text under 2.4.4 and are reported by tables-data-specialist as cell-control context."
    },
    {
      "skill": "link-checker",
      "note": "Runtime check left to the browser half: confirm Monaco's link hover ('Follow link') appears on a value containing http(s):// at the page URL."
    },
    {
      "skill": "live-region-controller",
      "note": "Moonstone (third-party): Paper, Typography, Modal/ModalHeader, SearchInput, Checkbox and Button are used as-is. Runtime checks needed: whether Moonstone Modal sets aria-hidden/inert outside itself (affects LIVE-TOAST-006), whether ModalHeader's message is exposed via aria-describedby (the error modals for invalid extension, duplicate keys and invalid YAML rely on it), and whether a disabled Moonstone Button uses the disabled attribute (affects LIVE-FOCUS-001)."
    },
    {
      "skill": "live-region-controller",
      "note": "Monaco has its own accessibility support (Alt+F1 help, F8 next problem, aria status on marker navigation); verify with NVDA/VoiceOver whether markers are announced while typing before deciding the scope of LIVE-VALID-003."
    },
    {
      "skill": "live-region-controller",
      "note": "Every new label proposed in the fixes (dismiss, saving, searchCount, noResults, unsavedChanges, reorder.moved, encryptedLine...) needs its key in every locale file under src/main/resources/javascript/locales, per CLAUDE.md (bundled translations)."
    },
    {
      "skill": "live-region-controller",
      "note": "Announcements for encrypt/decrypt and the decryption probe must never include the value itself (CLAUDE.md invariant on secrets and masking)."
    },
    {
      "skill": "live-region-controller",
      "note": "Out of this skill's scope, for the forms specialist: the visual editor's encryption Checkbox (CfgEditor.jsx:778) and ConfigEditor's encrypted toggle (Editor.jsx:126) have no accessible name besides a title on the cell; the sidebar compact ConfigStateBadge has an empty label (ConfigStateBadge.jsx:40)."
    },
    {
      "skill": "live-region-controller",
      "note": "The configuration-state banners (index.jsx:251-265) appear with a newly selected file; they are page content for the new view rather than status messages and do not need a live region."
    },
    {
      "skill": "live-region-controller",
      "note": "The InlineLoader spinner ignores prefers-reduced-motion (2.3.3 AAA, outside the AA target)."
    },
    {
      "skill": "modal-specialist",
      "note": "Upload conflict dialog passes otherLabel/onOther ('Rename', useFileActions.ts:267-284) but ModalDialog never renders otherLabel, so the rename choice is missing for everyone. Functional defect, not WCAG; flagged for the team."
    },
    {
      "skill": "modal-specialist",
      "note": "Moonstone version in package.json is ^2.21.0; this worktree has no node_modules, so Moonstone 2.21.0 was inspected and probed in jsdom from the sibling worktree osgi-configurations-manager-lotA/node_modules. The self-referencing aria-labelledby, h4 ModalHeader and row-reverse footer are vendor behaviours; the module can override the first via props."
    },
    {
      "skill": "modal-specialist",
      "note": "Runtime checks still needed: what the screen reader actually announces as the Moonstone dialog name; whether Chrome's focusable scrollers make the diff region tabbable; focus after save/delete in the real app; Moonstone Dropdown (editor mode, SelectedFileToolbar.jsx:104) popup keyboard and Escape behaviour and its missing 'editor mode' purpose label; Moonstone Tooltip hover/dismiss behaviour (1.4.13)."
    },
    {
      "skill": "modal-specialist",
      "note": "Recommended direction for the two custom overlays: move DiffModal and CfgMetatypePropertyDialog to Moonstone Modal (already used and correct for trap/inert/return) or to a native <dialog> with showModal(), instead of hardening useDialogA11y further."
    },
    {
      "skill": "playwright-scanner",
      "note": "Out of the module's scope, reported by axe on the Jahia admin shell (platform team): <html> without lang (3.1.1), invalid custom roles on primary nav items (dashboard-menu-item, ...) and accordion headers (accordion-item, aria-expanded/aria-controls invalid), selected tree item white on #00a0e3 (2.89:1), a hidden h1 'Something wrong happened' inside <main>, and the secondary navigation covering the whole viewport at 320 px."
    },
    {
      "skill": "playwright-scanner",
      "note": "No toast was triggered during the runtime pass (Refresh shows none), so toast announcement relies on the code review finding."
    },
    {
      "skill": "playwright-scanner",
      "note": "Nothing was saved or deleted on the instance: every dialog was cancelled and every edit discarded."
    },
    {
      "skill": "tables-data-specialist",
      "note": "moonstone internals (TableRow defaults to tabIndex=0, TableBodyCell renders <td>, TableHeadCell renders <th>, Checkbox renders an unlabelled <input>) were read from @jahia/moonstone 2.20.3 in a sibling worktree; this worktree has no node_modules and package.json asks for ^2.21.0. Confirm in the browser that the behaviour did not change."
    },
    {
      "skill": "tables-data-specialist",
      "note": "moonstone Table and TableRow add flex display classes (flexCol_nowrap, flexRow) to <table> and <tr>. Some browser/screen-reader pairs, notably WebKit with VoiceOver, have dropped table semantics when the display is overridden. Check the accessibility tree at the page URL (run_playwright_a11y_tree) for role table/row/columnheader after the <th> fix."
    },
    {
      "skill": "tables-data-specialist",
      "note": "Decision for the team: for the YAML editor, a hidden parent path in a row header plus disclosure buttons (recommended) versus a full ARIA treegrid, which also requires arrow-key cell navigation and roving tabindex."
    },
    {
      "skill": "tables-data-specialist",
      "note": "Overlap with other specialists: hover-only overflow previews (Editor.jsx:46, CfgEditor.jsx:313, AppChrome.jsx:163) and the hover-only metatype 'i' tooltip trigger (CfgEditor.jsx:696, a non-focusable div) fall under 1.4.13 / 2.1.1 and are left to the keyboard and ARIA specialists."
    }
  ],
  "counts": {
    "critical": 8,
    "serious": 67,
    "moderate": 85,
    "minor": 38
  },
  "components": [
    {
      "component": "CfgEditor",
      "count": 19,
      "worst": "serious",
      "rules": [
        "ARIA-KBD-033",
        "ARIA-NAME-029",
        "ARIA-NAME-031",
        "ARIA-SEM-028",
        "ARIA-STATE-035",
        "COG-010",
        "COG-024",
        "CONTRAST-TEXT-003",
        "CONTRAST-TEXT-006",
        "CONTRAST-TEXT-007",
        "KBD-DRAG-ONLY-POINTER",
        "KBD-FOCUS-LOST-REMOVED",
        "KBD-REORDER-FOCUS",
        "LIVE-FILTER-002",
        "LIVE-REORDER-001",
        "NONTEXT-CONTRAST-001",
        "REFLOW-006",
        "SEM-TABLE-002",
        "TABLE-CAPTION"
      ]
    },
    {
      "component": "FileSidebar",
      "count": 16,
      "worst": "serious",
      "rules": [
        "ARIA-KBD-002",
        "ARIA-NAME-006",
        "ARIA-SEL-001",
        "COG-012",
        "DATA-LIST-AS-TABLE",
        "FOCUS-VISIBLE-002",
        "IMG-STATE-001",
        "KBD-LIST-KEYS",
        "LINK-CONTROL-ELEMENT",
        "LIVE-FILTER-001",
        "LIVE-LOAD-003",
        "NONTEXT-CONTRAST-003",
        "REFLOW-001",
        "SEM-LIST-001",
        "SEM-LIST-002",
        "SEM-LIST-003"
      ]
    },
    {
      "component": "MonacoEditor",
      "count": 15,
      "worst": "serious",
      "rules": [
        "ARIA-NAME-036",
        "ARIA-NAME-039",
        "ARIA-NAME-040",
        "ARIA-PRIV-037",
        "ARIA-STATE-038",
        "COG-013",
        "COG-014",
        "FORCED-COLORS-001",
        "KBD-PANEL-FOCUS",
        "KBD-TRAP-EDITOR",
        "LINK-NEW-WINDOW",
        "LIVE-FILTER-004",
        "LIVE-RAW-001",
        "MONACO-THEME-001",
        "REFLOW-004"
      ]
    },
    {
      "component": "ModalDialog",
      "count": 14,
      "worst": "serious",
      "rules": [
        "ARIA-DESC-018",
        "ARIA-NAME-017",
        "ARIA-NAME-021",
        "COG-003",
        "CONTRAST-TEXT-008",
        "FORM-PREVENT-001",
        "KBD-SCROLL-REGION",
        "LIVE-FILTER-003",
        "LIVE-VALID-001",
        "MODAL-CONFIRM-NOT-ALERTDIALOG",
        "MODAL-FOOTER-REVERSED-ORDER",
        "MODAL-INITIAL-FOCUS",
        "RT-MODAL-NAME",
        "SEM-TABS-001"
      ]
    },
    {
      "component": "ToastProvider",
      "count": 9,
      "worst": "critical",
      "rules": [
        "ARIA-LIVE-012",
        "COG-001",
        "COLOR-ONLY-002",
        "KBD-STICKY-OBSCURES",
        "LIVE-TOAST-001",
        "LIVE-TOAST-002",
        "LIVE-TOAST-003",
        "LIVE-TOAST-004",
        "NONTEXT-CONTRAST-002"
      ]
    },
    {
      "component": "DiffModal",
      "count": 9,
      "worst": "serious",
      "rules": [
        "ARIA-NAME-024",
        "ARIA-SEM-022",
        "COLOR-ONLY-001",
        "CONTRAST-TEXT-002",
        "MODAL-DIFF-INITIAL-FOCUS",
        "MODAL-DIFF-SCROLL-REGION",
        "REFLOW-002",
        "SEM-DIFF-001",
        "SEM-DIV-BUTTON-002"
      ]
    },
    {
      "component": "SelectedFileHeader",
      "count": 9,
      "worst": "serious",
      "rules": [
        "ARIA-DESC-011",
        "ARIA-SEM-010",
        "COG-009",
        "COG-015",
        "COG-023",
        "HEAD-001",
        "KBD-FOCUS-LOST-DISABLED",
        "LIVE-DIRTY-001",
        "LIVE-VALID-003"
      ]
    },
    {
      "component": "ConfigEditor",
      "count": 8,
      "worst": "serious",
      "rules": [
        "ARIA-KBD-043",
        "ARIA-TREE-042",
        "CONTRAST-TEXT-010",
        "FORM-LEGACY-001",
        "NONTEXT-CONTRAST-005",
        "TABLE-CAPTION",
        "TABLE-HEADER-TD",
        "TREE-HIERARCHY"
      ]
    },
    {
      "component": "CfgMetatypePropertyDialog",
      "count": 8,
      "worst": "serious",
      "rules": [
        "ARIA-NAME-026",
        "CONTRAST-TEXT-009",
        "FORM-ERR-003",
        "FORM-NAME-001",
        "LIVE-FILTER-005",
        "LIVE-VALID-002",
        "REFLOW-005",
        "SEM-DIV-BUTTON-003"
      ]
    },
    {
      "component": "ModalDialog createConfig",
      "count": 7,
      "worst": "critical",
      "rules": [
        "COG-005",
        "COG-006",
        "COG-011",
        "FORM-CUSTOM-001",
        "FORM-ERR-002",
        "FORM-REDUNDANT-001",
        "FORM-REQ-002"
      ]
    },
    {
      "component": "CfgEditor row",
      "count": 6,
      "worst": "critical",
      "rules": [
        "FORM-AUTOFILL-001",
        "FORM-HELP-001",
        "FORM-LABEL-001",
        "FORM-LABEL-002",
        "FORM-REQ-001",
        "FORM-TYPE-001"
      ]
    },
    {
      "component": "CreateOptionCard",
      "count": 4,
      "worst": "critical",
      "rules": [
        "ARIA-KBD-016",
        "CONTRAST-TEXT-001",
        "SEM-DIV-BUTTON-001",
        "STATE-INDICATOR-001"
      ]
    },
    {
      "component": "StatusBanner",
      "count": 3,
      "worst": "serious",
      "rules": [
        "ARIA-LIVE-013",
        "LIVE-ERR-001",
        "NONTEXT-CONTRAST-004"
      ]
    },
    {
      "component": "ConfigStateBadge",
      "count": 3,
      "worst": "serious",
      "rules": [
        "ARIA-NAME-005",
        "IMG-ICON-001",
        "KBD-TOOLTIP-NONFOCUSABLE"
      ]
    },
    {
      "component": "useFileActions",
      "count": 3,
      "worst": "serious",
      "rules": [
        "COG-002",
        "COG-004",
        "COG-008"
      ]
    },
    {
      "component": "LeafRow",
      "count": 3,
      "worst": "serious",
      "rules": [
        "TABLE-CELL-CONTROL-NAME",
        "TABLE-INLINE-EDIT",
        "TABLE-ROW-HEADER"
      ]
    },
    {
      "component": "OverflowPreviewText",
      "count": 3,
      "worst": "moderate",
      "rules": [
        "ARIA-HOVER-041",
        "KBD-HOVER-ONLY",
        "REFLOW-003"
      ]
    },
    {
      "component": "App layout",
      "count": 2,
      "worst": "critical",
      "rules": [
        "RT-REFLOW-320",
        "RT-REFLOW-CLIP"
      ]
    },
    {
      "component": "CfgEditorFooter",
      "count": 2,
      "worst": "serious",
      "rules": [
        "ARIA-STATE-034",
        "CONTRAST-TEXT-004"
      ]
    },
    {
      "component": "AutoResizeTextArea",
      "count": 2,
      "worst": "serious",
      "rules": [
        "FOCUS-VISIBLE-001",
        "TEXT-SPACING-001"
      ]
    },
    {
      "component": "ModalDialog prompt",
      "count": 2,
      "worst": "serious",
      "rules": [
        "FORM-LABEL-007",
        "RT-FOCUS-PROMPT-LOST"
      ]
    },
    {
      "component": "useDialogA11y",
      "count": 2,
      "worst": "serious",
      "rules": [
        "KBD-DIALOG-FOCUS-RESET",
        "MODAL-CUSTOM-BACKGROUND-NOT-INERT"
      ]
    },
    {
      "component": "CfgEditorHeader",
      "count": 2,
      "worst": "serious",
      "rules": [
        "SEM-TABLE-001",
        "TABLE-HEADER-TD"
      ]
    },
    {
      "component": "InlineLoader",
      "count": 2,
      "worst": "moderate",
      "rules": [
        "ARIA-LIVE-014",
        "LIVE-LOAD-001"
      ]
    },
    {
      "component": "AppHeaderBar",
      "count": 2,
      "worst": "moderate",
      "rules": [
        "ARIA-ROLE-009",
        "LAND-002"
      ]
    },
    {
      "component": "Visual editor save",
      "count": 2,
      "worst": "moderate",
      "rules": [
        "FORM-ERR-005",
        "FORM-ERR-006"
      ]
    },
    {
      "component": "SearchInput usage",
      "count": 2,
      "worst": "moderate",
      "rules": [
        "FORM-SEARCH-001",
        "FORM-SEARCH-002"
      ]
    }
  ],
  "score": 62,
  "grade": "D",
  "penalty": 581,
  "checks": 306,
  "generated": "2026-10-29",
  "template": "web"
}
```
