function connectToBridge() {
    const host = game.settings.get("touch-portal-bridge", "bridgeHost");
    const token = game.settings.get("touch-portal-bridge", "bridgeToken");

    const url = `ws://${host}/?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);

    ws.onopen = () => {
        console.log("[Touch Portal Bridge] Connected to", url);
    };

    ws.onmessage = async (event) => {
        try {
            const { module, method, args = [] } = JSON.parse(event.data);

            if (!module || !method) {
                console.warn("[Touch Portal Bridge] Invalid message format: missing 'module' or 'method'");
                return;
            }

            // Optional normalization logic for volume settings
            if (
                method === "setVolume" &&
                typeof args[0] === "number"
            ) {
                args[0] = Math.max(0, Math.min(1, args[0] / 100));
            }

            let target;

            // If calling a global object (e.g. 'game', 'canvas', etc.)
            if (module === "game") {
                target = game;
            } else if (module === "canvas") {
                target = canvas;
            } else if (module === "ui") {
                target = ui;
            } else if (module === "soundscape") {
                target = game.soundscape;
            } else {
                target = module;
            }

            const fn = typeof target?.[method] === "function" ? target[method].bind(target) : null;
            if (!fn) {
                console.warn(`[Touch Portal Bridge] Method ${method} not found on ${module}`);
                return;
            }

            console.log(`[Touch Portal Bridge] Called ${module}.${method}(${args.map(v => JSON.stringify(v)).join(", ")})`);
            try {
                const result = await fn(...args);
                console.log(`[Touch Portal Bridge] ${module}.${method} returned:`, result);
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
        console.warn("[Touch Portal Bridge] Disconnected. Retrying in 5s...");
        setTimeout(connectToBridge, 5000);
    };
}

Hooks.once("init", () => {
    game.settings.register("touch-portal-bridge", "bridgeHost", {
        name: "Bridge Server Host",
        hint: "Host and port for the WebSocket bridge (e.g. localhost:8088 or bridge.mydomain.com).",
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
        default: "",
    });
});

Hooks.once("ready", () => {
    console.log("🔌 Socket Macro Bridge: Starting WebSocket client...");
    connectToBridge();
});
