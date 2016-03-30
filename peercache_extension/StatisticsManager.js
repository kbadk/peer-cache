"use strict";

class StatisticsManager extends AbstractSyncManager {

	constructor(callback) {
		super('statistics', callback, function(settings) {
			/*
				Create array for recent caches if none exists
			 */
			settings.recentCaches = settings.recentCaches || [];

			return settings;
		});
	}

}