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
	return tr.underlying.RoundTrip(req)
}
