var cache;

chrome.runtime.sendMessage({
	type: "POPUP_OPENED",
}, function(response) {
	$('#clientID').text(response.clientID || 0);
	$('#providerID').text(response.providerID || 0);
	$('#serverAddr').text(response.serverAddr || 0);

	$('#totalCaches').text(response.totalCaches || 0);
	$('#cleanCaches').text(response.cleanCaches || 0);
	$('#starredCaches').text(response.starredCaches || 0);

	var diskSpaceUsedInMB = (response.diskSpaceUsed || 0) / (1024 * 1024);
	$('#diskSpaceUsed').text(diskSpaceUsedInMB.toFixed(2) + " MB");
	$('#cachesServed').text(response.cachesServed || 0);
	$('#hashStructuresServed').text(response.hashStructuresServed || 0);
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	if (request.type === "DELAYED_POPUP_INFO") {
		if (request.payload.peerCount) {
			$('#peerCount').text(request.payload.peerCount);
		}
		if (request.payload.cacheCollected) {
			cache = request.payload.cacheCollected;
			$('#cacheCollectionURL').text(cache.url);
			var mtime = moment.unix(cache.time);
			$('#cacheCollectionTime').html('<strong>' + mtime.fromNow() + "</strong>,<br>at " + mtime.format('MMM D \'YY, HH:mm'));

			if (cache.starred) {
				$('#cacheIsStarredButton').show();
				$('#starCacheButton').hide();
			}
		}
	}
	return false;
});

$('#browseCachesButton').on('click', function() {
	chrome.runtime.sendMessage({
		type: "SHOW_CACHE_SELECTOR_TAB"
	});
	window.close();
});

$('#starCacheButton').on('click', function() {
	chrome.runtime.sendMessage({
		type: "STAR_CACHE",
		payload: {
			cache: cache
		}
	});
	window.close();
});
