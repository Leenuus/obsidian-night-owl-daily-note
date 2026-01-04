import { App, Plugin, PluginSettingTab, Setting, TFile, Notice, WorkspaceLeaf, normalizePath } from 'obsidian';
// Obsidian exposes moment on the global window object
declare global {
    interface Window {
        moment: any;
    }
}

interface NightOwlSettings {
    rolloverHour: number; // The hour the day "starts" (e.g., 4 for 4 AM)
    folder: string;       // Folder where notes are stored
    dateFormat: string;   // Moment.js format (e.g., YYYY-MM-DD)
}

const DEFAULT_SETTINGS: NightOwlSettings = {
    rolloverHour: 4,
    folder: 'Daily Notes',
    dateFormat: 'YYYY-MM-DD'
}

export default class NightOwlPlugin extends Plugin {
    settings: NightOwlSettings;

    async onload() {
        await this.loadSettings();

        // Command: Open "Today's" Note (Respecting Night Owl Logic)
        this.addCommand({
            id: 'open-night-owl-today',
            name: 'Open Today\'s Daily note(NightOwl)',
            callback: () => this.openNightOwlNote(0)
        });

        // Command: Open Yesterday
        this.addCommand({
            id: 'open-night-owl-prev',
            name: 'Open Previous Daily note(NightOwl)',
            callback: () => this.openNightOwlNote(-1)
        });

        // Command: Open Tomorrow
        this.addCommand({
            id: 'open-night-owl-next',
            name: 'Open Next Daily note(NightOwl)',
            callback: () => this.openNightOwlNote(1)
        });

        // Add Ribbon Icon for quick access to "Today"
        this.addRibbonIcon('moon', 'Open Night Owl Daily Note', () => {
            this.openNightOwlNote(0);
        });

        this.addSettingTab(new NightOwlSettingTab(this.app, this));
    }

    /**
     * Core Logic: Calculates the "Night Owl Date"
     * @param dayOffset Number of days to shift from "Today". 0 = Today, -1 = Yesterday, 1 = Tomorrow
     */
    getNightOwlDate(dayOffset: number = 0): any {
        const now = window.moment();
        
        // If current hour is strictly less than rollover hour (e.g., 3 < 4),
        // we exist in the "previous" day logically.
        if (now.hour() < this.settings.rolloverHour) {
            now.subtract(1, 'day');
        }

        // Apply the navigation offset (Previous/Next)
        if (dayOffset !== 0) {
            now.add(dayOffset, 'days');
        }

        return now;
    }

    /**
     * Opens or creates the daily note based on the calculated date.
     */
    async openNightOwlNote(dayOffset: number) {
        const targetDate = this.getNightOwlDate(dayOffset);
        const fileName = targetDate.format(this.settings.dateFormat);
        const folderPath = normalizePath(this.settings.folder);
        const filePath = normalizePath(`${folderPath}/${fileName}.md`);

        let file = this.app.vault.getAbstractFileByPath(filePath);

        // 1. Create Folder if it doesn't exist
        if (!(await this.app.vault.adapter.exists(folderPath))) {
            await this.app.vault.createFolder(folderPath);
        }

        // 2. Create File if it doesn't exist
        if (!file) {
            try {
                // You could insert a template here
                file = await this.app.vault.create(filePath, `# Daily Note: ${fileName}\n\n`);
                new Notice(`Created new Night Owl note: ${fileName}`);
            } catch (error) {
                new Notice("Error creating daily note. Check console.");
                console.error(error);
                return;
            }
        }

        // 3. Open the file
        if (file instanceof TFile) {
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(file);
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class NightOwlSettingTab extends PluginSettingTab {
    plugin: NightOwlPlugin;

    constructor(app: App, plugin: NightOwlPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Night Owl Settings' });

        new Setting(containerEl)
            .setName('Rollover Hour')
            .setDesc('The hour (0-23) when the new day actually starts. Default is 4 (4 AM).')
            .addText(text => text
                .setPlaceholder('4')
                .setValue(String(this.plugin.settings.rolloverHour))
                .onChange(async (value) => {
                    const parsed = parseInt(value);
                    if (!isNaN(parsed) && parsed >= 0 && parsed <= 23) {
                        this.plugin.settings.rolloverHour = parsed;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Date Format')
            .setDesc('Moment.js date format syntax.')
            .addText(text => text
                .setPlaceholder('YYYY-MM-DD')
                .setValue(this.plugin.settings.dateFormat)
                .onChange(async (value) => {
                    this.plugin.settings.dateFormat = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('Folder')
            .setDesc('Location to save daily notes.')
            .addText(text => text
                .setPlaceholder('Daily Notes')
                .setValue(this.plugin.settings.folder)
                .onChange(async (value) => {
                    this.plugin.settings.folder = value;
                    await this.plugin.saveSettings();
                }));
    }
}
