function getWebSocketUrl(): string {
  const protocol = window.location.protocol.replace('http', 'ws');
  return protocol + "//" + window.location.host + "/_sandstorm/websocket";
}

function connectWebSocket(): void {
  const socket = new WebSocket(getWebSocketUrl());
  socket.onmessage = (event) => {
    window.parent.postMessage(JSON.parse(event.data), '*');
  }
  window.addEventListener('message', (event) => {
    if(event.source !== window.parent) {
      return;
    }
    socket.send(JSON.stringify(event.data));
  });
}

connectWebSocket();
