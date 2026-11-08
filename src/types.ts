export type CardStyle = "callout" | "plain";

export interface NeteaseSettings {
	/** Download the cover into the vault instead of linking to the remote image. */
	saveCoverToVault: boolean;
	/** Vault-relative folder used for downloaded covers. Empty means vault root. */
	coverFolder: string;
	/** Width of the cover image inside the card. 0 means original size. */
	coverWidth: number;
	cardStyle: CardStyle;
	showAlbum: boolean;
	showOpenLink: boolean;
	/** When true, share text around a pasted URL is discarded. */
	cleanShareText: boolean;
}

export const DEFAULT_SETTINGS: NeteaseSettings = {
	saveCoverToVault: true,
	coverFolder: "attachments/netease",
	coverWidth: 200,
	cardStyle: "callout",
	showAlbum: true,
	showOpenLink: true,
	cleanShareText: true,
};

export interface NeteaseSong {
	id: string;
	name: string;
	artists: string[];
	album: string;
	coverUrl: string;
	pageUrl: string;
}

export interface SongLink {
	kind: "song" | "short";
	url: string;
	start: number;
	end: number;
	/** Present for full song URLs, resolved later for short links. */
	id?: string;
}
