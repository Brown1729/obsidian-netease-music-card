import { MarkdownView, Notice, Plugin } from "obsidian";
import type { Editor, Menu } from "obsidian";
import { buildSongCard } from "./card";
import { extractSongLinks, isShareText } from "./links";
import { InsertSongModal } from "./modal";
import {
	fetchSong,
	resolveShortLink,
	saveCoverToVault,
} from "./netease";
import { NeteaseMusicCardSettingTab } from "./settings";
import { DEFAULT_SETTINGS } from "./types";
import type { NeteaseSettings, NeteaseSong, SongLink } from "./types";

async function readClipboardText(): Promise<string> {
	try {
		return await navigator.clipboard.readText();
	} catch {
		return "";
	}
}

function errorMessage(error: unknown): string {
	if (error instanceof Error && error.message) {
		return error.message;
	}
	return String(error);
}

export default class NeteaseMusicCardPlugin extends Plugin {
	settings: NeteaseSettings = { ...DEFAULT_SETTINGS };

	private readonly songRequests = new Map<string, Promise<NeteaseSong>>();
	private readonly coverRequests = new Map<string, Promise<string | null>>();

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new NeteaseMusicCardSettingTab(this.app, this));

		this.registerEvent(
			this.app.workspace.on("editor-paste", (event, editor) => {
				this.handlePaste(event, editor);
			}),
		);

		this.registerEvent(
			this.app.workspace.on(
				"editor-menu",
				(menu: Menu, editor: Editor) => {
					menu.addItem((item) => {
						item.setTitle("插入网易云歌曲")
							.setIcon("music")
							.onClick(() => {
								void this.openInsertModal(editor);
							});
					});
				},
			),
		);

		this.addRibbonIcon("music", "插入网易云歌曲", () => {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!view) {
				new Notice("请先打开一个 Markdown 笔记");
				return;
			}
			void this.openInsertModal(view.editor);
		});

		this.addCommand({
			id: "insert-netease-song",
			name: "插入网易云歌曲",
			editorCallback: (editor) => {
				void this.openInsertModal(editor);
			},
		});

		this.addCommand({
			id: "convert-selected-netease-links",
			name: "把选中的网易云链接转换为卡片",
			editorCallback: (editor) => {
				this.convertSelection(editor);
			},
		});
	}

	private async openInsertModal(editor: Editor): Promise<void> {
		const clipboard = (await readClipboardText()).trim();
		const initialValue = extractSongLinks(clipboard).length > 0 ? clipboard : "";
		new InsertSongModal(this.app, initialValue, (value, links) => {
			this.insertLinks(editor, value, links);
		}).open();
	}

	private convertSelection(editor: Editor): void {
		const selection = editor.getSelection();
		if (!selection) {
			new Notice("请先选中要转换的网易云链接");
			return;
		}

		const links = extractSongLinks(selection);
		if (links.length === 0) {
			new Notice("选中文本中没有网易云歌曲链接");
			return;
		}

		this.insertLinks(editor, selection, links);
	}

	private handlePaste(event: ClipboardEvent, editor: Editor): void {
		const text = event.clipboardData?.getData("text/plain");
		if (!text) {
			return;
		}

		const links = extractSongLinks(text);
		if (links.length === 0) {
			return;
		}

		event.preventDefault();
		this.insertLinks(editor, text, links);
	}

	/**
	 * Replaces each URL with a unique hidden marker immediately, then swaps
	 * the marker for the finished card once metadata and cover are ready.
	 * This keeps the cursor in place and avoids blocking the paste event.
	 */
	private insertLinks(
		editor: Editor,
		rawText: string,
		links: SongLink[],
	): void {
		const nonce = `${Date.now().toString(36)}${Math.random()
			.toString(36)
			.slice(2, 8)}`;

		const pending = links.map((link, index) => ({
			link,
			token: `%%netease-pending-${nonce}-${index}%%`,
		}));

		const removeShareText =
			this.settings.cleanShareText && isShareText(rawText, links);

		let insertion: string;
		if (removeShareText) {
			insertion = pending.map(({ token }) => token).join("\n\n");
		} else {
			let result = "";
			let cursor = 0;
			for (const { link, token } of pending) {
				result += rawText.slice(cursor, link.start);
				result += token;
				cursor = link.end;
			}
			result += rawText.slice(cursor);
			insertion = result;
		}

		editor.replaceSelection(this.asBlockInsertion(editor, insertion));

		for (const { link, token } of pending) {
			void this.processLink(editor, token, link);
		}
	}

	/**
	 * A callout only renders at the start of a line. When the cursor is in
	 * the middle of existing text, pad the card with blank lines so it forms
	 * its own block instead of breaking the surrounding paragraph.
	 */
	private asBlockInsertion(editor: Editor, insertion: string): string {
		const from = editor.getCursor("from");
		const to = editor.getCursor("to");
		const before = editor.getLine(from.line).slice(0, from.ch);
		const after = editor.getLine(to.line).slice(to.ch);

		let result = insertion;
		if (before.trim().length > 0 && !result.startsWith("\n")) {
			result = `\n\n${result}`;
		}
		if (after.trim().length > 0 && !result.endsWith("\n")) {
			result = `${result}\n\n`;
		}
		return result;
	}

	private async processLink(
		editor: Editor,
		token: string,
		link: SongLink,
	): Promise<void> {
		try {
			const id = link.id ?? (await resolveShortLink(link.url));
			if (!id) {
				throw new Error("无法解析歌曲 ID");
			}

			const song = await this.getSong(id);

			let coverPath: string | null = null;
			if (this.settings.saveCoverToVault && song.coverUrl) {
				try {
					coverPath = await this.getCoverPath(song);
				} catch (error) {
					console.error("[netease-music-card] cover download failed", error);
					new Notice("封面保存失败，卡片将使用网易云远程图片。");
				}
			}

			const card = buildSongCard(song, this.settings, coverPath);
			this.replaceToken(editor, token, card);
		} catch (error) {
			console.error("[netease-music-card] failed to insert song", error);
			this.replaceToken(editor, token, link.url);
			new Notice(`网易云歌曲获取失败：${errorMessage(error)}`);
		}
	}

	private getSong(id: string): Promise<NeteaseSong> {
		let request = this.songRequests.get(id);
		if (!request) {
			request = fetchSong(id);
			this.songRequests.set(id, request);
			request.catch(() => {
				this.songRequests.delete(id);
			});
		}
		return request;
	}

	private getCoverPath(song: NeteaseSong): Promise<string | null> {
		const key = `${this.settings.coverFolder}\u0000${song.id}`;
		let request = this.coverRequests.get(key);
		if (!request) {
			request = saveCoverToVault(
				this.app,
				song,
				this.settings.coverFolder,
			);
			this.coverRequests.set(key, request);
			request.catch(() => {
				this.coverRequests.delete(key);
			});
		}
		return request;
	}

	private replaceToken(editor: Editor, token: string, replacement: string): void {
		const content = editor.getValue();
		const offsets: number[] = [];

		let offset = content.indexOf(token);
		while (offset !== -1) {
			offsets.push(offset);
			offset = content.indexOf(token, offset + token.length);
		}

		// Replace from the end so earlier offsets stay valid.
		for (const start of offsets.reverse()) {
			editor.replaceRange(
				replacement,
				editor.offsetToPos(start),
				editor.offsetToPos(start + token.length),
			);
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
