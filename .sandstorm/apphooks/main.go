package main

import (
	"context"
	"os"
	"os/exec"

	grain_capnp "zenhack.net/go/sandstorm/capnp/grain"
	bridge_capnp "zenhack.net/go/sandstorm/capnp/sandstormhttpbridge"
	bridge "zenhack.net/go/sandstorm/exp/sandstormhttpbridge"

	"zombiezen.com/go/capnproto2"
	"zombiezen.com/go/capnproto2/server"
)

type appHooks struct{}

func (appHooks) GetViewInfo(context.Context, bridge_capnp.AppHooks_getViewInfo) error {
	return capnp.Unimplemented("unimplemented")
}

func (appHooks) Restore(ctx context.Context, p bridge_capnp.AppHooks_restore) error {
	res, err := p.AllocResults()
	if err != nil {
		return err
	}
	seg := res.Struct.Segment()
	capId := seg.Message().AddCap(schedJob{}.ToClient())
	res.SetCap(capnp.NewInterface(seg, capId).ToPtr())
	return nil
}

func (appHooks) Drop(context.Context, bridge_capnp.AppHooks_drop) error {
	return nil
}

type schedJob struct{}

func (j schedJob) ToClient() *capnp.Client {
	methods := append(
		grain_capnp.AppPersistent_Methods(nil, j),
		grain_capnp.ScheduledJob_Callback_Methods(nil, j)...,
	)
	return capnp.NewClient(server.New(methods, j, nil, nil))
}

func (schedJob) Save(ctx context.Context, p grain_capnp.AppPersistent_save) error {
	res, err := p.AllocResults()
	if err != nil {
		return err
	}
	label, err := res.NewLabel()
	if err != nil {
		return err
	}
	label.SetDefaultText("Update Feeds")
	return nil
}

func (schedJob) Run(context.Context, grain_capnp.ScheduledJob_Callback_run) error {
	cmd := exec.Command("/usr/bin/php7.0", "/opt/app/update.php")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func main() {
	ctx := context.Background()
	hooksClient := bridge_capnp.AppHooks_ServerToClient(appHooks{}, &server.Policy{})
	bridge.ConnectWithHooks(ctx, hooksClient)
	<-ctx.Done()
}
