const functions = {};

functions.isEmpty = function (obj) {
	if (!obj)
		return true;

	if (obj.constructor === Array)
		return obj.length === 0;

	return Object.keys(obj).length === 0;
}

functions.getOrDefault = function (obj, key, defaultValue) {
	if (obj.hasOwnProperty(key))
		return obj[key];
	return defaultValue;
}

functions.invoke = function (promise) {
	return promise
		.then((data) => {
			return [ null, data ];
		})
		.catch((err) => {
			return [ err, null ];
		});
}

functions.waitFor = function (conditionFunction, maxWaitTime) {
	const startTime = (new Date()).getTime();
	const poll = resolve => {
		if (conditionFunction() || (new Date()).getTime() - startTime >= maxWaitTime)
			resolve();
		else
			setTimeout(() => poll(resolve), 500);
	}
	return new Promise(poll);
}

functions.toKeyValueArray = function (obj) {
	if (!obj)
		return [];
	return Object.entries(obj).map(([key, value]) => ({
		key,
		value
	}));
}

functions.isInternetConnected = function () {
	return window.navigator.onLine;
}

functions.isSafari = function () {
	return navigator.vendor.indexOf("Apple") >= 0;
}

module.exports = functions;
