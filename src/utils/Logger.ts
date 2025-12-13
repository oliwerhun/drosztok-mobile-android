// React Native compatible simple Logger without Node 'events' module

type Listener = (logs: string[]) => void;

class DebugLogger {
    logs: string[] = [];
    MAX_LOGS = 200;
    listeners: Listener[] = [];

    log(message: string, data?: any) {
        const timestamp = new Date().toLocaleTimeString('hu-HU', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
        let logMsg = `[${timestamp}] ${message}`;
        if (data !== undefined) {
            try {
                // Egyszerűsített objektum megjelenítés
                const dataStr = typeof data === 'object' ? JSON.stringify(data) : String(data);
                logMsg += ` | ${dataStr}`;
            } catch (e) {
                logMsg += ` [Data Error]`;
            }
        }

        console.log(`[DEBUG] ${logMsg}`); // Console-ra is menjen
        this.logs.unshift(logMsg); // Legfrissebb legfelül

        if (this.logs.length > this.MAX_LOGS) {
            this.logs.pop();
        }

        this.emitChanges();
    }

    getLogs() {
        return this.logs;
    }

    clear() {
        this.logs = [];
        this.emitChanges();
    }

    // Simple Event System
    on(event: string, callback: Listener) {
        if (event === 'new_log') {
            this.listeners.push(callback);
        }
    }

    off(event: string, callback: Listener) {
        if (event === 'new_log') {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        }
    }

    private emitChanges() {
        // Create a copy to avoid mutation issues during render
        const logsCopy = [...this.logs];
        this.listeners.forEach(listener => listener(logsCopy));
    }
}

export const logger = new DebugLogger();
