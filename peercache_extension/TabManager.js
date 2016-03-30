"use strict";

class TabManager {

	constructor(statisticsManager, settingsManager, cacheManager) {
		this.statisticsManager = statisticsManager;
		this.settingsManager = settingsManager;
		this.cacheManager = cacheManager;
	}

	/*
		Send a message to an open tab
	 */
	sendToTab(tabId, requestType, payload) {
		chrome.tabs.sendMessage(tabId, {
			type: requestType,
			payload: payload
		});
	}

	sendToPopup(requestType, payload) {
		chrome.runtime.sendMessage({
			type: requestType,
			payload: payload
		});
	}

	getActiveTabId(callback) {
		chrome.tabs.query({
			currentWindow: true,
			active: true
		}, function(tabs) {
			var tabId = tabs[0].id;
			callback(tabId);
		});
	}

	createCacheSelectorTab(tabId, url, navigationError) {
		var tabManager = this;
		var statisticsManager = this.statisticsManager;
		var settingsManager = this.settingsManager;
		var cacheManager = this.cacheManager;

		function tabCreationListener(thisTab) {
			chrome.tabs.onUpdated.addListener(function tabUpdateListener(otherTabId, changeInfo, otherTab) {
				if (thisTab && thisTab.id == otherTabId && changeInfo.status == "complete") {
					chrome.tabs.onUpdated.removeListener(tabUpdateListener);

					/*
						Get all local caches and send them to the Cache Selector Tab
					*/
					cacheManager.sendCacheRequest("GET_LOCAL_CACHES_FOR_URL", {
						url: url
					}, function cacheCallback(caches) {
						tabManager.sendToTab(thisTab.id,
							"LIST_LOCAL_CACHES_IN_SELECTOR_TAB", {
							url: url,
							navigationError: navigationError,
							caches: caches,
							clientID: settingsManager.get("clientID"),
							providerID: md5(settingsManager.get("clientID")),
							serverAddr: settingsManager.get("serverAddr"),
							storageUsage: ((statisticsManager.get("diskSpaceUsed") || 0) / (1024 * 1024)).toFixed(2) + " MB"
						});
					});

					/*
						Also get all remote caches and send them to the Cache Selector Tab
					*/
					cacheManager.sendCacheRequest("GET_REMOTE_CACHES_FOR_URL", {
						url: url
					}, function cacheCallback(caches) {
						tabManager.sendToTab(thisTab.id,
							"LIST_REMOTE_CACHES_IN_SELECTOR_TAB", {
							url: url,
							navigationError: navigationError,
							caches: caches,
							clientID: settingsManager.get("clientID"),
							providerID: md5(settingsManager.get("clientID")),
							serverAddr: settingsManager.get("serverAddr"),
							storageUsage: ((statisticsManager.get("diskSpaceUsed") || 0) / (1024 * 1024)).toFixed(2) + " MB"
						});
					});
				}
			});
		}

		// Now create the tab. If we'd rather reuse the current tab, replace `chrome.tab.create({` with:
		// `chrome.tabs.update(tabId, {`
		chrome.tabs.create({
			url: "cache-selector-tab/index.html"
		}, tabCreationListener);
	}

	_createCacheViewTabAndPopulate(cache) {
		var tabManager = this;

		function tabCreationListener(thisTab) {
				chrome.tabs.onUpdated.addListener(function tabUpdateListener(otherTabId, changeInfo, otherTab) {
					if (thisTab.id == otherTabId && changeInfo.status == "complete") {
						chrome.tabs.onUpdated.removeListener(tabUpdateListener);
						tabManager.sendToTab(thisTab.id,
							"DRAW_CACHE_IN_TAB", cache);
					}
				});
		}

		chrome.tabs.create({
			url: "show-cache-tab/index.html"
		}, tabCreationListener);
	}

	createCacheViewTab(url, time, provider) {
		console.log("TabManager.js: createCacheViewTab: " + url + ", " + time + ", " + provider);
		// If provider is set, the cache is located remotely... at the provider
		if (provider) {
			this.cacheManager.sendCacheRequest("GET_SPECIFIC_REMOTE_CACHE", {
				url: url,
				time: time,
				provider: provider
			}, this._createCacheViewTabAndPopulate.bind(this));
		}
		else {
			this.cacheManager.sendCacheRequest("GET_SPECIFIC_LOCAL_CACHE", {
				url: url,
				time: time
			}, this._createCacheViewTabAndPopulate.bind(this));
		}
	}
}