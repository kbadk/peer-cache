function s(obj) {
	return JSON.stringify(obj, null, "\t");
}

function createShowCacheTab(url, time, provider) {
	chrome.runtime.sendMessage({
		type: "CACHE_VIEW_REQUEST",
		payload: {
			url: url,
			time: time,
			provider: provider
		}
	});
}

function getIcon(cache) {
	if (cache.clean) {
		return '<i title="Cache is clean" class="clean">&#9733;</i>';
	}
	if (cache.starred) {
		return '<i title="Cache is starred" class="starred">&#9733;</i>';
	}
	return "";
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	console.log("cache-selector.js: Got request of type " + request.type);

	/*
		If we're receiving a list of local caches.
	 */
	if (request.type === "LIST_LOCAL_CACHES_IN_SELECTOR_TAB") {
		var caches = request.payload.caches;

		$('#clientID').html(request.payload.clientID);
		$('#providerID').html(request.payload.providerID);
		$('#serverAddr').html(request.payload.serverAddr);
		$('#storageUsage').html(request.payload.storageUsage);

		if (request.payload.navigationError) {
			$("#errorHeader").show();
			$("#errorMessage").show();
			$("#errorCode").html(request.payload.navigationError);
		}

		$("#url").attr('href', request.payload.url);
		$("#url").html(request.payload.url);

		var keys = Object.keys(caches);
		if (keys.length > 0) {
			$('#localCacheError').hide();
			$('#localCaches').show();
			if (keys.length > 5) {
				$('#localCachesExpandButton').show();
			}
			$('#localCachesTableWrapper').show();
			$('#localCacheCount').text(keys.length);
		}

		$('#localCaches tbody').empty();
		var $tbl = $("#localCaches tbody");
		for (var i=keys.length-1; i >= 0; --i) {
			var time = keys[i];
			var mtime = moment.unix(time);
			var cache = caches[time];
			var $row = $("<tr>" +
				"<td>" + getIcon(cache) + cache.title + "</td>" +
				"<td>" + mtime.fromNow() + " (" + mtime.format('MMM D \'YY, HH:mm') + ")</td>" +
				"<td>" + cache.hash.substring(0,6) + "</td>" +
			"</tr>");

			/*
				This mud is necessary, or time and url will always be set to the *last* url and time in the list. That is to
				say, all links will point to the same resource, namely the last resource in the list.
			 */
			$row.on('click', (function(url, time) {
				return function onClickHandler() {
					createShowCacheTab(url, time, null);
				};
			})(request.payload.url, time));
			$tbl.append($row);
		}

		$('.expandButton').on('click', function() {
			$(this).prev('.tableWrapper').css('max-height', 'none');
			$(this).remove();
		});
		return false;
	}

	/*
		If we're receiving a list of remote caches.
		Note: Remote caches do not contain the actual document.
	 */
	if (request.type === "LIST_REMOTE_CACHES_IN_SELECTOR_TAB") {
		var caches = request.payload.caches;

		$('#clientID').html(request.payload.clientID);
		$('#providerID').html(request.payload.providerID);
		$('#serverAddr').html(request.payload.serverAddr);
		$('#storageUsage').html(request.payload.storageUsage);

		$('#peerCaches tbody').empty();
		var $tbl = $("#peerCaches tbody");

		var keys = Object.keys(caches);
		if (keys.length > 0) {
			$('#peerCacheError').hide();
			$('#peerCaches').show();
			if (keys.length > 5) {
				$('#peerCachesExpandButton').show();
			}
			$('#peerCachesTableWrapper').show();
			$('#peerCacheCount').text(keys.length);

			for (var i=0; i < keys.length; ++i) {
				var cache = caches[keys[i]];
				var provider = cache.provider;
				var time = cache.time;
				var mtime = moment.unix(time);

				var icon = "";

				var $row = $("<tr>" +
					"<td>" + getIcon(cache) + cache.title + "</td>" +
					"<td>" + mtime.fromNow() + " (" + mtime.format('MMM D \'YY, HH:mm') + ")</td>" +
					"<td>" + cache.hash.substring(0,6) + "</td>" +
					"<td>" + provider + "</td>" +
				"</tr>");

				if ((provider === request.payload.serverAddr) || provider.match(/[0-9a-f]{32}/)) {
					$row.addClass('dimmed');
				}
				else {
					/*
						This mud is necessary, due to the same reasons as before, but also because provider won't be available in
						here at all, otherwise.
					 */
					$row.on('click', (function(url, time, provider) {
						return function onClickHandler() {
							console.log("Start: " + Date.now());
							createShowCacheTab(url, time, provider);
						};
					})(request.payload.url, time, provider));
				}
				$tbl.append($row);
			}
		}
		return false;
	}

});