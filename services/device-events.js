const cloneDeep = require('lodash.clonedeep');
const crossFetch = require('cross-fetch');
const fetchRetry = require('fetch-retry')(crossFetch);
const { v4: uuidv4 } = require('uuid');
const Constants = require('../util/constants');
const Utility = require('../util/utility');

class Events {
	constructor(headers, environment, fsUser, deviceInfo, appInfo) {
		this.variations = [];
		this.events = [];
		this.captureDeviceEvents = Constants.CAPTURE_DEVICE_EVENTS;
		this.captureFlagEvaluations = Constants.CAPTURE_FLAG_EVALUATIONS;

		this.headers = headers;
		this.body = {
			machineId: uuidv4(),
			sdkType: 'js',
			environment: environment,
			userId: fsUser && fsUser.userId ? fsUser.userId.toString() : "",
			userAttributes: Utility.toKeyValueArray(fsUser ? fsUser.attributes : null),
			deviceInfo: Utility.toKeyValueArray(deviceInfo),
			appInfo: Utility.toKeyValueArray(appInfo)
		};

		if (this.captureDeviceEvents || this.captureFlagEvaluations) {
			setTimeout(() => {
				this.sendEvents();
			}, Constants.EVENT_FLUSH_INITIAL_DELAY);
		}

		this.registerPageHideHook();
	}

	setFSUser(fsUser) {
		this.body.userId = fsUser.userId ? fsUser.userId.toString() : "";
		this.body.userAttributes = Utility.toKeyValueArray(fsUser.attributes);
	}

	setDeviceInfo(deviceInfo) {
		this.body.deviceInfo = Utility.toKeyValueArray(deviceInfo);
	}

	setAppInfo(appInfo) {
		this.body.appInfo = Utility.toKeyValueArray(appInfo);
	}

	addEvaluationCount(flagId, variantKey) {
		try {
			if (!this.captureFlagEvaluations || this.variations.length >= Constants.EVENT_CAPACITY)
				return;

			this.variations.push({
				time: (new Date()).getTime(),
				flag: flagId,
				variation: variantKey
			});
		}
		catch (err) {
		}
	}

	recordExperimentEvent(flagKey, flagVariation, eventName, eventValue, eventType, eventAttributes) {
		try {
			if (!this.captureDeviceEvents || this.events.length >= Constants.EVENT_CAPACITY)
				return;

			this.events.push({
				time: (new Date()).getTime(),
				flagKey,
				flagVariation,
				eventName,
				eventValue,
				eventType,
				eventAttributes: Utility.toKeyValueArray(eventAttributes)
			});
		}
		catch (err) {
		}
	}

	getRequestBody() {
		if ((!this.captureDeviceEvents && !this.captureFlagEvaluations) ||
			!Utility.isInternetConnected())
			return null;

		const requestBody = cloneDeep(this.body);

		if (this.captureFlagEvaluations)
			requestBody.variations = this.variations.splice(0, this.variations.length);
		else
			requestBody.variations = [];

		if (this.captureDeviceEvents)
			requestBody.events = this.events.splice(0, this.events.length);
		else
			requestBody.events = [];

		if (requestBody.variations.length === 0 && requestBody.events.length === 0)
			return null;

		if (!this.captureDeviceEvents) {
			requestBody.userAttributes = [];
			requestBody.deviceInfo = [];
			requestBody.appInfo = [];
		}

		return requestBody;
	}

	registerPageHideHook() {
		document.addEventListener('visibilitychange', () => {
			this.sendEventsOnHide();
		});

		if (Utility.isSafari()) {
			document.addEventListener('pagehide', (event) => {
				this.sendEventsOnHide();
			});
		}
	}

	setConfig(config) {
		if (!config)
			return;

		if (config.captureDeviceEvents === false || config.captureDeviceEvents === true)
			this.captureDeviceEvents = config.captureDeviceEvents;

		if (config.captureDeviceEvaluations === false || config.captureDeviceEvaluations === true)
			this.captureFlagEvaluations = config.captureDeviceEvaluations;
	}

	sendEventsOnHide() {
		const requestBody = this.getRequestBody();
		if (requestBody) {
			let options = {
				method: 'POST',
				headers: this.headers,
				body: JSON.stringify(requestBody),
				keepalive: true
			};

			fetch(Constants.EVENTS_BASE_URL + 'device-events', options);
		}
	}

	async sendEvents() {
		const requestBody = this.getRequestBody();

		if (requestBody) {
			let [err, res] = await Utility.invoke(this.asyncPostRequest('device-events', requestBody));
			if (err)
				console.log(err);
		}

		if (this.captureDeviceEvents || this.captureFlagEvaluations) {
			setTimeout(() => {
				this.sendEvents();
			}, Constants.EVENT_FLUSH_INITIAL_DELAY);
		}
	}

	asyncPostRequest(api, requestBody) {
		return new Promise((resolve, reject) => {
			// console.log("sending events at: " + new Date());
			// console.log(JSON.stringify(requestBody));
			this.postRequest(api, requestBody, (err, res) => {
				if (err)
					console.log(err);
				return resolve(res);
			});
		});
	}

	postRequest(api, body, callback) {
		let options = {
			method: 'POST',
			headers: this.headers,
			body: JSON.stringify(body),
			keepalive: true,
			retryDelay: 3000,
			retryOn: (attempt, err, res) => {
				if (attempt > 1) return false;
				if (err) return true;
				if (res.status < 500 || res.status >= 600) {
					switch (res.status) {
						case 205:
						case 408:
						case 422:
						case 429:
							return true;
						default:
							return false;
					}
				}
				return true;
			}
		};

		fetchRetry(Constants.EVENTS_BASE_URL + api, options)
			.then((res) => {
				if (!res.ok)
					return callback(res.status);
				return callback(null, res.status);
			})
			.catch((err) => {
				return callback(err);
			});
	}
}

module.exports = Events;
