import React from 'react';
import {createPortal} from 'react-dom';
import {Information, Report, Typography, Warning} from '@jahia/moonstone';
import {useTranslation} from 'react-i18next';

export const CHROME_TOKENS = {
    panelPadding: '16px',
    panelGap: '16px',
    sectionGap: '10px',
    // gray_dark at 60% was 3.82:1 on white (WCAG 1.4.3); at 80%, 7:1. A browser without color-mix
    // drops the declaration and the text inherits the dark colour.
    subtleTextColor: 'color-mix(in srgb, var(--color-gray_dark) 80%, var(--color-white))',
    strongTextColor: 'var(--color-dark)',
    panelBorderColor: 'var(--color-gray_light40)',
    subtleSurfaceColor: 'var(--color-gray_light_plain20)',
    panelBackgroundColor: 'var(--color-white)',
    tooltipBackgroundColor: 'var(--color-dark)',
    tooltipTextColor: 'var(--color-light)',
    selectionColor: 'var(--color-accent_light_plain20)'
};

// Jahia's LayoutContent sizes itself to its content's max-content width, so a long file path
// widened the whole page to ~1060px and pushed Save, Cancel and Delete off-screen below
// ~1420px of window width (WCAG 1.4.10). contain: inline-size makes the module take the width
// it is given instead, and wrapping stacks the file list above the editor when that is narrow.
export const APP_LAYOUT_STYLE = {
    display: 'flex',
    flexWrap: 'wrap',
    height: '100%',
    overflow: 'auto',
    contain: 'inline-size',
    padding: CHROME_TOKENS.panelPadding,
    gap: CHROME_TOKENS.panelGap,
    minWidth: 0
};

// The sidebar keeps its 350px when there is room; the editor's large grow factor gives it
// all the remaining width, and the pair wraps once the editor would fall under 420px.
export const SIDEBAR_PANE_FLEX = {flex: '1 1 350px', minWidth: 0};
export const EDITOR_PANE_FLEX = {flex: '999 1 420px', minWidth: 0};

export const PANEL_STYLE = {
    display: 'flex',
    flexDirection: 'column',
    padding: CHROME_TOKENS.panelPadding,
    background: CHROME_TOKENS.panelBackgroundColor
};

export const PANEL_HEADER_STYLE = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: '56px',
    marginBottom: '12px',
    paddingBottom: '12px',
    borderBottom: `1px solid ${CHROME_TOKENS.panelBorderColor}`
};

export const PANEL_ACTIONS_STYLE = {
    display: 'flex',
    gap: CHROME_TOKENS.sectionGap,
    alignItems: 'center'
};

export const EMPTY_STATE_STYLE = {
    display: 'flex',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: '20px',
    color: CHROME_TOKENS.subtleTextColor
};

export const SEARCH_SECTION_STYLE = {
    backgroundColor: CHROME_TOKENS.subtleSurfaceColor,
    padding: '10px',
    borderRadius: '4px',
    marginBottom: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
};

export const FLOATING_TOOLTIP_STYLE = {
    position: 'fixed',
    padding: '4px 8px',
    backgroundColor: CHROME_TOKENS.tooltipBackgroundColor,
    color: CHROME_TOKENS.tooltipTextColor,
    borderRadius: '4px',
    zIndex: 1000000,
    // Wraps rather than running off the screen at 320px (WCAG 1.4.10).
    maxWidth: 'calc(100vw - 32px)',
    overflowWrap: 'anywhere',
    fontSize: '0.875rem',
    boxShadow: '0 2px 5px var(--color-dark20)',
    pointerEvents: 'none'
};

// Text that only assistive technologies read, for a state the screen shows by colour or icon.
export const VISUALLY_HIDDEN_STYLE = {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0
};

