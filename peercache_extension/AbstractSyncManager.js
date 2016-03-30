"use strict";

class AbstractSyncManager {

	constructor(name, callback, initCallback) {
		this.name = name;
		this.syncStorage = {};

		chrome.storage.local.get(name, function(storage) {
			if (!storage[name]) {
				storage[name] = {};
			}

			if (initCallback) {
				storage[name] = initCallback(storage[name]);
			}

			chrome.storage.local.set(storage);
			this.syncStorage = storage;

			if (callback) {
				callback();
			}
		}.bind(this));
	}

	get(key) {
		return this.syncStorage[this.name][key];
	}

	set(key, value) {
		this.syncStorage[this.name][key] = value;
		chrome.storage.local.set(this.syncStorage);
	}

	inc(key) {
		if (!this.syncStorage[this.name][key]) {
			this.syncStorage[this.name][key] = 0;
		}
		++this.syncStorage[this.name][key];
		chrome.storage.local.set(this.syncStorage);
	}

	dec(key) {
		if (!this.syncStorage[this.name][key]) {
			this.syncStorage[this.name][key] = 0;
		}
		--this.syncStorage[this.name][key];
		chrome.storage.local.set(this.syncStorage);
	}

}