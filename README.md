# Peer Cache
**Secure Peer-to-Peer Web Caching Using Private Set Intersection**

_Kristian Borup Antonsen_

Master's Thesis, March 2016  
Advisor: Niels Olaf Bouvin  
Supervisor: Clemens Nylandsted Klokmose

If you'd like to read the thesis, it's available in this repository: [thesis.pdf (32.9 MB)](thesis.pdf).

## Abstract






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
        