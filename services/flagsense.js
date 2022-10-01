const crossFetch = require('cross-fetch');
const fetchRetry = require('fetch-retry')(crossFetch);
const Utility = require('../util/utility');
const Constants = require('../util/constants');
const FlagsenseError = require('../util/flagsense-error');
const FSVariation = require('../model/FSVariation');
const UserVariant = require('./user-variant');
const Events = require("./device-events");
const FSUser = require("../model/FSUser");

class Flagsense {
	constructor(sdkId, sdkSecret, environment, fsUser, deviceInfo, appInfo) {
		if (!sdkId || !sdkSecret)
			throw new FlagsenseError('Empty sdk params not allowed');

		this.lastUpdatedOn = 0;
		this.lastSuccessfulCallOn = 0;
		this.environment = environment;
		if (!environment || Constants.ENVIRONMENTS.indexOf(environment) === -1)
			this.environment = 'PROD';

		this.headers = {
			'Accept': 'application/json',
			'Content-Type': 'application/json'
		};
		this.headers[Constants.HEADERS.AUTH_TYPE] = 'fsdk';
		this.headers[Constants.HEADERS.SDK_ID] = sdkId;
		this.headers[Constants.HEADERS.SDK_SECRET] = sdkSecret;
		this.fsUser = fsUser;
		this.maxInitializationWaitTime = Constants.MAX_INITIALIZATION_WAIT_TIME;

		this.data = {
			segments: null,
			flags: null,
			experiments: null
		};

		this.events = new Events(this.headers, this.environment, this.fsUser, deviceInfo, appInfo);
		this.userVariant = new UserVariant(this.data);

		this.fetchLatest();
		this.listeners();
	}

	initializationComplete() {
		return this.lastUpdatedOn > 0 || !Utility.isInternetConnected();
	}

	// Returns a promise which is resolved after the initialization is complete
	waitForInitializationComplete() {
		return Utility.waitFor(this.initializationComplete.bind(this), this.maxInitializationWaitTime);
	}

	async waitForInitializationCompleteAsync() {
		await Utility.invoke(
			Utility.waitFor(this.initializationComplete.bind(this), this.maxInitializationWaitTime)
		);
	}

	setFSUser(userId, attributes) {
		this.fsUser = new FSUser(userId, attributes);
		this.events.setFSUser(this.fsUser);
	}

	setMaxInitializationWaitTime(timeInMillis) {
		this.maxInitializationWaitTime = timeInMillis;
	}

	getVariation(fsFlag) {
		const variant = this.getVariant(fsFlag.flagId, {
			key: fsFlag.defaultKey,
			value: fsFlag.defaultValue
		});
		return new FSVariation(variant.key, variant.value);
	}

	recordEvent(fsFlag, eventName, value, eventType, eventAttributes) {
		if (!fsFlag || !eventName || this.lastUpdatedOn === 0)
			return;
		if (value === undefined)
			value = 1;

		const experiment = this.data.experiments[fsFlag.flagId];
		if (!experiment || !experiment.eventNames || experiment.eventNames.indexOf(eventName) === -1)
			return;

		const variantKey = this.getVariantKey(fsFlag.flagId, fsFlag.defaultKey);
		if (fsFlag.flagId && variantKey)
			this.events.recordExperimentEvent(fsFlag.flagId, variantKey, eventName, value, eventType, eventAttributes);
	}

	getVariant(flagId, defaultVariant) {
		try {
			if (this.lastUpdatedOn === 0)
				throw new FlagsenseError('Loading data');
			const variant = this.userVariant.evaluate(this.fsUser.userId, this.fsUser.attributes, flagId);
			this.events.addEvaluationCount(flagId, variant.key);
			return variant;
		}
		catch (err) {
			// console.error(err);
			this.events.addEvaluationCount(flagId, (defaultVariant && defaultVariant.key) ? defaultVariant.key : "FS_Empty");
			return defaultVariant;
		}
	}

	getVariantKey(flagId, defaultVariantKey) {
		try {
			if (this.lastUpdatedOn === 0)
				throw new FlagsenseError('Loading data');
			return this.userVariant.evaluate(this.fsUser.userId, this.fsUser.attributes, flagId).key;
		}
		catch (err) {
			return defaultVariantKey || "FS_Empty";
		}
	}

	listeners() {
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') {
				this.fetchLatest();
			}
		});

		if (Utility.isSafari()) {
			document.addEventListener('pageshow', (event) => {
				this.fetchLatest();
			});
		}

		window.addEventListener('online', () => {
			this.fetchLatest();
		});
	}

	fetchLatest() {
		if (this.lastUpdatedOn > 0 &&
			(new Date()).getTime() - this.lastSuccessfulCallOn < Constants.DATA_REFRESH_INTERVAL)
			return;

		// console.log(this.lastUpdatedOn, this.lastSuccessfulCallOn, "fetching data at: " + new Date());
		const api = this.headers[Constants.HEADERS.SDK_ID] + '/' + this.environment;

		this.getRequest(api, (err, res) => {
			if (err)
				console.log(err);

			if (err || !res)
				return;

			this.lastSuccessfulCallOn = (new Date()).getTime();
			if (res.lastUpdatedOn && res.segments && res.flags && res.experiments) {
				if (!Utility.isEmpty(res.segments))
					this.data.segments = res.segments;
				if (!Utility.isEmpty(res.flags))
					this.data.flags = res.flags;
				if (!Utility.isEmpty(res.experiments))
					this.data.experiments = res.experiments;
				this.lastUpdatedOn = res.lastUpdatedOn;
			}
			if (res.config) {
				this.events.setConfig(res.config);
			}
		});
	}

	getRequest(api, callback) {
		let options = {
			headers: this.headers,
			retryDelay: 2000,
			retryOn: (attempt, err, res) => {
				if (attempt > 3) return false;
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

		fetchRetry(Constants.BASE_URL + api, options)
			.then((res) => {
				if (!res.ok)
					return callback(res.status);
				return res.json();
			})
			.then((jsonRes) => {
				return callback(null, jsonRes);
			})
			.catch((err) => {
				return callback(err);
			});
	}
}

module.exports = Flagsense;
