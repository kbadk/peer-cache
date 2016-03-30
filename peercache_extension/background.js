"use strict";

var APP_ID = "bdkehfdnokphnbhajgfaolkdcpchaabf";

/*
	Waiting for server extension app to start listening
 */
chrome.runtime.onMessageExternal.addListener(function(request, sender, sendResponse) {
	//console.log("Received " + request.type);
	if (request.type === "WEBSOCKET_SERVER_READY") {
		//console.log("WEBSOCKET_SERVER_READY received");

		var statisticsManager = new StatisticsManager();

		var fastMode = true;
		var PTI = new PrivateTreeIntersection({ fastMode: fastMode });
		console.log("Using " + (fastMode ? "Strict" : "Relaxed") + " PTI");
		/*
			Wait for settings to be loaded
		 */
		var settingsManager = new SettingsManager(function() {
			settingsManager.set("serverAddr", request.payload.listeningAddress);
			var peerHelper = new PeerHelper(statisticsManager, settingsManager, "localhost:7000",
				request.payload.listeningAddress);
			var cacheManager = new CacheManager(APP_ID, statisticsManager, settingsManager, peerHelper, PTI);
			var tabManager = new TabManager(statisticsManager, settingsManager, cacheManager);

			/*
				When an error occurs during navigation (due to a webserver being down or internet being unavailable), we create
				a new tab (Cache Selector Tab), allowing the user to select a cached version of the website.
			 */
			chrome.webNavigation.onErrorOccurred.addListener(function(requestDetails) {
				if (["net::ERR_CONNECTION_REFUSED", "net::ERR_NAME_NOT_RESOLVED",
					"net::ERR_INTERNET_DISCONNECTED", "net::ERR_CONNECTION_TIMED_OUT"].indexOf(requestDetails.error) === -1) {
					return;
				}

				console.log("background.js: Error occured during navigation, opening cache selector");
				tabManager.createCacheSelectorTab(requestDetails.tabId, requestDetails.url, requestDetails.error);
			});

			chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
				switch (request.type) {
					/*
						When a user selects a cache from the Cache Selector Tab, an event is fired to let us know. That event we
						catch here. We then create a new tab with the selected cache.
					*/
					case "CACHE_VIEW_REQUEST":
						tabManager.createCacheViewTab(request.payload.url, request.payload.time, request.payload.provider);
						break;

					/*
						When our content script informs us that a new cache has been collected, we catch it here and pass it off to
						the CacheManager.
					 */
					case "CACHE_COLLECTED":
						// This is used to test the difference in user experience when executing heavy code background scripts
						// versus in content scripts. See the Performance section in the Evaluation Chapter of the thesis.
						// The same code will be found in the content script (content.js).
						/*function fibonacci(n) {
							if (n < 2) {
								return 1;
							}
							return fibonacci(n-2) + fibonacci(n-1);
						}
						console.time("fib");
						fibonacci(42);
						console.timeEnd("fib");
						*/

						//console.log("background.js: CACHE_COLLECTED received, sending ADD_CACHE");
						//console.profile("backgroundScriptCacheCollection");
						console.time("backgroundScriptCacheCollection");
						cacheManager.sendCacheRequest("ADD_CACHE", {
							title: request.payload.title,
							url: request.payload.url,
							document: request.payload.document,
							sender: sender
						});
						break;

					/*
						When a clicks the extension icon, an event is fired to us know. That event we catch here, so we can send
						useful statistics to the popup.
					*/
					case "POPUP_OPENED":
						peerHelper.getPeerCount(function(peerCount) {
							chrome.runtime.sendMessage({
								type: "DELAYED_POPUP_INFO",
								payload: {
									peerCount: peerCount
								}
							});
						});

						tabManager.getActiveTabId(function(tabId) {
							tabManager.sendToPopup("DELAYED_POPUP_INFO", {
								cacheCollected: statisticsManager.get('recentCaches')[tabId]
							});
						});

						sendResponse({
							clientID: settingsManager.get('clientID'),
							providerID: md5(settingsManager.get('clientID')),
							serverAddr: settingsManager.get('serverAddr'),
							totalCaches: statisticsManager.get('totalCaches'),
							cleanCaches: statisticsManager.get('cleanCaches'),
							starredCaches: statisticsManager.get('starredCaches'),
							diskSpaceUsed: statisticsManager.get('diskSpaceUsed'),
							cachesServed: statisticsManager.get('cachesServed'),
							hashStructuresServed: statisticsManager.get('hashStructuresServed')
						});
						break;

					/*
						When a user presses the "Browse caches" button in the popup, the Cache Selector Tab should be shown
					 */
					case "SHOW_CACHE_SELECTOR_TAB":
						chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
							tabManager.createCacheSelectorTab(tabs[0].tabId, tabs[0].url, null);
						});
						break;

					case "STAR_CACHE":
						cacheManager.sendCacheRequest("STAR_CACHE", {
							cache: request.payload.cache
						});

						chrome.tabs.query({
							currentWindow: true,
							active: true
						}, function(tab) {
							cacheCollected: statisticsManager.get('recentCaches')[tab[0].id].starred = true;
						});
						break;
				}
				return false;

			});

		});

	}
});


