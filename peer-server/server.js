var WebSocketServer = require('ws').Server;
var md5 = require('md5');
var Datastore = require('nedb');

cacheStore = new Datastore({ filename: 'peer-server-caches.db' });
cacheStore.loadDatabase(function(err) {
	if (err) {
		console.error(err);
	}
});

var server = new WebSocketServer({port: 7000});
var connectedPeers = {};

server.on('connection', function(client) {

	var clientID;

	client.on('message', function message(request) {
		request = JSON.parse(request);
		console.log("Got request of type " + request.type);

		switch (request.type) {
			case "HELLO":
				clientID = request.payload.clientID;
				console.log("Hello from:", clientID, request.payload.address);
				connectedPeers[clientID] = request.payload.address;
				// Convenient to compact the database now
				// https://github.com/louischatriot/nedb#compacting-the-database
				cacheStore.persistence.compactDatafile();
				break;

			case "ADD_CACHE":
				var url = request.payload.url;
				var time = request.payload.time;
				var hash = request.payload.hash;
				var title = request.payload.title;
				console.log("Received cache:", url);

				var cache = {
					clientID: clientID,
					url: url,
					hash: hash
				};
				cacheStore.find(cache, function(err, docs) {
					// If this cache already exists, we don't want it.
					if (docs.length > 0) {
						return;
					}

					cache.title = title;
					cache.time = time;
					cacheStore.insert(cache, function(err, newDoc) {
						if (err) {
							console.log(error);
						}
					});
				});
				break;

			case "MARK_CACHE_STARRED":
				var url = request.payload.url;
				var time = request.payload.time;
				cacheStore.update({ clientID: clientID, time: time, url: url }, { $set: { starred: true } });
				break;

			case "MARK_CACHE_CLEAN":
				var url = request.payload.url;
				var time = request.payload.time;
				cacheStore.update({ clientID: clientID, time: time, url: url }, { $set: { clean: true } });
				break;

			case "GET_PEER_COUNT":
				client.send(JSON.stringify({
					token: request.token,
					payload: Object.keys(connectedPeers).length
				}));
				break;

			case "GET_CACHES_FOR_URL":
				var url = request.payload.url;
				cacheStore.find({ url: url }).sort({ starred: -1, clean: -1, time: -1 }).exec(function(err, caches) {
					var resultCachesAvailable = [], resultCachesUnavailable = [];
					for (var i=0, l = caches.length; i < l; i++) {
						var cacheOwnerClientID = caches[i].clientID;
						if (cacheOwnerClientID === clientID) {
							continue;
						}
						var cacheEntry = {
							url: caches[i].url,
							title: caches[i].title,
							time: caches[i].time,
							hash: caches[i].hash,
							starred: caches[i].starred || false,
							clean: caches[i].clean || false
						}

						if (connectedPeers[cacheOwnerClientID]) {
							cacheEntry.provider = connectedPeers[cacheOwnerClientID];
							resultCachesAvailable.push(cacheEntry);
						} else {
							cacheEntry.provider = md5(cacheOwnerClientID);
							resultCachesUnavailable.push(cacheEntry);
						}

					}

					client.send(JSON.stringify({
						token: request.token,
						payload: resultCachesAvailable.concat(resultCachesUnavailable)
					}));
				});
				break;

			default:
				console.log("Got unknown request", request.type);
		}
	});

	client.on('close', function close() {
		console.log("Disconnect from:", clientID);
		delete connectedPeers[clientID];
	});

});

console.log("Peer server running.")