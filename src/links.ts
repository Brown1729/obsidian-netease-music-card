import type { SongLink } from "./types";

/**
 * URLs are matched conservatively: trailing quotes and punctuation are not
 * included. NetEase share text often looks like
 * `分享单曲《...》: https://music.163.com/song?id=... (来自@网易云音乐)`
 */
const URL_RE = /https?:\/\/[^\s<>"'“”‘’()（）。，；！？、【】]+/gi;

function trimTrailingPunctuation(value: string): string {
	// Share text is sometimes glued directly to the URL, e.g.
	// `https://music.163.com/song?id=1来自网易云音乐`. URLs themselves are
	// ASCII, so stripping trailing non-ASCII characters is safe here.
	return value.replace(/[^\x21-\x7e]+$/, "").replace(/[.,;!?]+$/, "");
}

function parseLink(url: string, start: number, end: number): SongLink | null {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return null;
	}

	const host = parsed.hostname.toLowerCase();

	// Short links created by the NetEase app. The real song id is resolved
	// by following the redirect later.
	if (host === "163cn.tv" || host.endsWith(".163cn.tv")) {
		return { kind: "short", url, start, end };
	}

	if (host !== "music.163.com" && !host.endsWith(".music.163.com")) {
		return null;
	}

	const path = parsed.pathname.toLowerCase();
	const hash = parsed.hash.toLowerCase();
	if (!path.includes("/song") && !hash.includes("/song")) {
		return null;
	}

	let id = parsed.searchParams.get("id") ?? undefined;

	const pathMatch = parsed.pathname.match(/\/song\/(\d+)/i);
	if (pathMatch) {
		id = pathMatch[1];
	}

	if (!id && parsed.hash.includes("?")) {
		const hashParams = new URLSearchParams(
			parsed.hash.slice(parsed.hash.indexOf("?") + 1),
		);
		id = hashParams.get("id") ?? undefined;
	}

	if (!id || !/^\d+$/.test(id)) {
		return null;
	}

	return { kind: "song", url, start, end, id };
}

/**
 * Finds every supported NetEase song URL in a piece of text while keeping
 * its offsets, so surrounding text can be preserved.
 */
export function extractSongLinks(text: string): SongLink[] {
	const links: SongLink[] = [];
	let match: RegExpExecArray | null;

	URL_RE.lastIndex = 0;
	while ((match = URL_RE.exec(text)) !== null) {
		const raw = trimTrailingPunctuation(match[0]);
		const start = match.index;
		const end = start + raw.length;
		const link = parseLink(raw, start, end);
		if (link) {
			links.push(link);
		}
	}

	return links;
}

/**
 * A pasted value counts as share text when, after removing its URLs, only a
 * short NetEase share message remains. Ordinary prose is never discarded.
 */
export function isShareText(text: string, links: SongLink[]): boolean {
	if (links.length === 0) {
		return false;
	}

	let rest = text;
	// Remove from the end so earlier offsets stay valid.
	for (const link of [...links].sort((a, b) => b.start - a.start)) {
		rest = rest.slice(0, link.start) + " " + rest.slice(link.end);
	}
	rest = rest.trim();

	if (!rest) {
		return true;
	}

	if (rest.length > 300) {
		return false;
	}

	return /网易云|分享|单曲|netease/i.test(rest);
}

/**
 * Extracts a song id from a redirect header or from the HTML of a resolved
 * NetEase page. Used for 163cn.tv short links.
 */
export function extractSongIdFromText(text: string): string | undefined {
	const patterns = [
		/(?:music\.163\.com|y\.music\.163\.com)[^"'<>\s]*?[?&]id=(\d+)/i,
		/"songId"\s*:\s*(\d+)/i,
		/song%3Fid%3D(\d+)/i,
	];

	for (const pattern of patterns) {
		const match = text.match(pattern);
		if (match?.[1]) {
			return match[1];
		}
	}

	return undefined;
}
