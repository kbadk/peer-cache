# Peer Cache
**Secure Peer-to-Peer Web Caching Using Private Set Intersection**

_Kristian Borup Antonsen_

Master's Thesis, March 2016
Advisor: Niels Olaf Bouvin
Supervisor: Clemens Nylandsted Klokmose

If you'd like to read the thesis, it's available in this repository: [thesis.pdf (32.9 MB)](https://github.com/kbadk/peer-cache/raw/master/thesis.pdf).

## Abstract
To prevent losing valuable information from websites that are being taken offline, the Internet Archive crawls websites to create an archive. However, if the Internet Archive itself one day gets taken offline, we will be no better off than before the Internet Archive was created.

This thesis introduces Peer Cache, a peer-to-peer-based browser extension for Google Chrome that lets users of the extension share cached versions of websites, either to make content remain available during server outages, or to permanently preserve content of websites that no longer exist, much like the Internet Archive does today. The peer-to-peer-based nature of Peer Cache makes it almost impossible to take down, unlike a server-based system like the Internet Archive.

Peer Cache is designed to automatically collect caches of the websites that the users of the extension visit. The cached websites may then be requested and shared with other users of the extension, or users of a dedicated web frontend.

In order for users of the extensions to not disclose private information from their visited websites when sharing caches, Peer Cache uses an adaptation of a two-party Private Set Intersection (PSI) protocol. PSI is a cryptographic protocol allowing two participants, each with their own set of elements, to find the intersection of their respective sets, without disclosing their sets to each other. The PSI adaptation – Private Tree Intersection – allows two users of Peer Cache to safely compare their caches of a website and compute an intersection that has been rid of both users’ private information, which may then be shared to other users of the network.

While the Peer Cache prototype implementation does not adhere fully to the design presented, the implementation demonstrates that Peer Cache seemingly allows for users to collect and securely share caches. The cache collection is automatic, but somewhat obtrusive to the user’s browsing experience, as Peer Cache causes minor freezes while the cache collection takes place. The caches that have been rid of private information using PTI maintain most of their content, but under certain conditions fail to create meaningful caches.

The problems that have been encountered during implementation and evaluation all seem to be solvable by minor changes to design and implementation. While some performance issues may not be immediately solved, it is expected that the continued progression of the JavaScript language eventually will catch up with the performance required for Peer Cache to function smoothly.

## How to run Peer Cache

### Requirements

- Google Chrome or Chromium (version 23 or later)
- NodeJS (version 5.2.8 or later)

### Indexing server

Since this prototype relies on an indexing server instead of a DHT, the indexing server has to be started before loading the extension and app:

    $ node peer-server/server.js

The indexing server relies on 3 lirbaries: `ws` (WebSocket), `md5` (hashing) and `nedb` (database). The libraries have been included.

The indexing server must be running before the extension and app are loaded.

### Extension and app

For testing, it is not recommended that the extension and app are run in the user's primary browser. Instead, a separate instance of Chrom{e,ium} should be run for each peer.

On OS X, a separate browser instance of Chrome with `./chrome_dir` as the user data directory can be run with:

    $ /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
        --user-data-dir="./chrome_dir"

Likewise, for Chromium:

    $ /Applications/Chromium.app/Contents/MacOS/chromium \
        --user-data-dir="./chrome_dir"

When running multiple instances this way, make sure to use a separate user data directories for each peer by replacing `./chrome_dir` with `./chrome_dir1` and `./chrome_dir2`, for instance.

The extension and app can be loaded by going to Settings &#8594; Extensions, enabling "Developer mode", clicking "Load unpacked extension&hellip;" and choosing the extension, and then the app. If loaded manually, remember to relaunch the application every time the browser has been restarted.

As an alternative to manually loading the extension and app, they can also be loaded automatically on launch by running the following from this directory:

    $ /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
        --user-data-dir="./chrome_dir" \
        --load-extension="./peercache_app","./peercache_extension"

The `--load-extension` parameter can also be used with Chromium.
