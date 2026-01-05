import { App, Plugin, PluginSettingTab, Setting, TFile, Notice, normalizePath, moment } from 'obsidian';

// Interface for Settings
interface NightOwlSettings {
    rolloverHour: number; // e.g., 4 for 4 AM
    folder: string;       // e.g., "Daily Notes"
    dateFormat: string;   // e.g., "YYYY-MM-DD"
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

        // --- GROUP 1: Time-Based Commands (Night Owl Logic) ---
        // These depend on the current system clock + rollover setting.

        this.addCommand({
            id: 'night-owl-jump-today',
            name: 'Jump to: Today (Night Owl)',
            callback: () => this.jumpToTimeBasedDate(0)
        });

        this.addCommand({
            id: 'night-owl-jump-yesterday',
            name: 'Jump to: Yesterday (Night Owl)',
            callback: () => this.jumpToTimeBasedDate(-1)
        });

        this.addCommand({
            id: 'night-owl-jump-tomorrow',
            name: 'Jump to: Tomorrow (Night Owl)',
            callback: () => this.jumpToTimeBasedDate(1)
        });

        // --- GROUP 2: File-Based Commands (Walking) ---
        // These depend on the date of the CURRENTLY OPEN file.

        this.addCommand({
            id: 'night-owl-nav-prev',
            name: 'Navigate: Previous Daily Note',
            callback: () => this.navigateRelativeDate(-1)
        });

        this.addCommand({
            id: 'night-owl-nav-next',
            name: 'Navigate: Next Daily Note',
            callback: () => this.navigateRelativeDate(1)
        });

        // Ribbon Icon (Defaults to Today)
        this.addRibbonIcon('moon', 'Open Today (Night Owl)', () => {
            this.jumpToTimeBasedDate(0);
        });

        this.addSettingTab(new NightOwlSettingTab(this.app, this));
    }

    /**
     * LOGIC 1: Absolute Time Calculation
     * Returns a moment object representing "Today" adjusted for the rollover hour.
     */
    getNightOwlToday(): moment.Moment {
        const now = moment();
        // If it's 3 AM and rollover is 4 AM, we are still in "yesterday"
        if (now.hour() < this.settings.rolloverHour) {
            now.subtract(1, 'day');
        }
        return now;
    }

    /**
     * Handler for Jump commands (Today/Yesterday/Tomorrow)
     */
    async jumpToTimeBasedDate(dayOffset: number) {
        const targetDate = this.getNightOwlToday().add(dayOffset, 'days');
        await this.openOrCreateNote(targetDate);
    }

    /**
     * LOGIC 2: Relative File Calculation
     * Reads the current view, parses the filename, and moves back/forward.
     */
    async navigateRelativeDate(dayOffset: number) {
        const activeFile = this.app.workspace.getActiveFile();

        if (!activeFile) {
            new Notice("No file is currently open.");
            return;
        }

        // Try to parse the filename using the settings format
        // The 'true' flag ensures strict parsing (rejects files that don't match the format)
        const currentFileDate = moment(activeFile.basename, this.settings.dateFormat, true);

        if (!currentFileDate.isValid()) {
            new Notice(`Current file "${activeFile.basename}" is not a valid daily note.`);
            return;
        }

        // Calculate target
        const targetDate = currentFileDate.add(dayOffset, 'days');
        await this.openOrCreateNote(targetDate);
    }

    /**
     * Shared Logic: Finds, Creates, and Opens a note for a specific Moment date.
     */
    async openOrCreateNote(targetDate: moment.Moment) {
        const fileName = targetDate.format(this.settings.dateFormat);
        const folderPath = normalizePath(this.settings.folder);
        const filePath = normalizePath(`${folderPath}/${fileName}.md`);

        let file = this.app.vault.getAbstractFileByPath(filePath);

        // 1. Create Folder if missing
        if (!(await this.app.vault.adapter.exists(folderPath))) {
            await this.app.vault.createFolder(folderPath);
        }

        // 2. Create File if missing
        if (!file) {
            try {
                // CHANGED: Create an empty file with no placeholder content.
                // This allows other plugins (like Templater) to listen for the 'create' event
                // and apply templates automatically if the user has configured them.
                file = await this.app.vault.create(filePath, ''); 
                new Notice(`Created: ${fileName}`);
            } catch (error) {
                console.error(error);
                new Notice("Error creating note.");
                return;
            }
        }

        // 3. Open File
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

// --- Settings Tab UI ---
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
            .setDesc('The hour (0-23) when the new day starts. (e.g. 4 = 4 AM)')
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
            .setDesc('Moment.js format (must match your file names).')
            .addText(text => text
                .setPlaceholder('YYYY-MM-DD')
                .setValue(this.plugin.settings.dateFormat)
                .onChange(async (value) => {
                    this.plugin.settings.dateFormat = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('Folder')
            .setDesc('Folder where daily notes are stored.')
            .addText(text => text
                .setPlaceholder('Daily Notes')
                .setValue(this.plugin.settings.folder)
                .onChange(async (value) => {
                    this.plugin.settings.folder = value;
                    await this.plugin.saveSettings();
                }));
    }
}
