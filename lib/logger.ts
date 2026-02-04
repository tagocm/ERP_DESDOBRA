type LogLevel = "debug" | "info" | "warn" | "error";

const isProd = process.env.NODE_ENV === "production";

function shouldLog(level: LogLevel) {
    if (!isProd) return true;
    return level === "warn" || level === "error";
}

function format(prefix: string, args: unknown[]) {
    return args.length ? [`${prefix}`, ...args] : [prefix];
}

export const logger = {
    debug: (...args: unknown[]) => {
        if (!shouldLog("debug")) return;
        console.debug(...format("[DEBUG]", args));
    },
    info: (...args: unknown[]) => {
        if (!shouldLog("info")) return;
        console.info(...format("[INFO]", args));
    },
    warn: (...args: unknown[]) => {
        if (!shouldLog("warn")) return;
        console.warn(...format("[WARN]", args));
    },
    error: (...args: unknown[]) => {
        if (!shouldLog("error")) return;
        console.error(...format("[ERROR]", args));
    },
};
