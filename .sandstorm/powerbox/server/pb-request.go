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
	setConn   chan *powerboxConn
	makePbReq chan *pbPostMsgReq
	pbReplies chan *pbPostMsgResp
}

type powerboxConn struct {
	ctx    context.Context
	cancel context.CancelFunc
	wsConn *websocket.Conn
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

	replyOk  chan string
	replyErr chan error
}

type pbPostMsgResp struct {
	RpcId uint64 `json:"rpcId"`
	Token string `json:"token"`
}

func (pr PowerboxRequester) Connect(
	ctx context.Context,
	cancel context.CancelFunc,
	wsConn *websocket.Conn,
) {
	log.Print("Called Connect()")
	pr.setConn <- &powerboxConn{
		ctx:    ctx,
		cancel: cancel,
		wsConn: wsConn,
	}
}

func (pr PowerboxRequester) Request(
	label string,
	descr []powerbox.PowerboxDescriptor,
) (claimToken string, err error) {
	log.Print("Called Request()")
	query := make([]string, len(descr))
	for i, v := range descr {
		// Make sure this is the root of the message:
		ptr := v.Struct.ToPtr()
		msg := v.Struct.Segment().Message()
		msg.SetRoot(ptr)

		data, err := msg.MarshalPacked()
		if err != nil {
			return "", err
		}
		query[i] = base64.StdEncoding.EncodeToString(data)
	}
	req := &pbPostMsgReq{
		PowerboxRequest: pbReq{
			Query:     query,
			SaveLabel: pbLocalizedText{label},
		},
		replyOk:  make(chan string, 1),
		replyErr: make(chan error, 1),
	}
	pr.makePbReq <- req
	select {
	case token := <-req.replyOk:
		return token, nil
	case err := <-req.replyErr:
		return "", err
	}
}

func NewPowerboxRequester() *PowerboxRequester {
	pr := &PowerboxRequester{
		setConn:   make(chan *powerboxConn),
		makePbReq: make(chan *pbPostMsgReq),
	}
	go pr.run()
	return pr
}

func (pr PowerboxRequester) run() {
	var (
		conn      *powerboxConn
		nextRpcId uint64
	)

	rpcs := make(map[uint64]*pbPostMsgReq)

	dropConn := func() {
		for _, v := range rpcs {
			v.replyErr <- ErrDisconnected
		}
		rpcs = make(map[uint64]*pbPostMsgReq)
		if conn == nil {
			return
		}
		conn.cancel()
		conn.wsConn.Close()
		conn = nil
	}

	for {
		var connCtx context.Context
		if conn == nil {
			connCtx = context.Background()
		} else {
			connCtx = conn.ctx
		}

		select {
		case <-connCtx.Done():
			log.Print("Connection closed")
			dropConn()
		case newConn := <-pr.setConn:
			log.Print("New connection")
			dropConn()
			conn = newConn
			go recvMsgs(conn.ctx, conn.wsConn, pr.pbReplies)
		case req := <-pr.makePbReq:
			log.Print("Got pb request: ", req)
			if conn == nil {
				log.Print("No client.")
				req.replyErr <- ErrNoClient
				continue
			}

			req.PowerboxRequest.RpcId = nextRpcId
			nextRpcId++
			rpcs[req.PowerboxRequest.RpcId] = req

			err := conn.wsConn.WriteJSON(req)

			if err != nil {
				log.Print("Error sending to client: ", err)
				req.replyErr <- err
				delete(rpcs, req.PowerboxRequest.RpcId)
			}
			log.Print("Send request to client")
		case resp := <-pr.pbReplies:
			log.Print("Got response: ", resp)
			req, ok := rpcs[resp.RpcId]
			delete(rpcs, resp.RpcId)
			if !ok {
				log.Print("Reply to unknown rpc id: ", resp.RpcId)
				continue
			}
			req.replyOk <- resp.Token
		}
	}
}

func recvMsgs(ctx context.Context, wsConn *websocket.Conn, dest chan *pbPostMsgResp) {
	log.Print("Receiving pb messages.")
	defer log.Print("ceasing to receive pb messages")
	for ctx.Err() == nil {
		resp := &pbPostMsgResp{}
		err := wsConn.ReadJSON(resp)
		if err != nil {
			log.Print("Reading from websocket: ", err)
			return
		}
		select {
		case dest <- resp:
		case <-ctx.Done():
		}
	}
}
