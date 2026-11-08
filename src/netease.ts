import { normalizePath, requestUrl, TFile } from "obsidian";
import type { App } from "obsidian";
import { extractSongIdFromText } from "./links";
import type { NeteaseSong } from "./types";

const MUSIC_HEADERS: Record<string, string> = {
	"User-Agent":
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	Referer: "https://music.163.com/",
};

interface RawArtist {
	name?: string;
}

interface RawAlbum {
	name?: string;
	picUrl?: string;
}

interface RawSong {
	id?: string | number;
	name?: string;
	artists?: RawArtist[];
	ar?: RawArtist[];
	album?: RawAlbum;
	al?: RawAlbum;
	picUrl?: string;
}

interface SongDetailResponse {
	songs?: RawSong[];
}

const COVER_EXTENSIONS = ["jpg", "png", "webp", "gif"] as const;

function getHeader(headers: Record<string, string>, name: string): string | undefined {
	const key = Object.keys(headers).find(
		(header) => header.toLowerCase() === name.toLowerCase(),
	);
	return key ? headers[key] : undefined;
}

function normalizeCoverUrl(url: string): string {
	const trimmed = url.trim();
	if (!trimmed) {
		return "";
	}

	const absolute = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
	return absolute.replace(/^http:\/\//i, "https://");
}

function decodeHtmlEntities(value: string): string {
	const named: Record<string, string> = {
		amp: "&",
		lt: "<",
		gt: ">",
		quot: '"',
		apos: "'",
		nbsp: " ",
	};

	return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
		if (code.startsWith("#")) {
			const hexadecimal = code[1]?.toLowerCase() === "x";
			const number = Number.parseInt(
				hexadecimal ? code.slice(2) : code.slice(1),
				hexadecimal ? 16 : 10,
			);
			return Number.isFinite(number) ? String.fromCodePoint(number) : match;
		}

		return named[code.toLowerCase()] ?? match;
	});
}

function getMetaContent(html: string, name: string): string | null {
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const tag = html.match(
		new RegExp(`<meta\\b[^>]*(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
	)?.[0];

	if (!tag) {
		return null;
	}

	const content = tag.match(/content=["']([^"']*)["']/i)?.[1];
	return content ?? null;
}

function songFromRaw(raw: RawSong, fallbackId: string): NeteaseSong | null {
	const name = typeof raw.name === "string" ? raw.name.trim() : "";
	if (!name) {
		return null;
	}

	const artists = (raw.artists ?? raw.ar ?? [])
		.map((artist) => (typeof artist?.name === "string" ? artist.name : ""))
		.map((artist) => artist.trim())
		.filter(Boolean);

	const album = raw.album ?? raw.al;
	const id = raw.id === undefined ? fallbackId : String(raw.id);

	return {
		id,
		name,
		artists,
		album: typeof album?.name === "string" ? album.name : "",
		coverUrl: normalizeCoverUrl(album?.picUrl ?? raw.picUrl ?? ""),
		pageUrl: `https://music.163.com/song?id=${id}`,
	};
}

async function fetchSongFromPage(id: string): Promise<NeteaseSong> {
	const pageUrl = `https://music.163.com/song?id=${id}`;
	const response = await requestUrl({
		url: pageUrl,
		headers: MUSIC_HEADERS,
		throw: false,
	});

	if (response.status < 200 || response.status >= 300) {
		throw new Error(`歌曲页面请求失败（HTTP ${response.status}）`);
	}

	const html = response.text;
	const ogTitle = decodeHtmlEntities(getMetaContent(html, "og:title") ?? "");
	const fallbackTitle = decodeHtmlEntities(
		html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "",
	)
		.split(" - ")[0]
		.trim();
	const name = ogTitle || fallbackTitle;

	if (!name) {
		throw new Error("无法解析歌曲名称");
	}

	const description = decodeHtmlEntities(
		getMetaContent(html, "og:description") ?? "",
	);
	const artistMatch = description.match(/由\s*(.+?)\s*演唱/);
	const albumMatch = description.match(/收录于《(.+?)》/);
	const coverUrl = normalizeCoverUrl(
		decodeHtmlEntities(getMetaContent(html, "og:image") ?? ""),
	);

	return {
		id,
		name,
		artists: artistMatch ? [artistMatch[1].trim()] : [],
		album: albumMatch ? albumMatch[1].trim() : "",
		coverUrl,
		pageUrl,
	};
}

/**
 * Fetches song metadata from the public song detail endpoint, falling back to
 * the song page's Open Graph metadata if that endpoint is unavailable.
 */
export async function fetchSong(id: string): Promise<NeteaseSong> {
	const detailUrl =
		"https://music.163.com/api/song/detail/?" +
		`id=${encodeURIComponent(id)}&ids=${encodeURIComponent(`[${id}]`)}`;

	try {
		const response = await requestUrl({
			url: detailUrl,
			headers: MUSIC_HEADERS,
			throw: false,
		});
		if (response.status >= 200 && response.status < 300) {
			const data = response.json as SongDetailResponse;
			const raw = Array.isArray(data?.songs) ? data.songs[0] : undefined;
			if (raw) {
				const song = songFromRaw(raw, id);
				if (song) {
					return song;
				}
			}
		}
	} catch (error) {
		console.warn("[netease-music-card] song detail API failed", error);
	}

	return fetchSongFromPage(id);
}

/**
 * Resolves a 163cn.tv short link into a song id.
 */
export async function resolveShortLink(shortUrl: string): Promise<string | null> {
	const response = await requestUrl({
		url: shortUrl,
		headers: MUSIC_HEADERS,
		throw: false,
	});

	const locationHeader = getHeader(response.headers, "location");
	const fromHeader = locationHeader
		? extractSongIdFromText(locationHeader) ??
			locationHeader.match(/[?&]id=(\d+)/)?.[1]
		: undefined;
	if (fromHeader) {
		return fromHeader;
	}

	return extractSongIdFromText(response.text) ?? null;
}

function normalizeCoverFolder(value: string): string {
	const cleaned = value
		.trim()
		.replace(/\\/g, "/")
		.replace(/^\/+|\/+$/g, "");

	if (!cleaned || cleaned === ".") {
		return "";
	}

	return normalizePath(cleaned);
}

async function ensureFolder(app: App, folder: string): Promise<void> {
	const parts = folder.split("/").filter(Boolean);
	let current = "";

	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		if (app.vault.getAbstractFileByPath(current)) {
			continue;
		}

		try {
			await app.vault.createFolder(current);
		} catch (error) {
			// Another song may have created the same folder concurrently.
			if (!app.vault.getAbstractFileByPath(current)) {
				throw error;
			}
		}
	}
}

