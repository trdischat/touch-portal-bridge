function connectToBridge() {
    const host = game.settings.get("touch-portal-bridge", "bridgeHost");
    const token = game.settings.get("touch-portal-bridge", "bridgeToken");

    const url = `ws://${host}/?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);

    ws.onopen = () => {
        console.log("[Touch Portal Bridge] Connected");
    };

    ws.onmessage = async (event) => {
        try {
            const msg = JSON.parse(event.data);
            const { module, method, args = [] } = msg;
            const target = resolvePath(globalThis, module);

            if (!target) {
                console.warn(`[Touch Portal Bridge] Could not resolve module path: ${module}`);
                return;
            }

            if (method === "getSoundscapeValue") {
                const [target] = args;
                const list = game.settings.get("soundscape", "soundscapes");
                let result;

                if (target === "count") {
                    result = Array.isArray(list) ? list.length - 1 : 0;
                } else {
                    const index = Number(target);
                    if (
                        Array.isArray(list) &&
                        Number.isInteger(index) &&
                        index >= 0 &&
                        index < list.length
                    ) {
                        result = String(list[index]?.name ?? "Unnamed");
                    } else {
                        result = "Invalid index";
                    }
                }

                ws.send(JSON.stringify({
                    type: "soundscapeData",
                    value: result,
                    requestId: msg.requestId ?? null
                }));
                return;
            }

            // Read values from Foundry variables
            if (method === "readVariable") {
                let value = typeof target === "function" ? target() : target;
                // Normalize Soundscape module volume to a 0-100 range
                if (module.match(/^game\.soundscape.*\.volume$/)) {
                    value = isFinite(value) ? Math.round(Math.max(0, Math.min(100, value * 80))) : 0;
                }
                ws.send(JSON.stringify({
                    type: "dataResponse",
                    value,
                    requestId: msg.requestId ?? null
                }));
                return;
            }

            // Normalize volume setting before sending it to Soundscape module
            if (
                module.match(/^game\.soundscape\./) &&
                method === "setVolume" &&
                typeof args[0] === "number"
            ) {
                args[0] = Math.max(0, Math.min(1.25, args[0] / 80));
            }

            const fn = typeof target?.[method] === "function" ? target[method].bind(target) : null;
            if (!fn) {
                console.warn(`[Touch Portal Bridge] Method ${method} not found on ${module}`);
                return;
            }

            // console.log(`[Touch Portal Bridge] Called ${module}.${method}(${args.map(v => JSON.stringify(v)).join(", ")})`);
            try {
                const result = await fn(...args);
                // console.log(`[Touch Portal Bridge] ${module}.${method} returned:`, result);
            } catch (err) {
                console.error(`[Touch Portal Bridge] ${module}.${method} error:`, err);
            }

        } catch (err) {
            console.error("[Touch Portal Bridge] Failed to process incoming message:", err);
        }
    };

    ws.onerror = (err) => {
        console.error("[Touch Portal Bridge] WebSocket error:", err);
    };

    ws.onclose = () => {
        console.warn("[Touch Portal Bridge] Disconnected. Retrying in 60s...");
        setTimeout(connectToBridge, 60000);
    };
}

function resolvePath(root, path) {
    if (!path) return undefined;

    const parts = path
        .replace(/\[(\w+)\]/g, ".$1") // convert [0] to .0
        .replace(/^\./, "")           // remove leading dot
        .split(".");

        return parts.reduce((obj, key) => (obj && key in obj ? obj[key] : undefined), root);
}

Hooks.once("init", () => {
    game.settings.register("touch-portal-bridge", "bridgeHost", {
        name: "Bridge Server Host",
        hint: "Host and port for the WebSocket bridge (e.g., localhost:8088 or bridge.mydomain.com).",
        scope: "world",
        config: true,
        type: String,
        default: "localhost:8088",
    });

    game.settings.register("touch-portal-bridge", "bridgeToken", {
        name: "Bridge Auth Token",
        hint: "Authentication token expected by the bridge WebSocket server.",
        scope: "world",
        config: true,
        type: String,
        default: "yourSuperSecretTokenHere",
    });
});

Hooks.once("ready", () => {
    console.log("🔌 [Touch Portal Bridge] Starting WebSocket client...");
    connectToBridge();
});
