const ReconnectingWebSocket = require("reconnecting-websocket");
const WebSocket = require("ws");
const config = require("./config.json");

const socketInit = (blockchains, io) => {
  const subscribe = {
    jsonrpc: "2.0",
    method: "subscribe",
    id: "1",
    params: ["tm.event = 'Tx'"],
  };
  blockchains.forEach((b) => {
    const [domain, port] = b.node_addr.split(":");
    const url = `ws://${domain}:${port}/websocket`;
    let socket = new ReconnectingWebSocket(url, [], { WebSocket });
    socket.onopen = () => {
      socket.send(JSON.stringify(subscribe));
    };
    socket.onmessage = async (msg) => {
      const tx = JSON.parse(msg.data);
      io.emit("tx", { ...tx, blockchain: domain });
    };
  });
};

module.exports = {
  init: async (io) => {
    socketInit(config.blockchains, io);
  },
};
