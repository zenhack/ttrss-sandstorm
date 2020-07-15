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

	// The token will have included the path info & query string that was submitted
	// with the corresponding powerbox request. If we also that info here,
	// we'll duplicate it. E.g. if we make a pb request for http://example.com/foo,
	// and then use that token to make an http request for http://example.com/foo,
	// we'll actually end up sending a request for http://example.com/foo/foo.
	req.URL.Path = ""
	req.URL.RawPath = ""
	req.URL.ForceQuery = false
	req.URL.RawQuery = ""

	// Avoid trying to use TLS ourselves, as the bridge doesn't support CONNECT.
	// it will ignore our host & protocol anyway, as it just looks at the
	// Authorization header.
	req.URL.Scheme = "http"

	return tr.underlying.RoundTrip(req)
}
