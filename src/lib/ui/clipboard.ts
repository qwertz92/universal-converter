/**
 * Clipboard helper with a graceful fallback for non-secure contexts. Returns a
 * boolean so callers can flash a "copied" confirmation.
 */

export async function copyText(text: string): Promise<boolean> {
	if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			/* fall through to legacy path */
		}
	}
	// Legacy fallback (older browsers / http): a hidden textarea + execCommand.
	if (typeof document === 'undefined') return false;
	try {
		const ta = document.createElement('textarea');
		ta.value = text;
		ta.setAttribute('readonly', '');
		ta.style.position = 'absolute';
		ta.style.left = '-9999px';
		document.body.appendChild(ta);
		ta.select();
		const ok = document.execCommand('copy');
		document.body.removeChild(ta);
		return ok;
	} catch {
		return false;
	}
}
