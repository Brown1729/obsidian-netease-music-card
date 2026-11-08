import type { NeteaseSettings, NeteaseSong } from "./types";

function escapeLinkText(value: string): string {
	return value.replace(/([\\[\]])/g, "\\$1");
}

function singleLine(value: string): string {
	return value.replace(/\s*\r?\n\s*/g, " ").trim();
}

function coverEmbed(
	song: NeteaseSong,
	settings: NeteaseSettings,
	localCoverPath: string | null,
): string {
	if (localCoverPath) {
		const width = Math.round(settings.coverWidth);
		const size = width > 0 ? `|${width}` : "";
		return `![[${localCoverPath}${size}]]`;
	}

	if (song.coverUrl) {
		return `![cover](${song.coverUrl})`;
	}

	return "";
}

/**
 * Builds plain Markdown that renders both in Live Preview and Reading view.
 */
export function buildSongCard(
	song: NeteaseSong,
	settings: NeteaseSettings,
	localCoverPath: string | null,
): string {
	const title = singleLine(song.name) || `网易云音乐歌曲 ${song.id}`;
	const artists = song.artists.map((artist) => singleLine(artist)).filter(Boolean);
	const album = singleLine(song.album);

	const meta: string[] = [];
	if (artists.length > 0) {
		meta.push(artists.join(" / "));
	}
	if (settings.showAlbum && album) {
		meta.push(`《${album}》`);
	}
	const metaLine = meta.join(" · ");

	const embed = coverEmbed(song, settings, localCoverPath);
	const openLink = settings.showOpenLink
		? `[在网易云音乐中打开](${song.pageUrl})`
		: "";

	if (settings.cardStyle === "plain") {
		const blocks: string[] = [];
		if (embed) {
			blocks.push(embed);
		}

		const heading = settings.showOpenLink
			? `**[${escapeLinkText(title)}](${song.pageUrl})**`
			: `**${title}**`;
		const text = [heading, metaLine].filter(Boolean).join("\n");
		blocks.push(text);

		return blocks.join("\n\n");
	}

	const lines = [`> [!netease] ${title}`];

	if (embed) {
		lines.push(">", `> ${embed}`);
	}
	if (metaLine) {
		lines.push(">", `> ${metaLine}`);
	}
	if (openLink) {
		lines.push(">", `> ${openLink}`);
	}

	return lines.join("\n");
}
