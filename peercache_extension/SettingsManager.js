"use strict";

class SettingsManager extends AbstractSyncManager {

	constructor(callback) {
		super('settings', callback, function(settings) {
			/*
				Create a unique client ID if no ID exists
		 */
			settings.clientID = settings.clientID || Math.random().toString(36).substring(2);

			return settings;
		});
	}

}