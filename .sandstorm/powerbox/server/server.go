package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"

	"github.com/gorilla/websocket"

	"zombiezen.com/go/capnproto2"

	"zenhack.net/go/sandstorm/capnp/apisession"
	"zenhack.net/go/sandstorm/capnp/powerbox"
)

func NewServer(storage Storage) Server {
	return Server{
		storage: storage,
		pr:      NewPowerboxRequester(),
	}
}

type Server struct {
	storage Storage
	pr      *PowerboxRequester
}

func (s Server) ProxyHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		url := req.URL.String()
		client, err := s.getClientFor(url)
		if err != nil {
			log.Printf("Failed to get client for %q: %v", url, err)
			w.WriteHeader(500)
			return
		}
		resp, err := client.Do(req)
		if err != nil {
			log.Printf("Error making proxied request: %v", err)
			w.WriteHeader(500)
			return
		}
		if req.Method == "CONNECT" {
			log.Printf("can't handle connect: %v", req)
			panic("TODO")
		}
		defer resp.Body.Close()
		wh := w.Header()
		for k, v := range resp.Header {
			wh[k] = v
		}
		w.WriteHeader(resp.StatusCode)
		io.Copy(w, resp.Body)
	})
}

func (s Server) getClientFor(url string) (*http.Client, error) {
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
	client := &http.Client{
		Transport: tokenRoundTripper{
			token:      token,
			underlying: http.DefaultTransport,
		},
	}
	return client, nil
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
