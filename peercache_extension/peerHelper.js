"use strict";

class PeerHelper {

	constructor(statisticsManager, settingManager, peerServerHost, ownHost) {
		this.statisticsManager = statisticsManager;
		this.settingManager = settingManager;
		this.server = new WebSocket("ws://" + peerServerHost);
		this.ownHost = ownHost;

		/*
			WebSockets are asynchronous. A reply does not dictate a response, so when a request is made with a callback, we
			cannot run the callback immediately, because we won't have gotten a response yet. Therefore, with every request,
			we attach a token (or cookie). We put our token and callback in this queue, and make the server return the token
			given for every request. So when a new message arrives here, we can look up the token in our tokenCallbackTable
			and run the appropriate callback.
		 */
		this.tokenCallbackTable = {};
		this.server.onmessage =  this.messageHandler.bind(this);
		this.server.onopen = function() {
			this.sendMessage(this.server, "HELLO", {
				clientID: settingManager.get('clientID'),
				address: this.ownHost
			});
		}.bind(this);
	}

	messageHandler(event) {
		var message = JSON.parse(event.data);
		if (message.token) {
			this.tokenCallbackTable[message.token](message.payload);
		}
	}

	sendMessage(socket, type, payload, callback) {
		var msg = {
			type: type,
			payload: payload
		};
		if (callback) {
			msg.token = Math.random().toString(36).substring(2);
			this.tokenCallbackTable[msg.token] = callback;
		}
		socket.send(JSON.stringify(msg));
	}

	addCache(title, url, document, time) {
		this.sendMessage(this.server, "ADD_CACHE", {
			title: title,
			url: url,
			hash: md5(document),
			time: time
		});
	}

	markCacheAsStarred(url, time) {
		this.sendMessage(this.server, "MARK_CACHE_STARRED", {
			url: url,
			time: time
		});
	}

	markCacheAsClean(url, time) {
		this.sendMessage(this.server, "MARK_CACHE_CLEAN", {
			url: url,
			time: time
		});
	}

	getPeerCount(callback) {
		this.sendMessage(this.server, "GET_PEER_COUNT", {}, callback);
	}

	getSpecificCache(url, time, provider, callback) {
		var peer = new WebSocket("ws://" + provider);
		peer.onmessage = this.messageHandler.bind(this);
		peer.onopen = function() {
			this.sendMessage(peer, "GET_CACHE", {
				url: url,
				time: time
			}, callback);
		}.bind(this);
	}

	getSpecificHashStructure(url, time, provider, callback) {
		var peer = new WebSocket("ws://" + provider);
		peer.onmessage = this.messageHandler.bind(this);
		peer.onopen = function() {
			this.sendMessage(peer, "GET_HASH_STRUCTURE", {
				url: url,
				time: time
			}, callback);
		}.bind(this);
	}

	getCachesForURL(url, callback) {
		this.sendMessage(this.server, "GET_CACHES_FOR_URL", {
			url: url
		}, callback);
	}

}