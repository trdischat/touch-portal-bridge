Hooks.once("ready", () => {
  console.log("🔌 Socket Macro Bridge: Starting WebSocket client...");

  // Connect to a local WebSocket server (we'll create that next)
  const ws = new WebSocket("ws://localhost:8088");

  ws.onopen = () => {
    console.log("🔗 Connected to local WebSocket bridge.");
    ws.send("Foundry client ready");
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

  ws.onerror = (err) => console.error("WebSocket error:", err);
  ws.onclose = () => console.warn("WebSocket connection closed.");
});
