package main

import (
	"database/sql"
	"net/http"
	"os"

	_ "github.com/go-sql-driver/mysql"
)

const webSocketListenAddr = ":3000"

var (
	proxyListenAddr = ":" + os.Getenv("POWERBOX_PROXY_PORT")

	mysqlUser = os.Getenv("MYSQL_USER")
	mysqlDb   = os.Getenv("MYSQL_DATABASE")
	mysqlUri  = mysqlUser + "@/" + mysqlDb
)

func chkfatal(err error) {
	if err != nil {
		panic(err)
	}
}

func main() {
	db, err := sql.Open("mysql", mysqlUri)
	chkfatal(err)
	storage, err := NewStorage(db)
	chkfatal(err)
	srv := NewServer(storage)

	go func() {
		panic(http.ListenAndServe(webSocketListenAddr, srv.WebSocketHandler()))
	}()
	panic(http.ListenAndServe(proxyListenAddr, srv.ProxyHandler()))
}
