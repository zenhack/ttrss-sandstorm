package main

import (
	"net/http"
)

const listenAddr = ":3000"

func main() {
	http.ListenAndServe(listenAddr, nil)
}
