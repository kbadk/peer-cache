// https://stackoverflow.com/questions/4297877/what-other-options-for-replacing-entire-html-document-via-w3c-dom

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	if (request.type === "DRAW_CACHE_IN_TAB") {
		var cache = request.payload;
		if (!cache) {
			document.write("Something went wrong. Cache was not found.");
			return;
		}

		var unsafeDocument = document.createElement('html');
		unsafeDocument.innerHTML = request.payload.document;
		var links = unsafeDocument.getElementsByTagName('link');
		for (var i=0, l=links.length; i < l; i++) {
			links[i].removeAttribute("integrity");
		}

		document.open("text/html");
		// The order of these two writes is very important. If we write the <div> first, it'll append it to <body>. When we
		// then afterwards write the entire document, everything will be appended to the body (including the <head>).
		// When we write it the other way around, i.e. starting with <html>, then it works fine.
		document.write(unsafeDocument.outerHTML);
		document.write('<div style="position:fixed;bottom:0;left:0;right:0;height:20px;padding:5px;background:#000;color:#fff">' +
			'You are viewing a cached version of ' + cache.url + ' from ' + new Date(cache.time * 1000) + '.</div>');
		document.close();

		// Chrome extensions come with some pre-defined styles, e.g. changing default font and size on the body. We
		// don't want these styles interfering with the layout of our cache, so we have to inject some CSS cancel it out.
		// Maybe use https://trac.webkit.org/browser/trunk/Source/WebCore/css/html.css
		var resetStyle = 'html, body, h1, h2, h3, h4, h5, h6, p, table { font-size: unset; font-family: unset; vertical-align: unset; line-height: unset; } h1 { font-size: 2em; } h2 { font-size: 1.5em; } h3 { font-size: 1.17em; } h4 { font-size: 1.12em; } h5 { font-size: .83em; } h6 { font-size: .75em; } body { margin-bottom: 50px !important; }';
		style = document.createElement('style');
		style.type = 'text/css';
		style.appendChild(document.createTextNode(resetStyle));
		document.head.insertBefore(style, document.head.firstChild);
		console.log("Stop: " + Date.now());
	}
});