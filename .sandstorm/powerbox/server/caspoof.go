package main

import (
	"crypto/tls"
)

func loadCA() (tls.Certificate, error) {
	return tls.LoadX509KeyPair(
		"/var/caspoof/cert.pem",
		"/var/caspoof/key.pem",
	)
}
