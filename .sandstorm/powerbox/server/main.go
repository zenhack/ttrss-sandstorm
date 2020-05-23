package main

import (
	"net/http"
	"os"
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
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		w.WriteHeader(401)
		w.Write([]byte("TODO"))
	})
}
