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

	// The token will have included the path info that was submitted with
	// the corresponding powerbox request. If we also include a path here,
	// we'll duplicate it. E.g. if we make a pb request for http://example.com/foo,
	// and then use that token to make an http request for http://example.com/foo,
	// we'll actually end up sending a request for http://example.com/foo/foo.
	//
	// So we leave off the path.
	req.URL.Path = ""
	req.URL.RawPath = ""

	return tr.underlying.RoundTrip(req)
}
