package main

import (
	"bufio"
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"io"
	"io/ioutil"
	"log"
	"net"
	"net/http"

	"github.com/gorilla/websocket"

	"zombiezen.com/go/capnproto2"

	"zenhack.net/go/sandstorm/capnp/apisession"
	"zenhack.net/go/sandstorm/capnp/powerbox"
)

func NewServer(storage Storage, spoofer *CertSpoofer) Server {
	return Server{
		storage: storage,
		spoofer: spoofer,
		pr:      NewPowerboxRequester(),
	}
}

type Server struct {
	storage Storage
	spoofer *CertSpoofer
	pr      *PowerboxRequester
}

func (s Server) handleConnect(w http.ResponseWriter, req *http.Request) {
	// If the client tries to CONNECT, we look at the host header,
	// spoof a cert for that host, read in the request the client
	// sends over TLS and proxy it as normal.

	host, port, err := net.SplitHostPort(req.Host)
	if err != nil {
		log.Printf("Failed to parse host %q: %v", req.Host, err)
		w.WriteHeader(400)
		return
	}
	// omit the port if it's the standard https port:
	if port != "443" && port != "https" {
		host = req.Host
	}

	tlsCfg, err := s.spoofer.TLSConfig(host)
	if err != nil {
		log.Printf("Failed to get TLS config for host %q: %v", host, err)
		w.WriteHeader(500)
		return
	}

	hijacker, ok := w.(http.Hijacker)
	if !ok {
		// Go's stdlib doesn't support hijacker for http 2.0 connections.
		// TODO: rule out this possiblity, either by using http2 streams
		// somehow or just disabling http 2 support entirely.
		panic("ResponseWriter does not implement http.Hijacker. Maybe the " +
			"client connected via HTTP2?")
	}
	w.WriteHeader(200)
	conn, bio, err := hijacker.Hijack()
	if err != nil {
		log.Printf("Hijack failed: %v", err)
		w.WriteHeader(500)
		return
	}
	defer conn.Close()

	// Since bio may have buffered read data, we need to wrap the connection
	// to avoid skipping that data:
	clientConn, serverConn := net.Pipe()
	go io.Copy(clientConn, bio)
	go io.Copy(conn, clientConn)

	tlsConn := tls.Server(serverConn, tlsCfg)
	defer tlsConn.Close()
	bufReader := bufio.NewReader(tlsConn)
	shouldClose := false
	for !shouldClose {
		req, err := http.ReadRequest(bufReader)
		if err != nil {
			if err != io.EOF {
				log.Print("Failed to read HTTP request from spoofed TLS connection ", err)
			}
			return
		}
		shouldClose = req.Close

		if req.Method == "CONNECT" {
			// TODO: handle this more gracefully
			panic("Nested CONNECT request")
		}

		// The docs for ReadReqeust don't go into a lot of detail re: what fields it fills
		// and and what it doesn't. Below we fill in things that we experimentally have
		// found to be necessary.
		req.URL.Scheme = "https"
		if req.URL.Host == "" {
			req.URL.Host = host
		}

		func() {
			resp, err := s.proxyRequest(req)
			if err != nil {
				log.Printf("Failed to proxy request: %v", err)
				statusCode := 503
				resp = &http.Response{
					StatusCode: statusCode,
					Status:     http.StatusText(statusCode),
					Proto:      req.Proto,
					ProtoMajor: req.ProtoMajor,
					ProtoMinor: req.ProtoMinor,
					Header: http.Header{
						"Connection": []string{"close"},
					},
					Body: ioutil.NopCloser(
						bytes.NewBufferString(err.Error()),
					),
				}
			}
			defer resp.Body.Close()
			resp.Write(tlsConn)
			shouldClose = shouldClose || resp.Header.Get("Connection") == "close"
		}()
	}
}

func (s Server) proxyRequest(req *http.Request) (*http.Response, error) {
	url := *req.URL
	url.Path = ""
	url.RawPath = ""
	url.ForceQuery = false
	url.RawQuery = ""

	trans, err := s.getTransportFor(url.String())
	if err != nil {
		return nil, err
	}

	// Go's http library complains if this is set in a client request; it
	// should only be there for requests received from the server, so we
	// clear it to avoid problems:
	req.RequestURI = ""

	return trans.RoundTrip(req)
}

func copyResponse(w http.ResponseWriter, resp *http.Response) {
	defer resp.Body.Close()
	wh := w.Header()
	for k, v := range resp.Header {
		wh[k] = v
	}
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

func (s Server) ProxyHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if req.Method == "CONNECT" {
			s.handleConnect(w, req)
			return
		}

		resp, err := s.proxyRequest(req)
		if err != nil {
			log.Printf("Error making proxied request: %v", err)
			w.WriteHeader(503)
			return
		}
		copyResponse(w, resp)
	})
}

func (s Server) getTransportFor(url string) (http.RoundTripper, error) {
	token, err := s.storage.GetTokenFor(url)
	if err != nil {
		token, err = s.requestTokenFor(url)
		if err != nil {
			return nil, err
		}
		err = s.storage.SetTokenFor(url, token)
		if err != nil {
			return nil, err
		}
	}
	return tokenRoundTripper{
		token:      token,
		underlying: http.DefaultTransport,
	}, nil
}

func (s Server) requestTokenFor(url string) (string, error) {
	res, err := s.pr.Request(
		url,
		[]powerbox.PowerboxDescriptor{powerboxDescriptorForUrl(url)},
	)
	if err != nil {
		return "", err
	}
	return claim(res)
}

func powerboxDescriptorForUrl(url string) powerbox.PowerboxDescriptor {
	_, seg, err := capnp.NewMessage(capnp.SingleSegment(nil))
	chkfatal(err)
	desc, err := powerbox.NewRootPowerboxDescriptor(seg)
	chkfatal(err)

	tags, err := desc.NewTags(1)
	chkfatal(err)
	tag := tags.At(0)

	tag.SetId(apisession.ApiSession_TypeID)

	tagValue, err := apisession.NewApiSession_PowerboxTag(seg)
	chkfatal(err)
	tagValue.SetCanonicalUrl(url)
	tag.SetValue(tagValue.Struct.ToPtr())
	return desc
}

func claim(res *PowerboxResult) (string, error) {
	var body struct {
		RequestToken        string   `json:"requestToken"`
		RequiredPermissions []string `json:"requiredPermissions"`
	}
	body.RequestToken = res.ClaimToken
	body.RequiredPermissions = []string{}
	bodyText, err := json.Marshal(&body)
	if err != nil {
		return "", err
	}
	resp, err := http.Post(
		"http://http-bridge/session/"+res.SessionId+"/claim",
		"application/octet-stream",
		bytes.NewBuffer(bodyText),
	)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var respBody struct {
		Cap string `json:"cap"`
	}
	err = json.NewDecoder(resp.Body).Decode(&respBody)
	return respBody.Cap, err
}

func (s Server) WebSocketHandler() http.Handler {
	up := &websocket.Upgrader{}
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		sessionId := req.Header.Get("X-Sandstorm-Session-Id")
		conn, err := up.Upgrade(w, req, nil)
		if err != nil {
			log.Println(err)
			return
		}
		ctx, cancel := context.WithCancel(req.Context())
		s.pr.Connect(ctx, cancel, conn, sessionId)
		<-ctx.Done()
	})
}
