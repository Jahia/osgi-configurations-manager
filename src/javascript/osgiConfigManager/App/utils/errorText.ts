/**
 * The text of a failure, to place inside a sentence of the interface ("Could not save: {{error}}.
 * Your changes are still in the editor."): without its final full stop, which would otherwise be
 * doubled, and never empty.
 */
export const errorText = (error: unknown): string => {
    const raw = error instanceof Error ? error.message : String(error ?? '');
    const text = raw.trim().replace(/[.\s]+$/, '');
    return text || 'unknown error';
};
