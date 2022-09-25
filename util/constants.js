module.exports = {
	HEADERS: {
		AUTH_TYPE: 'authType',
		SDK_ID: 'sdkId',
		SDK_SECRET: 'sdkSecret'
	},
	BASE_URL: 'https://v1-cdn-service.flagsense.com/',
	EVENTS_BASE_URL: 'https://app-events.flagsense.com/v1/event-service/',

	ENVIRONMENTS: ['DEV', 'STAGE', 'PROD'],
	MAX_HASH_VALUE: Math.pow(2, 32),
	TOTAL_THREE_DECIMAL_TRAFFIC: 100000,
	DATA_REFRESH_INTERVAL: 5 * 60 * 1000,
	CAPTURE_DEVICE_EVENTS: true,
	EVENT_FLUSH_INITIAL_DELAY: 5 * 1000,
	EVENT_FLUSH_INTERVAL: 5 * 1000,
	EVENT_CAPACITY: 100,
	MAX_INITIALIZATION_WAIT_TIME: 10 * 1000
};
