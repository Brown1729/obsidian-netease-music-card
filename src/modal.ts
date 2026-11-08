import { App, Modal, Notice } from "obsidian";
import { extractSongLinks } from "./links";
import type { SongLink } from "./types";

export class InsertSongModal extends Modal {
	private readonly initialValue: string;
	private readonly onSubmit: (value: string, links: SongLink[]) => void;
	private inputEl!: HTMLInputElement;

	constructor(
		app: App,
		initialValue: string,
		onSubmit: (value: string, links: SongLink[]) => void,
	) {
		super(app);
		this.initialValue = initialValue;
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		this.titleEl.setText("插入网易云歌曲");

		const { contentEl } = this;
		contentEl.createEl("p", {
			text: "粘贴网易云音乐歌曲链接或分享文案：",
		});

		this.inputEl = contentEl.createEl("input");
		this.inputEl.type = "text";
		this.inputEl.addClass("netease-link-input");
		this.inputEl.placeholder =
			"https://music.163.com/song?id=421807904";
		this.inputEl.value = this.initialValue;

		const actions = contentEl.createDiv({ cls: "modal-button-container" });

		const cancelButton = actions.createEl("button", { text: "取消" });
		cancelButton.addEventListener("click", () => this.close());

		const submitButton = actions.createEl("button", {
			text: "插入",
			cls: "mod-cta",
		});
		submitButton.addEventListener("click", () => this.submit());

		this.inputEl.addEventListener("keydown", (event) => {
			if (event.key === "Enter" && !event.isComposing) {
				event.preventDefault();
				this.submit();
			}
		});

		window.setTimeout(() => {
			this.inputEl.focus();
			this.inputEl.select();
		}, 0);
	}

	private submit(): void {
		const value = this.inputEl.value;
		const links = extractSongLinks(value);

		if (links.length === 0) {
			new Notice("没有找到网易云歌曲链接");
			return;
		}

		this.close();
		this.onSubmit(value, links);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
