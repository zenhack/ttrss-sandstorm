package main

import (
	"database/sql"
	"encoding/pem"
	"net/http"
	"os"

	_ "github.com/go-sql-driver/mysql"
)

const webSocketListenAddr = ":3000"

var (
	proxyListenAddr = ":" + os.Getenv("POWERBOX_PROXY_PORT")

	caCertFile = os.Getenv("CA_CERT_PATH")

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
	caspoof, err := GenSpoofer()
	chkfatal(err)

	func() {
		f, err := os.Create(caCertFile)
		chkfatal(err)
		defer f.Close()
		chkfatal(pem.Encode(f, &pem.Block{
			Type:  "CERTIFICATE",
			Bytes: caspoof.RawCACert(),
		}))
	}()

	db, err := sql.Open("mysql", mysqlUri)
	chkfatal(err)
	storage, err := NewStorage(db)
	chkfatal(err)
	srv := NewServer(storage, caspoof)

	go func() {
		panic(http.ListenAndServe(webSocketListenAddr, srv.WebSocketHandler()))
	}()
	panic(http.ListenAndServe(proxyListenAddr, srv.ProxyHandler()))
}
