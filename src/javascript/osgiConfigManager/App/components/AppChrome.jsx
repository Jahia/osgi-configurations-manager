import React from 'react';
import {createPortal} from 'react-dom';
import {Information, Typography, Warning} from '@jahia/moonstone';

export const CHROME_TOKENS = {
    panelPadding: '16px',
    panelGap: '16px',
    sectionGap: '10px',
    subtleTextColor: 'var(--color-gray_dark60)',
    strongTextColor: 'var(--color-dark)',
    panelBorderColor: 'var(--color-gray_light40)',
    subtleSurfaceColor: 'var(--color-gray_light_plain20)',
    panelBackgroundColor: 'var(--color-white)',
    tooltipBackgroundColor: 'var(--color-dark)',
    tooltipTextColor: 'var(--color-light)',
    selectionColor: 'var(--color-accent_light_plain20)'
};

export const APP_LAYOUT_STYLE = {
    display: 'flex',
    height: '100%',
    overflow: 'hidden',
    padding: CHROME_TOKENS.panelPadding,
    gap: CHROME_TOKENS.panelGap,
    minWidth: 0
};

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
    whiteSpace: 'nowrap',
    fontSize: '0.875rem',
    boxShadow: '0 2px 5px var(--color-dark20)',
    pointerEvents: 'none'
};

export const getFileStatusIndicatorStyle = enabled => ({
    width: '3px',
    height: '100%',
    backgroundColor: enabled ? 'var(--color-success)' : 'var(--color-gray40)',
    flexShrink: 0
});

const BANNER_VARIANTS = {
    error: {
        background: 'var(--color-danger_plain20)',
        border: 'var(--color-danger40)',
        iconColor: 'var(--color-danger)'
    },
    warning: {
        background: 'var(--color-warning_plain20)',
        border: 'var(--color-warning40)',
        iconColor: 'var(--color-warning)'
    },
    info: {
        background: 'var(--color-accent_light_plain20)',
        border: 'var(--color-accent_light_plain60)',
        iconColor: 'var(--color-accent_dark)'
    }
};

export const InlineLoader = ({label}) => (
    <div role="status" aria-label={label} style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: CHROME_TOKENS.sectionGap, color: CHROME_TOKENS.subtleTextColor}}>
        <div
            aria-hidden="true"
            className="osgi-config-manager-spinner"
            style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                border: '2px solid var(--color-gray_light60)',
                borderTopColor: 'var(--color-accent)',
                animation: 'osgi-config-manager-spin 0.8s linear infinite',
                flexShrink: 0
            }}
        />
        {label && <Typography variant="body">{label}</Typography>}
    </div>
);

export const StatusBanner = ({tone = 'info', message, dataCy}) => {
    const variant = BANNER_VARIANTS[tone] || BANNER_VARIANTS.info;
    const icon = tone === 'info' ? <Information size="small" style={{color: variant.iconColor, flexShrink: 0}}/> : <Warning size="small" style={{color: variant.iconColor, flexShrink: 0}}/>;

    return (
        <div
            data-cy={dataCy}
            role={tone === 'error' ? 'alert' : 'status'}
            aria-live={tone === 'error' ? 'assertive' : 'polite'}
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
            {icon}
            <Typography>{message}</Typography>
        </div>
    );
};

export const OverflowPreviewText = ({
    text,
    dataCy,
    showPreview = true,
    typographyProps = {},
    textStyle = {},
    wrapperStyle = {}
}) => {
    const textRef = React.useRef(null);
    const [previewPosition, setPreviewPosition] = React.useState(null);

    const hidePreview = React.useCallback(() => setPreviewPosition(null), []);

    const showPreviewIfNeeded = React.useCallback(event => {
        if (!showPreview) {
            hidePreview();
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
        setPreviewPosition({
            top: rect.top,
            left: rect.left + 20
        });
    }, [hidePreview, showPreview]);

    React.useEffect(() => {
        if (!previewPosition) {
            return undefined;
        }

        window.addEventListener('scroll', hidePreview, true);
        return () => window.removeEventListener('scroll', hidePreview, true);
    }, [hidePreview, previewPosition]);

    return (
        <div
            data-cy={dataCy}
            onMouseEnter={showPreviewIfNeeded}
            onMouseLeave={hidePreview}
            style={{position: 'relative', minWidth: 0, ...wrapperStyle}}
        >
            <Typography
                {...typographyProps}
                isNowrap
                ref={textRef}
                style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    ...textStyle
                }}
            >
                {text}
            </Typography>
            {previewPosition && createPortal(
                <div
                    data-cy="floating-text-preview"
                    style={{
                        ...FLOATING_TOOLTIP_STYLE,
                        top: previewPosition.top,
                        left: previewPosition.left
                    }}
                >
                    {text}
                </div>,
                document.body
            )}
        </div>
    );
};