function extensionFor(contentType: string, url: string): string {
	if (contentType.includes("png")) {
		return "png";
	}
	if (contentType.includes("webp")) {
		return "webp";
	}
	if (contentType.includes("gif")) {
		return "gif";
	}

	const urlMatch = url.split("?")[0].match(/\.(jpe?g|png|webp|gif)$/i);
	if (urlMatch) {
		const extension = urlMatch[1].toLowerCase();
		return extension === "jpeg" ? "jpg" : extension;
	}

	return "jpg";
}

function withCoverSize(url: string, size: number): string {
	const parsed = new URL(normalizeCoverUrl(url));
	parsed.searchParams.set("param", `${size}y${size}`);
	return parsed.toString();
}

/**
 * Downloads the song cover into the vault and returns its vault-relative
 * path. Existing files are reused, so repeated pastes do not download again.
 */
export async function saveCoverToVault(
	app: App,
	song: NeteaseSong,
	folderSetting: string,
): Promise<string | null> {
	if (!song.coverUrl) {
		return null;
	}

	const folder = normalizeCoverFolder(folderSetting);
	if (folder) {
		await ensureFolder(app, folder);
	}

	const basePath = folder ? `${folder}/${song.id}` : song.id;

	for (const extension of COVER_EXTENSIONS) {
		const existingPath = `${basePath}.${extension}`;
		if (app.vault.getAbstractFileByPath(existingPath) instanceof TFile) {
			return existingPath;
		}
	}

	const response = await requestUrl({
		url: withCoverSize(song.coverUrl, 600),
		headers: MUSIC_HEADERS,
		throw: false,
	});

	if (response.status < 200 || response.status >= 300) {
		throw new Error(`封面下载失败（HTTP ${response.status}）`);
	}

	const contentType = (
		getHeader(response.headers, "content-type") ?? ""
	).toLowerCase();
	if (contentType && !contentType.startsWith("image/")) {
		throw new Error(`封面下载失败（返回类型：${contentType}）`);
	}

	const extension = extensionFor(contentType, song.coverUrl);
	const coverPath = `${basePath}.${extension}`;

	if (app.vault.getAbstractFileByPath(coverPath) instanceof TFile) {
		return coverPath;
	}

	try {
		await app.vault.createBinary(coverPath, response.arrayBuffer);
	} catch (error) {
		// A concurrent paste of the same song may have created it first.
		if (app.vault.getAbstractFileByPath(coverPath) instanceof TFile) {
			return coverPath;
		}
		throw error;
	}

	return coverPath;
}
