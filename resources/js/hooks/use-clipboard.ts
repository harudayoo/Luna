// Credit: https://usehooks-ts.com/
import { useState } from 'react';

export type CopiedValue = string | null;
export type CopyFn = (text: string) => Promise<boolean>;
export type UseClipboardReturn = [CopiedValue, CopyFn];

/**
 * Browsers only offer navigator.clipboard on HTTPS or localhost. The office server is plain
 * http://ocsph-wkst-005:8001, so fall back to the older select-and-copy command, which still works there.
 */
function legacyCopy(text: string): boolean {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.top = '0';
    field.style.left = '0';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    field.setSelectionRange(0, text.length);

    try {
        return document.execCommand('copy');
    } catch {
        return false;
    } finally {
        document.body.removeChild(field);
    }
}

export function useClipboard(): UseClipboardReturn {
    const [copiedText, setCopiedText] = useState<CopiedValue>(null);

    const copy: CopyFn = async (text) => {
        let ok = false;

        if (navigator?.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(text);
                ok = true;
            } catch {
                ok = false;
            }
        }

        if (!ok) {
            ok = legacyCopy(text);
        }

        setCopiedText(ok ? text : null);

        return ok;
    };

    return [copiedText, copy];
}
