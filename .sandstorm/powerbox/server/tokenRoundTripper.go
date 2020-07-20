package main

import (
	"net/http"
)

type tokenRoundTripper struct {
	token      string
	underlying http.RoundTripper
}

func (tr tokenRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	req.Header.Set("Authorization", "Bearer "+tr.token)

	// Avoid trying to use TLS ourselves, as the bridge doesn't support CONNECT.
	// it will ignore our host & protocol anyway, as it just looks at the
	// Authorization header.
	req.URL.Scheme = "http"

	return tr.underlying.RoundTrip(req)
}
