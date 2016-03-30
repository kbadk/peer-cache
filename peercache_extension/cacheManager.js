"use strict";

chrome.storage.local.clear();

class CacheManager {

	constructor(APP_ID, statisticsManager, settingsManager, peerHelper, PTI) {
		this.APP_ID = APP_ID;
		this.statisticsManager = statisticsManager;
		this.settingsManager = settingsManager
		this.peerHelper = peerHelper;
		this.PTI = PTI;

		chrome.storage.local.get('cache', function(storage) {
			if (!storage.cache) {
				storage.cache = {};
				chrome.storage.local.set(storage);

			}
		});

		chrome.storage.local.get('cacheIndex', function(storage) {
			if (!storage.cacheIndex) {
				storage.cacheIndex = {};
				chrome.storage.local.set(storage);
			}
		});
		this.updateStorageUsage();

		// Listen for requests from the Chrome application (cache and HTS requests).
		chrome.runtime.onMessageExternal.addListener(this.requestHandler.bind(this));

		// If we'd want to listen for events within witin the app, we could enable:
		//   chrome.runtime.onMessage.addListener(this.requestHandler);
		// We don't have to, though, since we have `sendCacheRequest` which is more reliable as it doesn't depend on the
		// Message Passing API. Callbacks in the Message Passing API can timeout and other oddities can happen. On the other
		// hand, `sendCacheRequest` is just invoked as a regular function call.

	}

	updateStorageUsage() {
		chrome.storage.local.getBytesInUse(null, function(bytesInUse) {
			this.bytesInUse = bytesInUse;
			if (this.statisticsManager) {
				this.statisticsManager.set('diskSpaceUsed', bytesInUse);
			}
		}.bind(this));
	}

	printLocalStorage() {
		chrome.storage.local.get('cache', function(storage) {
			if (chrome.runtime.lastError) {
				//console.log("CacheManager.js: " + chrome.runtime.lastError.message);
			}
			//console.log("####### Local Storage #######");
			Object.keys(storage.cache).forEach(function(url) {
				var urls = storage.cache[url];
				//console.log(url + ":");
				Object.keys(urls).forEach(function(time) {
					//console.log("- " + time + ": " + urls[time].title + " [" + urls[time].hash.substr(0,6) + "]");
				});
			});
			//console.log("#############################");
		});
	}

	addCache(title, url, document, time) {
		var newDocument = {
			title: title,
			url: url,
			document: LZString.compressToUTF16(document),
			hash: md5(document),
			time: time
		};

		var newSlimDocument = {
			title: title,
			url: url,
			hash: md5(document),
			time: time
		};

		var cacheManager = this;
		chrome.storage.local.get('cache', function(storage) {
			if (!storage.cache[newDocument.url]) {
				storage.cache[newDocument.url] = {};
			}

			var siteAlreadyCached = Object.keys(storage.cache[newDocument.url]).some(function(time) {
				return storage.cache[newDocument.url][time].hash == newDocument.hash;
			});

			if (!siteAlreadyCached) {
				storage.cache[newDocument.url][newDocument.time] = newDocument;
				if (this.statisticsManager) {
					this.statisticsManager.inc('totalCaches');
				}
			}
			chrome.storage.local.set(storage, function() {
				cacheManager.updateStorageUsage();
				console.timeEnd("backgroundScriptCacheCollection");
			});
		}.bind(this));

		chrome.storage.local.get('cacheIndex', function(storage) {

			if (!storage.cacheIndex[newSlimDocument.url]) {
				storage.cacheIndex[newSlimDocument.url] = {};
			}

			var siteAlreadyCached = Object.keys(storage.cacheIndex[newSlimDocument.url]).some(function(time) {
				return storage.cacheIndex[newSlimDocument.url][time].hash == newSlimDocument.hash;
			});

			if (!siteAlreadyCached) {
				storage.cacheIndex[newSlimDocument.url][newSlimDocument.time] = newSlimDocument;
			}
			chrome.storage.local.set(storage, function() {
				cacheManager.updateStorageUsage();
			});
		}.bind(this));
	}

	setStorageProperty(dataStore, url, time, key, value, callback) {
		chrome.storage.local.get(dataStore, function(storage) {
			if (!storage[dataStore][url] || !storage[dataStore][url][time]) {
				console.log("CacheManager.js: setProperty: No cache found for URL " + url + ", time " + time);
				return;
			}
			storage[dataStore][url][time][key] = value;
			chrome.storage.local.set(storage);
			if (callback) {
				callback()
			}
		});
	}