// A filled dot for an enabled file, a hollow ring for a disabled one, so that the two differ by
// shape and not by colour only (WCAG 1.4.1). Both are drawn with a border, not a background, so
// that they stay in forced colours. The green halfway between success and success_dark is 3.5:1
// on white, where the former light green bar was 2.35:1 (WCAG 1.4.11); on the selected row, whose
// background is dark, the dot is white.
export const getFileStatusIndicatorStyle = (enabled, onDark = false) => {
    const color = onDark ? 'var(--color-white)' : (enabled ? 'color-mix(in srgb, var(--color-success) 50%, var(--color-success_dark))' : 'var(--color-gray)');
    return {
        boxSizing: 'border-box',
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        border: enabled ? `5px solid ${color}` : `2px solid ${color}`,
        flexShrink: 0
    };
};

// One shape per severity, for the banners and the notifications alike: error and warning shared an
// icon and differed by colour only (WCAG 1.4.1). The dark tones are at least 4.5:1 on white and on
// the banners' tinted backgrounds (WCAG 1.4.11).
export const SEVERITY_STYLES = {
    success: {icon: null, color: 'var(--color-success_dark)'},
    error: {icon: Report, color: 'var(--color-danger_dark)'},
    warning: {icon: Warning, color: 'var(--color-warning_dark)'},
    info: {icon: Information, color: 'var(--color-accent_dark)'}
};

// Prefers-reduced-motion, for what CSS cannot reach (scrollIntoView's behaviour).
export const scrollBehavior = () => (
    typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
);

const BANNER_VARIANTS = {
    error: {
        background: 'var(--color-danger_plain20)',
        border: 'var(--color-danger40)'
    },
    warning: {
        background: 'var(--color-warning_plain20)',
        border: 'var(--color-warning40)'
    },
    info: {
        background: 'var(--color-accent_light_plain20)',
        border: 'var(--color-accent_light_plain60)'
    }
};

// Not a live region: the editor pane's status region announces loads that last (index.jsx). The
// spinner is decorative, the label says it; it stops turning under prefers-reduced-motion.
export const InlineLoader = ({label, dataCy}) => (
    <div data-cy={dataCy} style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: CHROME_TOKENS.sectionGap, color: CHROME_TOKENS.subtleTextColor}}>
        <div
            aria-hidden="true"
            className="osgi-spinner"
            style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                border: '2px solid var(--color-gray_light60)',
                borderTopColor: 'var(--color-accent)',
                flexShrink: 0
            }}
        />
        {label && <Typography variant="body">{label}</Typography>}
    </div>
);

// No role of its own: a banner mounted together with its text is not announced reliably, so the
// caller puts it in a live region that is already there (index.jsx).
export const StatusBanner = ({tone = 'info', message, dataCy}) => {
    const {t} = useTranslation('osgi-configurations-manager');
    const variant = BANNER_VARIANTS[tone] || BANNER_VARIANTS.info;
    const severity = SEVERITY_STYLES[tone] || SEVERITY_STYLES.info;
    const Icon = severity.icon;

    return (
        <div
            data-cy={dataCy}
            style={{
                //marginBottom: '20px',
                padding: '10px 12px',
                background: variant.background,
                border: `1px solid ${variant.border}`,
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: CHROME_TOKENS.sectionGap
            }}
        >
            <Icon size="small" aria-hidden="true" focusable="false" style={{color: severity.color, flexShrink: 0}}/>
            {/* The icon's meaning, for screen readers. */}
            <Typography>
                <span style={VISUALLY_HIDDEN_STYLE}>{t(`banner.prefix.${tone}`)} </span>
                {message}
            </Typography>
        </div>
    );
};

const PREVIEW_HIDE_DELAY_MS = 150;

/**
 * A text cut with an ellipsis, whose full text a mouse user sees in a preview on hover.
 *
 * The preview meets WCAG 1.4.13: it can be hovered (the pointer may move onto it without it
 * closing), and Escape dismisses it wherever the focus is, until the pointer leaves. A click on it
 * is a click on the text it covers. It is aria-hidden: the text itself holds the full string.
 * With `wrap`, the text wraps instead of being cut, and there is no preview: the file list does it
 * for the row the keyboard is on, which a hover preview cannot serve.
 */
