
function getWebSocketUrl(): string {
  const protocol = window.location.protocol.replace('http', 'ws');
  return protocol + "//" + window.location.host + "/_sandstorm/websocket";
}

function connectWebSocket(onMessage: ((arg: object) => Promise<object>)): void {
  const socket = new WebSocket(getWebSocketUrl());
  socket.onmessage = (event) => {
    onMessage(JSON.parse(event.data)).then((value) => {
      socket.send(JSON.stringify(value))
    }, (err) => {
      console.error(err)
    })
  }
}

connectWebSocket(async (value) => {
  console.log(value);
  return {ok: 1}
})
