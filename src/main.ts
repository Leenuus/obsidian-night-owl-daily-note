import { App, Plugin, PluginSettingTab, Setting, TFile, TFolder, Notice, normalizePath, moment } from 'obsidian';

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

        // --- GROUP 1: Time-Based Commands (Read/Write) ---
        // Creates the note if it doesn't exist.

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

        // --- GROUP 2: History Navigation Commands (Read-Only) ---
        // Only opens existing notes. Skips gaps.

        this.addCommand({
            id: 'night-owl-nav-prev',
            name: 'Navigate: Previous Existing Daily Note',
            callback: () => this.navigateHistory(-1)
        });

        this.addCommand({
            id: 'night-owl-nav-next',
            name: 'Navigate: Next Existing Daily Note',
            callback: () => this.navigateHistory(1)
        });

        // Ribbon Icon (Defaults to Today)
        this.addRibbonIcon('calendar-days', 'Open Today (Night Owl)', () => {
            this.jumpToTimeBasedDate(0);
        });

        this.addSettingTab(new NightOwlSettingTab(this.app, this));
    }

    /**
     * LOGIC 1: Absolute Time Calculation (Read/Write)
     */
    getNightOwlToday(): moment.Moment {
        const now = moment();
        if (now.hour() < this.settings.rolloverHour) {
            now.subtract(1, 'day');
        }
        return now;
    }

    async jumpToTimeBasedDate(dayOffset: number) {
        const targetDate = this.getNightOwlToday().add(dayOffset, 'days');
        await this.openOrCreateNote(targetDate);
    }

    /**
     * LOGIC 2: History Navigation (Read-Only)
     * Scans the folder, sorts files by date, finds current, and moves index.
     */
	  async navigateHistory(direction: number) {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice("No file is currently open.");
            return;
        }

        // 1. Verify current file is a valid daily note
        const currentFileDate = moment(activeFile.basename, this.settings.dateFormat, true);
        if (!currentFileDate.isValid()) {
            new Notice("Current file is not a valid daily note.");
            return;
        }

        // 2. Get the daily notes folder
        const folderPath = normalizePath(this.settings.folder);
        const folder = this.app.vault.getAbstractFileByPath(folderPath);

        if (!folder || !(folder instanceof TFolder)) {
            new Notice(`Folder "${folderPath}" not found.`);
            return;
        }

        // 3. Filter children: Must be Markdown & Parseable as Date
        // We explicitly type the map result to help TypeScript (optional but good practice)
        const sortedNotes = folder.children
            .filter((f): f is TFile => f instanceof TFile && f.extension === 'md')
            .map(f => ({
                file: f,
                date: moment(f.basename, this.settings.dateFormat, true)
            }))
            .filter(item => item.date.isValid())
            .sort((a, b) => a.date.valueOf() - b.date.valueOf()); // Sort Chronologically

        // 4. Find where we are currently
        const currentIndex = sortedNotes.findIndex(item => item.file.path === activeFile.path);

        if (currentIndex === -1) {
            new Notice("Current note is not in the configured Daily Notes folder.");
            return;
        }

        // 5. Calculate Target Index
        const targetIndex = currentIndex + direction;

        // 6. Check Bounds and Retrieve Item
        // We check the item directly. If 'targetItem' exists, we are good.
        const targetItem = sortedNotes[targetIndex];

        if (targetItem) {
            const targetFile = targetItem.file; // TypeScript knows this is safe now
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(targetFile);
        } else {
            // If targetItem is undefined, we hit the edge of history
            const msg = direction < 0 ? "reached the beginning of history." : "reached the end of history.";
            new Notice(`You have ${msg}`);
        }
    }

    /**
     * Helper: Opens or Creates a note for a specific Moment date.
     */
    async openOrCreateNote(targetDate: moment.Moment) {
        const fileName = targetDate.format(this.settings.dateFormat);
        const folderPath = normalizePath(this.settings.folder);
        const filePath = normalizePath(`${folderPath}/${fileName}.md`);

        let file = this.app.vault.getAbstractFileByPath(filePath);

        // Create Folder if missing
        if (!(await this.app.vault.adapter.exists(folderPath))) {
            await this.app.vault.createFolder(folderPath);
        }

        // Create File if missing (Empty content for templater support)
        if (!file) {
            try {
                file = await this.app.vault.create(filePath, ''); 
                new Notice(`Created: ${fileName}`);
            } catch (error) {
                console.error(error);
                new Notice("Error creating note.");
                return;
            }
        }

        // Open File
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
