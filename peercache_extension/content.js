console.profile("PeerCacheContentScript");
console.time("PeerCacheContentScript");
(function() {
	"use strict";

	// Some sites may use "//somesite.com/res.ext" instead of "http(s)://somesite.com/res.ext". When using from an
	// extension, that URL turns into "chrome-extension://somesite.com/res.ext", which is bad. Therefore, we have
	// to replace all those links with absolute paths.
	function addSchemaToUrl(url) {
		if (url.substring(0,2) !== "//") {
			return url;
		}

		return document.location.protocol + url;
	}

	// Some URLs may be relative e.g. "/img/res.png", but the CSS may be located on a CDN, so that is supposed
	// to resolve to "some-cdn.com/img/res.png". However, JS doesn't know that, so it'll just resolve it to
	// the website we're currently vising, e.g. "this-website.com/img/res.png". This, obviously, gives us a 404.
	// Therefore, we have to rewrite the relative URLs to become absolute.
	function addFullUrlToRelativeUrl(host, url) {
		if (url.substring(0,7) === "http://" || url.substring(0,8) === "https://" || url.substring(0,5) === "data:") {
			return url;
		}

		if (url.substring(0,2) === "//") {
			return document.location.protocol + url;
		}

		var a = document.createElement('a');
		a.href = host;

		if (url.substring(0,1) === "/") {
			return a.protocol + "//" + a.host + url;
		}

		var pathname = a.pathname.substring(0, a.pathname.lastIndexOf("/") + 1);
		return a.protocol + "//" + a.host + pathname + url;
	}

	function getUrlPromise(url, token) {
		return new Promise(function(resolve, reject) {
			var httpRequest = new XMLHttpRequest();
			httpRequest.open("GET", url);
			httpRequest.onload = function(e) {
				resolve({ text: httpRequest.responseText, url: url, token: token });
			}
			httpRequest.onerror = function(e) {
				resolve({ text: null, url: url, token: token });
			}
			httpRequest.send();
		});
	}

	function inlineStylesheetsPromise(document) {
		return new Promise(function(resolve, reject) {
			var links = document.getElementsByTagName('link');
			var getStylesheetPromises = [];

			// Getting all stylesheets asynchronously and adding them to a list, so we can later deal with all of them at once.
			for(var i = 0; i < links.length; i++) {
				if ((links[i].rel === "stylesheet" || links[i].type === "text/css") && links[i].href) {
					links[i].href = addSchemaToUrl(links[i].href);
					getStylesheetPromises.push(getUrlPromise(links[i].href, i));
				}
			}

			Promise.all(getStylesheetPromises).then(function successHandler(styleSheets) {
				// Once all stylesheets have been downloaded, we iterate through them to find any `url(...)` definitions, so we
				// can inline these.
				var imagesInlinedPromises = [];
				styleSheets.forEach(function(result) {
					imagesInlinedPromises.push(new Promise(function(resolve, reject) {
						var getDataUriFromImagePromises = [];
						var styleText = result.text || "", stylesheetUrl = result.url, i = result.token;
						var matches = styleText.match(/url\(['|"]?(.*?)['|"]?\)/g) || [];
						matches.forEach(function urlMatch(match) {
							var url = match.replace(/url\(['|"]?(.*?)['|"]?\)/, "$1");
							url = addFullUrlToRelativeUrl(stylesheetUrl, url);
							getDataUriFromImagePromises.push(getDataUriFromImagePromise(url, match));
						});

						Promise.all(getDataUriFromImagePromises).then(function successHandler(dataUriPromises) {
							// Once all images from the url definitions have been downloaded, we can finally inline them.
							dataUriPromises.forEach(function(result) {
								if (!result) {
									console.error("dataUriPromises gives undefined result");
									return;
								}
								var dataUri = result.dataUri, match = result.token;
								styleText = styleText.replace(match, "url(" + dataUri+ ")");
							});
							// Without unescape(encodeURIComponent(...)), this may give an error:
							//
							// > Failed to execute 'btoa' on 'Window': The string to be encoded contains characters outside of the Latin1 range.
							//
							// https://stackoverflow.com/questions/23223718/failed-to-execute-btoa-on-window-the-string-to-be-encoded-contains-characte
							links[i].href = 'data:text/css;base64,' + btoa(unescape(encodeURIComponent(styleText)));
							resolve();
						});
					}));
				});

				Promise.all(imagesInlinedPromises).then(function successHandler(result) {
					resolve();
				});
			});
		});
	}

	function inlineJavaScriptsPromise(document) {
		return new Promise(function(resolve, reject) {
			var scripts = document.getElementsByTagName('script');
			// Iterating from the bottom, so we can delete nodes without ruining the order. If we iterate from the top and
			// remove scripts[0], then what would have been scripts[1] is now scripts[0], but in the next iteration we will
			// be examining scripts[1]. Therefore, the initial scripts[1] (now scripts[0]) will never be processed.
			for(var i = scripts.length-1; i >= 0; i--) {
				//scripts[i].src = addSchemaToUrl(scripts[i].src);
				//var scriptText = getUrlPromise(scripts[i].src);
				//
				// We cannot use the same approach to inlining here as we did with CSS, because of Chrome's CSP.
				//
				// > Refused to execute inline script because it violates the following Content Security Policy directive:
				// > "script-src 'self'". Either the 'unsafe-inline' keyword, a hash
				// > ('sha256-Odxp/SRybDztYilJSoE/9d2Q4dlTkg9MQkyB+c+RYC8='), or a nonce ('nonce-...') is required to enable
				// > inline execution.
				//
				// Otherwise, we would have done:
				//
				// scripts[i].src = 'data:text/javascript;base64,' + scriptText;
				//
				// Alternatively, we could have *actually* inlined it:
				//
				//	delete scripts[i].src;
				//	scripts[i].innerHTML = scriptText;
				//
				// It's suggested we use 'unsafe-inline', but this is rejected by Chrome.
				// Likewise, we could try using a nonce 'JiUqEZ4HdC1gTpOstAyhqNvD9A5987eK' as defined in CSP
				//
				//	scripts[i].nonce = "JiUqEZ4HdC1gTpOstAyhqNvD9A5987eK";
				//	scripts[i].src = 'data:text/javascript;base64,' + scriptText;
				//
				// But Chrome will also have none of this either.
				// In the end, we are forced to just delete the <script> tag:
				scripts[i].parentNode.removeChild(scripts[i]);
			}
			resolve();
		});
	}

	// https://stackoverflow.com/questions/934012/get-image-data-in-javascript
	function getDataUriFromImagePromise(url, token) {
		// We have to createa a new image and set the crossOrigin attribute to avoid CORS errors, specifically:
		//
		// > Uncaught SecurityError: Failed to execute 'toDataURL' on 'HTMLCanvasElement': tainted canvases may not be
		// > exported.
		//
		// https://stackoverflow.com/questions/20027839/todataurl-throw-uncaught-security-exception
		return new Promise(function(resolve, reject) {
			// If the URL is already a dataURI, we can just return that
			if (url.substring(0,5) === "data:") {
				resolve({
					dataUri: url,
					token: token
				});
				return;
			}

			var image = new Image();
			image.setAttribute('crossOrigin', 'anonymous');
			image.src = url;

			image.onload = function() {
				image.onload = null;
				image.onerror = null;

				var canvas = document.createElement("canvas");
				canvas.width = image.width;
				canvas.height = image.height;

				// Copy the image contents to the canvas
				var ctx = canvas.getContext("2d");
				ctx.drawImage(image, 0, 0);

				resolve({
					dataUri: canvas.toDataURL("image/png"),
					token: token
				});
			};

			image.onerror = function() {
				// There is no way to get the actual error code
				// https://stackoverflow.com/questions/8108636/how-to-get-http-status-code-of-img-tags
				image.onload = null;
				image.onerror = null;
				resolve({ token: token });
			}
		});
	}

	function inlineImagesPromise(document) {
		return new Promise(function(resolve, reject) {
			var images = document.getElementsByTagName('img');
			var dataUriPromises = [];

			for(var i = 0; i < images.length; i++) {
				dataUriPromises.push(getDataUriFromImagePromise(images[i].src, i));
			}

			Promise.all(dataUriPromises).then(function(dataUriResults) {
				dataUriResults.forEach(function(result) {
					var dataUri = result.dataUri, i = result.token;
					if (dataUri) {
						images[i].src = dataUri;
					}
				});
				resolve();
			}, function(error) {
				resolve();
			});
		});
	}

	// This is used to test the difference in user experience when executing heavy code background scripts
	// versus in content scripts. See the Performance section in the Evaluation Chapter of the thesis.
	// The same code will be found in the background script (background.js).
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

	var clonedDoc = document.cloneNode(true);
	var promises = [inlineStylesheetsPromise(clonedDoc), inlineImagesPromise(clonedDoc), inlineJavaScriptsPromise(clonedDoc)];
	Promise.all(promises).then(function everythingInlinedHandler() {
		var base = clonedDoc.createElement("base");
		base.href = document.location.href;
		clonedDoc.head.appendChild(base);
		chrome.runtime.sendMessage({
			type: "CACHE_COLLECTED",
			payload: {
				title: document.title,
				url: document.location.href,
				document: clonedDoc.all[0].outerHTML
			}
		});
		console.timeEnd("PeerCacheContentScript");
		console.profileEnd("PeerCacheContentScript");
	});

})();