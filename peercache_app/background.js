"use strict";

var EXTENSION_ID = "goddkckecacdnfgofcnijlmpkamdbaim";

var cacheManager = new CacheManagerStub(EXTENSION_ID);

// https://code.google.com/p/chromium/issues/detail?id=152875
// Server HAS to run in an app, can't be run in extension

var tokenCallbackTable = {};

chrome.runtime.onMessageExternal.addListener(function(request, sender, sendResponse) {
	console.log("Got external message of type " + request.type);
	switch (request.type) {
		case "DELAYED_REPLY":
			if (tokenCallbackTable[request.token]) {
				tokenCallbackTable[request.token](request.payload);
				delete tokenCallbackTable[request.token];
			}
			break;
	}
});

/* SERVER LISTENER */
var port = 7001 + Math.floor(Math.random() * 1000);
if (http.Server && http.WebSocketServer) {
	// Listen for HTTP connections.
	var server = new http.Server();
	var wsServer = new http.WebSocketServer(server);
	server.listen(port);
	console.log("Listening for incoming socket connections on port " + port);

	// The extension may not have been loaded when the app gets loaded, so let's just try to connect until it works.
	var connectToExtension = function(delay) {
		chrome.runtime.sendMessage(EXTENSION_ID, {
			type: "WEBSOCKET_SERVER_READY",
			payload: { listeningAddress: "localhost:" + port}
		}, function() {
			if (chrome.runtime.lastError
				&& chrome.runtime.lastError.message === "Could not establish connection. Receiving end does not exist.") {
				console.log("Could not connect to extension, retrying in " + delay + " second.");
				setTimeout(function() {
					connectToExtension(delay);
				}, 1000 * delay);
			}
			else {
				console.log("Connected to extension.");
			}
		});
	};
	connectToExtension(5);

	var connectedSockets = [];

	wsServer.addEventListener('request', function(req) {
		//console.log(JSON.stringify(req, null, "\t"));
		var socket = req.accept();
		console.log("Client connected (socketId: " + socket.socketId_ +  ")");
		//console.log(JSON.stringify(socket, null, "\t"));

		connectedSockets.push(socket);

		socket.addEventListener('message', function(e) {
			var request = JSON.parse(e.data);
			switch (request.type) {

				case "GET_CACHE":
					console.log("Got request for " + JSON.stringify(e));
					var delayedReplyToken = Math.random().toString(36).substring(2);
					tokenCallbackTable[delayedReplyToken] = function(cache) {
						console.log("SENDING CACHE");
						socket.send(JSON.stringify({
							token: request.token,
							payload: cache
						}));
					};
					cacheManager.sendCacheRequest("GET_SPECIFIC_CLEAN_CACHE", {
						url: request.payload.url,
						time: request.payload.time,
						token: delayedReplyToken
					}, function(payload) {
						console.log("Payload", payload);
					});
					break;

				case "GET_HASH_STRUCTURE":
					cacheManager.sendCacheRequest("GET_SPECIFIC_LOCAL_HASH_STRUCTURE", {
						url: request.payload.url,
						time: request.payload.time
					}, function(hashStructure) {
						socket.send(JSON.stringify({
							token: request.token,
							payload: hashStructure
						}));
					});
					break;
			}
		});

		// When a socket is closed, remove it from the list of connected sockets.
		socket.addEventListener('close', function() {
			console.log("Client disconnected (socketId: " + socket.socketId_ + ")");
			for (var i = 0; i < connectedSockets.length; i++) {
				if (connectedSockets[i] == socket) {
					connectedSockets.splice(i, 1);
					break;
				}
			}
		});
		return true;
	});
}