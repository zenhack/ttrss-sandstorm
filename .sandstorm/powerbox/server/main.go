package main

import (
	"golang.org/x/net/websocket"
	"net/http"
	"os"

	"log"
)

const webSocketListenAddr = ":3000"

var proxyListenAddr = ":" + os.Getenv("POWERBOXY_PROXY_PORT")

func main() {
	go func() {
		panic(http.ListenAndServe(webSocketListenAddr, newWebSocketServer()))
	}()
	panic(http.ListenAndServe(proxyListenAddr, newProxyServer()))
}

func newProxyServer() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		w.WriteHeader(401)
		w.Write([]byte("TODO"))
	})
}

func newWebSocketServer() http.Handler {
	m := http.NewServeMux()
	m.Handle("/_sandstorm/websocket", websocket.Handler(func(conn *websocket.Conn) {
		log.Println("Got websocket conn,")
		_, err := conn.Write([]byte(`{"message": 1221}`))
		if err != nil {
			log.Printf("Error writing to websocket: %q", err)
		}
		conn.Close()
	}))
	return m
}
