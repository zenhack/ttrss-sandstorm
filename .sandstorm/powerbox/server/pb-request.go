package main

import (
	"context"
	"encoding/base64"
	"errors"
	"log"

	"zenhack.net/go/sandstorm/capnp/powerbox"

	"github.com/gorilla/websocket"
)

var ErrNoClient = errors.New("No client attached; can't make pb requests")
var ErrDisconnected = errors.New("Disconnected from websocket while waiting for reply")

type PowerboxRequester struct {
	addConn   chan *powerboxConn
	makePbReq chan *pbPostMsgReq
}

type powerboxConn struct {
	ctx       context.Context
	cancel    context.CancelFunc
	wsConn    *websocket.Conn
	sessionId string
}

type pbLocalizedText struct {
	DefaultText string `json:"defaultText"`
}

type pbReq struct {
	Query     []string        `json:"query"`
	SaveLabel pbLocalizedText `json:"saveLabel"`
	RpcId     uint64          `json:"rpcId"`
}

type pbPostMsgReq struct {
	PowerboxRequest pbReq `json:"powerboxRequest"`

	replyOk  chan *PowerboxResult
	replyErr chan error
}

type pbPostMsgResp struct {
	RpcId     uint64 `json:"rpcId"`
	Token     string `json:"token"`
	sessionId string `json:"-"`
}

func (pr PowerboxRequester) Connect(
	ctx context.Context,
	cancel context.CancelFunc,
	wsConn *websocket.Conn,
	sessionId string,
) {
	log.Print("Called Connect()")
	pr.addConn <- &powerboxConn{
		ctx:       ctx,
		cancel:    cancel,
		wsConn:    wsConn,
		sessionId: sessionId,
	}
}

type PowerboxResult struct {
	ClaimToken string
	SessionId  string
}

func (pr PowerboxRequester) Request(
	label string,
	descr []powerbox.PowerboxDescriptor,
) (*PowerboxResult, error) {
	log.Print("Called Request()")
	query := make([]string, len(descr))
	for i, v := range descr {
		// Make sure this is the root of the message:
		ptr := v.Struct.ToPtr()
		msg := v.Struct.Segment().Message()
		msg.SetRoot(ptr)

		data, err := msg.MarshalPacked()
		if err != nil {
			return nil, err
		}
		query[i] = base64.StdEncoding.EncodeToString(data)
	}
	req := &pbPostMsgReq{
		PowerboxRequest: pbReq{
			Query:     query,
			SaveLabel: pbLocalizedText{label},
		},
		replyOk:  make(chan *PowerboxResult, 1),
		replyErr: make(chan error, 1),
	}
	pr.makePbReq <- req
	select {
	case res := <-req.replyOk:
		return res, nil
	case err := <-req.replyErr:
		return nil, err
	}
}

func NewPowerboxRequester() *PowerboxRequester {
	pr := &PowerboxRequester{
		addConn:   make(chan *powerboxConn),
		makePbReq: make(chan *pbPostMsgReq),
	}
	go pr.run()
	return pr
}

func (pr PowerboxRequester) run() {
	var (
		nextRpcId      uint64
		nextConnIndex  int
		outstandingReq *pbPostMsgReq
	)

	pbReplies := make(chan *pbPostMsgResp)
	conns := make(map[int]*powerboxConn)
	dropConnCh := make(chan int, 1)

	for {
		var makePbReq chan *pbPostMsgReq
		if outstandingReq == nil {
			makePbReq = pr.makePbReq
		}

		select {
		case newConn := <-pr.addConn:
			index := nextConnIndex
			nextConnIndex++
			conns[index] = newConn
			log.Printf("New connection (#%v)", index)
			go func() {
				recvMsgs(newConn, pbReplies)
				dropConnCh <- index
			}()
			if outstandingReq != nil {
				err := newConn.wsConn.WriteJSON(outstandingReq)
				if err != nil {
					log.Printf("Error sending to client #%v: %v ", index, err)
				}
			}
		case index := <-dropConnCh:
			log.Printf("Connection #%v closed", index)
			conn, ok := conns[index]
			if !ok {
				return
			}
			conn.cancel()
			conn.wsConn.Close()
			delete(conns, index)
		case req := <-makePbReq:
			log.Print("Got pb request: ", req)
			req.PowerboxRequest.RpcId = nextRpcId
			nextRpcId++

			// Broadcast the request to all open connections. Some (or all) of these may
			// fail, in which case we just log it, but don't reply immediately to the
			// requester -- others make succeed, in which case we're good, and if not
			// we wait until we get a new connection and try with that. Eventually the
			// request will just time out.
			send := func(index int, conn *powerboxConn) {
				err := conn.wsConn.WriteJSON(req)
				if err == nil {
					log.Printf("Error sending to client #%v: %v ", index, err)
				}
			}
			for index, conn := range conns {
				go send(index, conn)
			}
			outstandingReq = req
		case resp := <-pbReplies:
			log.Print("Got response: ", resp)
			if outstandingReq == nil || resp.RpcId != outstandingReq.PowerboxRequest.RpcId {
				log.Print("Reply to stale/unknown rpc id: ", resp.RpcId)
				continue
			}
			outstandingReq.replyOk <- &PowerboxResult{
				ClaimToken: resp.Token,
				SessionId:  resp.sessionId,
			}
			outstandingReq = nil
		}
	}
}

func recvMsgs(conn *powerboxConn, dest chan *pbPostMsgResp) {
	log.Print("Receiving pb messages.")
	defer log.Print("ceasing to receive pb messages")
	for conn.ctx.Err() == nil {
		resp := &pbPostMsgResp{}
		err := conn.wsConn.ReadJSON(resp)
		if err != nil {
			log.Print("Reading from websocket: ", err)
			return
		}
		resp.sessionId = conn.sessionId
		select {
		case dest <- resp:
		case <-conn.ctx.Done():
		}
	}
}
