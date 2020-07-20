# You may override the following vars on the command line to suit
# your config.
CXX=clang++
CXXFLAGS=-O2 -Wall

# You generally should not modify these.
CXXFLAGS2=-std=c++1y -Itmp $(CXXFLAGS)

.PHONY: all clean

all: bin/sandstorm-httpGet bin/sandstorm-getPublicId

clean:
	rm -rf bin tmp node_modules bundle shell-bundle.tar.gz sandstorm-*.tar.xz shell/public/edit.png shell/public/trash.png shell/public/wrench.png shell/public/download.png .shell-env

bin/sandstorm-httpGet: tmp/genfiles sandstorm-httpGet.c++
	@mkdir -p bin
	@$(CXX) sandstorm-httpGet.c++ tmp/sandstorm/*.capnp.c++ -o bin/sandstorm-httpGet -static $(CXXFLAGS2) `pkg-config capnp-rpc --cflags --libs` -lpthread -pthread

bin/sandstorm-getPublicId: tmp/genfiles sandstorm-getPublicId.c++
	@mkdir -p bin
	@$(CXX) sandstorm-getPublicId.c++ tmp/sandstorm/*.capnp.c++ -o bin/sandstorm-getPublicId -static $(CXXFLAGS2) `pkg-config capnp-rpc --cflags --libs` -lpthread -pthread

tmp/genfiles: /opt/sandstorm/latest/usr/include/sandstorm/*.capnp
	@echo "generating capnp files..."
	@mkdir -p tmp
	@capnp compile --src-prefix=/opt/sandstorm/latest/usr/include -oc++:tmp  /opt/sandstorm/latest/usr/include/sandstorm/*.capnp
	@touch tmp/genfiles