export const OverflowPreviewText = ({
    text,
    dataCy,
    showPreview = true,
    wrap = false,
    typographyProps = {},
    textStyle = {},
    wrapperStyle = {}
}) => {
    const textRef = React.useRef(null);
    const wrapperRef = React.useRef(null);
    const hideTimerRef = React.useRef(null);
    const dismissedRef = React.useRef(false);
    const [previewPosition, setPreviewPosition] = React.useState(null);

    const cancelHide = React.useCallback(() => {
        window.clearTimeout(hideTimerRef.current);
    }, []);
    const hidePreview = React.useCallback(() => {
        cancelHide();
        setPreviewPosition(null);
    }, [cancelHide]);
    // The pointer crosses from the text onto the preview: leaving one must not close it at once.
    const hidePreviewSoon = React.useCallback(() => {
        cancelHide();
        hideTimerRef.current = window.setTimeout(() => {
            dismissedRef.current = false;
            setPreviewPosition(null);
        }, PREVIEW_HIDE_DELAY_MS);
    }, [cancelHide]);

    const showPreviewIfNeeded = React.useCallback(event => {
        cancelHide();
        if (!showPreview || wrap || dismissedRef.current) {
            return;
        }

        const element = textRef.current || event.currentTarget;
        if (!element) {
            return;
        }

        const isOverflowing = element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight;
        if (!isOverflowing) {
            hidePreview();
            return;
        }

        const rect = element.getBoundingClientRect();
        // Over the text it completes, its own padding aside.
        setPreviewPosition({
            top: rect.top - 4,
            left: rect.left - 8
        });
    }, [cancelHide, hidePreview, showPreview, wrap]);

    React.useEffect(() => {
        if (!previewPosition) {
            return undefined;
        }

        const onKeyDown = event => {
            // Not stopped: the editor and the dialogs still get their Escape.
            if (event.key === 'Escape') {
                dismissedRef.current = true;
                hidePreview();
            }
        };
        window.addEventListener('scroll', hidePreview, true);
        document.addEventListener('keydown', onKeyDown, true);
        return () => {
            window.removeEventListener('scroll', hidePreview, true);
            document.removeEventListener('keydown', onKeyDown, true);
        };
    }, [hidePreview, previewPosition]);

    React.useEffect(() => () => window.clearTimeout(hideTimerRef.current), []);

    const wrapStyle = wrap ? {whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word'} : {overflow: 'hidden', textOverflow: 'ellipsis'};

    return (
        <div
            ref={wrapperRef}
            data-cy={dataCy}
            onMouseEnter={showPreviewIfNeeded}
            onMouseLeave={() => {
                if (!previewPosition) {
                    dismissedRef.current = false;
                }
                hidePreviewSoon();
            }}
            style={{position: 'relative', minWidth: 0, ...wrapperStyle}}
        >
            <Typography
                {...typographyProps}
                isNowrap={!wrap}
                ref={textRef}
                style={{
                    ...wrapStyle,
                    ...textStyle
                }}
            >
                {text}
            </Typography>
            {previewPosition && createPortal(
                <div
                    data-cy="floating-text-preview"
                    aria-hidden="true"
                    style={{
                        ...FLOATING_TOOLTIP_STYLE,
                        pointerEvents: 'auto',
                        cursor: 'pointer',
                        top: previewPosition.top,
                        left: previewPosition.left
                    }}
                    onMouseEnter={cancelHide}
                    onMouseLeave={hidePreviewSoon}
                    // The preview lives under body: a press on it took the focus out of the list, and
                    // the arrow keys then did nothing. It keeps the focus, and the click gives it to the
                    // list as a click on the row itself would.
                    onMouseDown={event => event.preventDefault()}
                    onClick={event => {
                        // React passes a portal's events up to the row too: it would open the file twice.
                        event.stopPropagation();
                        hidePreview();
                        wrapperRef.current?.click();
                        wrapperRef.current?.closest('[tabindex]')?.focus({preventScroll: true});
                    }}
                >
                    {text}
                </div>,
                document.body
            )}
        </div>
    );
};
