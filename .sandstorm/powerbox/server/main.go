package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gorilla/websocket"
)

const webSocketListenAddr = ":3000"

var proxyListenAddr = ":" + os.Getenv("POWERBOX_PROXY_PORT")

func main() {
	go func() {
		panic(http.ListenAndServe(webSocketListenAddr, newWebSocketServer()))
	}()
	panic(http.ListenAndServe(proxyListenAddr, newProxyServer()))
}

func newProxyServer() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		log.Println("Got proxy request:", req)
		w.WriteHeader(401)
		w.Write([]byte("TODO"))
	})
}

func newWebSocketServer() http.Handler {
	up := &websocket.Upgrader{}
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		conn, err := up.Upgrade(w, req, nil)
		if err != nil {
			log.Println(err)
			return
		}
		err = conn.WriteMessage(
			websocket.TextMessage,
			[]byte(`{"message": "Look the websocket works!"}`),
		)
		if err != nil {
			log.Printf("Error writing to websocket: %q", err)
		}
		conn.Close()

	})
}