	setCacheIndexProperty(url, time, key, value, callback) {
		this.setStorageProperty('cacheIndex', url, time, key, value, callback);
	}

	setCacheProperty(url, time, key, value, callback) {
		this.setStorageProperty('cache', url, time, key, value, callback);
	}

	markCacheAsClean(url, time, callback) {
		this.setCacheIndexProperty(url, time, 'clean', true, callback);
		this.setCacheProperty(url, time, 'clean', true, callback);
		this.statisticsManager.inc('cleanCaches');
	}

	markCacheAsStarred(url, time, callback) {
		this.setCacheIndexProperty(url, time, 'starred', true, callback);
		this.setCacheProperty(url, time, 'starred', true, callback);
		this.statisticsManager.inc('starredCaches');
	}

	getSpecificCache(url, time, callback) {
		console.time("getSpecificCache");
		chrome.storage.local.get('cache', function(storage) {
			console.timeEnd("getSpecificCache");
			if (!storage.cache[url]) {
				callback();
			} else {
				var cache = storage.cache[url][time];
				cache.document = LZString.decompressFromUTF16(cache.document);
				callback(cache);
			}
		});
	}

	/*
		Getting a clean cache is a bit of process:
			1. Find the cache requested locally.
			2. Get a list of all caches from the server from the same URL.
			3. Filter out all caches that are not available right now (i.e. user is offline).
			4. Filter out all caches that is our own.
			5. Among the remaining caches, find the one that is most likely to be most similar to ours (i.e. captured
				 at approximately the same time).
			6. Request a hash structure from the user owning the cache.
			7. Create a private tree intersection and compute the clean cache.
			8. Finally, return the clean cache.
	 */
	getSpecificCleanCache(url, time, callback) {
		// Step 1
		console.time("getCacheFromStorage");
		chrome.storage.local.get('cache', function getCacheFromStorage(storage) {
			if (!storage.cache[url]) {
				console.log("Cache not found!");
				callback();
				return;
			}

			var cache = storage.cache[url][time];
			// If it's a starred cache or it has already been cleaned, we can just return it
			if (cache.clean || cache.starred) {
				console.timeEnd("getCacheFromStorage");
				console.log("Cache is " + (cache.clean ? "clean" : "starred") + ".");
				callback(cache);
				return;
			}

			// Step 2
			console.time("findBestCache");
			this.peerHelper.getCachesForURL(url, function findBestCache(caches) {
				var bestCache;
				for (var i=0, l=caches.length; i < l; ++i) {
					var candidateCache = caches[i];
					// Step 3
					if (candidateCache.provider.match(/[0-9a-f]{32}/)) {
						// If the provider address we get back is just a hash, the provider isn't available right now, so it's no
						// use trying to get them to create an HTS. Let's try again.
						continue;
					}
					// Step 4
					if (candidateCache.provider === this.settingsManager.get('serverAddr')) {
						// It's not safe to calculate an intersection between two of our own caches, so if the cache belongs to
						// ourself, it's useless. Let's try again.
						continue;
					}
					// Step 5
					if (candidateCache.hash === cache.hash) {
						// If we find another user with a cache exactly the same as ours, we can just mark it as clean and return
						// that straight away.
						console.log("Found user with identical cache. Returning ours as it is.");
						this.markCacheAsClean(cache.url, cache.time);
						this.peerHelper.markCacheAsClean(cache.url, cache.time);
						callback(cache);
						return;
					}
					if (!bestCache || (Math.abs(candidateCache.time - time) < Math.abs(bestCache.time - time))) {
						bestCache = candidateCache;
					}
				}

				if (!bestCache) {
					console.log("No candidate for PTI found at all. Aborting.")
					callback();
					return;
				}
				// Step 6
				console.time("getSpecificHashStructureFromOtherPeer");
				this.peerHelper.getSpecificHashStructure(bestCache.url, bestCache.time, bestCache.provider, function computeCleanCache(hashStructure) {
					// Step 7
					cache.document = LZString.decompressFromUTF16(cache.document);
					cache.document = this.PTI.getCleanDocument(cache.document, hashStructure);
					cache.document = LZString.compressToUTF16(cache.document);

					this.setCacheProperty(cache.url, cache.time, 'document', cache.document, function cacheUpdatedCallback() {
						// This has to be done after the cache has been saved or we will get concurrency issues. If we attempt
						// to update the same area in the storage at the same time, the operation that finishes first will be
						// overwritten.
						this.markCacheAsClean(cache.url, cache.time);
					}.bind(this));
					this.peerHelper.markCacheAsClean(cache.url, cache.time);
					this.statisticsManager.inc('cachesServed');
					// Step 8
					console.timeEnd("getSpecificHashStructureFromOtherPeer");
					console.timeEnd("findBestCache");
					console.timeEnd("getCacheFromStorage");
					callback(cache);
				}.bind(this));
			}.bind(this));
		}.bind(this));
	}

