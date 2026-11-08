import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type NeteaseMusicCardPlugin from "./main";
import { DEFAULT_SETTINGS } from "./types";

export class NeteaseMusicCardSettingTab extends PluginSettingTab {
	plugin: NeteaseMusicCardPlugin;

	constructor(app: App, plugin: NeteaseMusicCardPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "网易云音乐卡片" });

		new Setting(containerEl)
			.setName("保存封面到本地")
			.setDesc(
				"把歌曲封面下载到仓库中。关闭后，卡片会直接引用网易云的远程图片地址。",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.saveCoverToVault)
					.onChange(async (value) => {
						this.plugin.settings.saveCoverToVault = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("封面文件夹")
			.setDesc(
				"相对于仓库根目录，例如 attachments/netease。留空则保存到仓库根目录。",
			)
			.addText((text) =>
				text
					.setPlaceholder("attachments/netease")
					.setValue(this.plugin.settings.coverFolder)
					.onChange(async (value) => {
						this.plugin.settings.coverFolder = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("封面宽度")
			.setDesc("卡片中封面图片的显示宽度（像素），设为 0 则使用原始大小。")
			.addSlider((slider) =>
				slider
					.setLimits(0, 500, 10)
					.setValue(this.plugin.settings.coverWidth)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.coverWidth = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("卡片样式")
			.setDesc("Callout 卡片会显示颜色和音乐图标，纯 Markdown 则更朴素。")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("callout", "Callout 卡片")
					.addOption("plain", "纯 Markdown")
					.setValue(this.plugin.settings.cardStyle)
					.onChange(async (value) => {
						this.plugin.settings.cardStyle =
							value === "plain" ? "plain" : "callout";
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("显示专辑名")
			.setDesc("在歌手后面显示歌曲所属的专辑。")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showAlbum)
					.onChange(async (value) => {
						this.plugin.settings.showAlbum = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("显示“在网易云音乐中打开”")
			.setDesc("在卡片底部添加跳转到原歌曲页面的链接。")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showOpenLink)
					.onChange(async (value) => {
						this.plugin.settings.showOpenLink = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("清理分享文案")
			.setDesc(
				"粘贴网易云 App 的分享文案时，只保留歌曲卡片，自动去掉“分享……来自@网易云音乐”等文字。",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.cleanShareText)
					.onChange(async (value) => {
						this.plugin.settings.cleanShareText = value;
						await this.plugin.saveSettings();
					}),
			);

		containerEl.createEl("h3", { text: "其他" });

		new Setting(containerEl)
			.setName("恢复默认设置")
			.setDesc("把所有设置恢复为插件的默认值。")
			.addButton((button) =>
				button
					.setButtonText("恢复")
					.setWarning()
					.onClick(async () => {
						this.plugin.settings = { ...DEFAULT_SETTINGS };
						await this.plugin.saveSettings();
						this.display();
						new Notice("已恢复默认设置");
					}),
			);

		containerEl.createEl("p", {
			text:
				"提示：插件使用网易云音乐的公开页面与接口获取歌曲信息，接口如有变动可能需要更新插件。",
			cls: "setting-item-description",
		});
	}
}
