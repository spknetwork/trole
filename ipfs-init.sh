#!/bin/sh
set -ex
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["GET", "POST"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Headers '["Authorization"]'
ipfs config --json API.HTTPHeaders.Access-Control-Expose-Headers '["Location"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Credentials '["true"]'
ipfs config --json ResourceMgr.Limits.System.Conns 2048
ipfs config --json ResourceMgr.Limits.System.ConnsInbound 1024
ipfs config --json ResourceMgr.Limits.System.ConnsOutbound 1024
ipfs config --json ResourceMgr.Limits.System.Streams 4096
ipfs config --json ResourceMgr.Limits.System.StreamsInbound 2048
ipfs config --json ResourceMgr.Limits.System.StreamsOutbound 2048
ipfs config --json ResourceMgr.Limits.Transient.Conns 512
ipfs config --json ResourceMgr.Limits.Transient.ConnsInbound 256
ipfs config --json ResourceMgr.Limits.Transient.ConnsOutbound 256
ipfs config --json ResourceMgr.Limits.Transient.Streams 1024
ipfs config --json ResourceMgr.Limits.Transient.StreamsInbound 512
ipfs config --json ResourceMgr.Limits.Transient.StreamsOutbound 512
ipfs config --json Addresses.API /ip4/127.0.0.1/tcp/5001