	getSpecificHashStructure(url, time, callback) {
		this.statisticsManager.inc('hashStructuresServed');
		this.getSpecificCache(url, time, function getSpecificCache(cache) {
			callback(this.PTI.getHashStructure(this.PTI.getDocumentFromString(cache.document)));
		}.bind(this));
	}

	getCachesForURL(url, callback) {
		chrome.storage.local.get('cacheIndex', function getCacheIndexFromStorage(storage) {
			callback(storage.cacheIndex[url] || {});
		});
	}

	requestHandler(request, sender, sendResponse) {
		var payload = request.payload;
		switch (request.type) {
			case "ECHO":
				sendResponse(payload);
				break;

			case "ADD_CACHE":
				var time = Date.now() / 1000 | 0;
				this.addCache(payload.title, payload.url, payload.document, time);
				this.peerHelper.addCache(payload.title, payload.url, payload.document, time);

				var recentCaches = this.statisticsManager.get('recentCaches');
				recentCaches[payload.sender.tab.id] = {
					url: payload.url,
					time: time
				};
				this.statisticsManager.set('recentCaches', recentCaches);

				if (sendResponse) {
					sendResponse(true);
				}
				break;

			case "STAR_CACHE":
				this.markCacheAsStarred(payload.cache.url, payload.cache.time, 'starred', true);
				this.peerHelper.markCacheAsStarred(payload.cache.url, payload.cache.time);
				break;

			case "GET_SPECIFIC_LOCAL_CACHE":
				this.getSpecificCache(payload.url, payload.time, function getSpecificCacheCallback(cache) {
					sendResponse(cache);
				});
				break;

			case "GET_SPECIFIC_CLEAN_CACHE":
				console.time("getSpecificCleanCache");
				this.getSpecificCleanCache(payload.url, payload.time, function getSpecificCleanCacheCallback(cache) {
					console.timeEnd("getSpecificCleanCache");
					// This has probably taken so long that sendResponse has timed out.
					// sendResponse(cache);
					// So we will have to do it manually
					chrome.runtime.sendMessage(this.APP_ID, {
						type: "DELAYED_REPLY",
						token: payload.token,
						payload: cache
					});
				}.bind(this));
				break;

			case "GET_SPECIFIC_LOCAL_HASH_STRUCTURE":
				console.time("getSpecificHashStructure");
				this.getSpecificHashStructure(payload.url, payload.time, function getSpecificHashStructureCallback(hashStructure) {
					console.timeEnd("getSpecificHashStructure");
					sendResponse(hashStructure);
				}.bind(this));
				break;

			case "GET_SPECIFIC_REMOTE_CACHE":
				this.peerHelper.getSpecificCache(payload.url, payload.time, payload.provider, function peerHelpergetSpecificCacheCallback(cache) {
					cache.document = LZString.decompressFromUTF16(cache.document);
					sendResponse(cache);
				});
				break;

			case "GET_LOCAL_CACHES_FOR_URL":
				this.getCachesForURL(payload.url, function getCachesForURLCallback(caches) {
					sendResponse(caches);
				});
				break;

			case "GET_REMOTE_CACHES_FOR_URL":
				this.peerHelper.getCachesForURL(payload.url, function peerHelpergetCachesForURLCallback(caches) {
					sendResponse(caches);
				});
				break;

			default:
				return false;
		}

		// "The chrome.runtime.onMessage listener must return true if you want to send a response after the listener returns [...]"
		return true;
	}

	sendCacheRequest(type, payload, callback) {
		var request = {
			type: type,
			payload: payload
		};
		this.requestHandler(request, null, callback);
	}

}