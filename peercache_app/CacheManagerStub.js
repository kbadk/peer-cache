"use strict";

class CacheManagerStub {

	constructor(EXTENSION_ID) {
		this.EXTENSION_ID = EXTENSION_ID;
	}
	sendCacheRequest(type, payload, callback) {
		var request = {
			type: type,
			payload: payload
		};
		chrome.runtime.sendMessage(this.EXTENSION_ID, request, callback);
	}

}