function connectToBridge() {
    const host = game.settings.get("touch-portal-bridge", "bridgeHost");
    const token = game.settings.get("touch-portal-bridge", "bridgeToken");

    const url = `ws://${host}/?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);

    ws.onopen = () => {
        console.log("[Touch Portal Bridge] Connected to", url);
    };

    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            const index = parseInt(msg.index);
            if (!isNaN(index)) {
                console.log("🎧 Triggering soundscape:", index);
                game.soundscape?.setSoundscape(index, true);
            } else {
                ui.notifications.warn("Invalid soundscape index received.");
            }
        } catch (err) {
            console.error("WebSocket message error:", err);
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
