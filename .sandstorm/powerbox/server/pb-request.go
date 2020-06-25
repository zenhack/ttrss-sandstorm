package main

import (
	"context"
	"errors"

	"github.com/gorilla/websocket"
)

var ErrNoClient = errors.New("No client attached; can't make pb requests")

type PowerboxRequester struct {
	setConn   chan *powerboxConn
	makePbReq chan *pbPostMsgReq
}

type powerboxConn struct {
	ctx    context.Context
	cancel context.CancelFunc
	wsConn *websocket.Conn
}

type pbPostMsgReq struct {
	Query     []string `json:"query"`
	SaveLabel struct {
		DefaultText string `json:"defaultText"`
	} `json:"saveLabel"`
	RpcId uint64 `json:"rpcId"`

	replyOk  chan string
	replyErr chan error
}

func (pr PowerboxRequester) Connect(
	ctx context.Context,
	cancel context.CancelFunc,
	wsConn *websocket.Conn,
) {
	pr.setConn <- &powerboxConn{
		ctx:    ctx,
		cancel: cancel,
		wsConn: wsConn,
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
			dropConn()
		case newConn := <-pr.setConn:
			dropConn()
			conn = newConn
		case req := <-pr.makePbReq:
			if conn == nil {
				req.replyErr <- ErrNoClient
				continue
			}

			req.RpcId = nextRpcId
			nextRpcId++
			rpcs[req.RpcId] = req

			err := conn.wsConn.WriteJSON(req)

			if err != nil {
				req.replyErr <- err
				delete(rpcs, req.RpcId)
			}
		}
	}
}
