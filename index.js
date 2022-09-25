require('es6-promise').polyfill();
const FlagsenseService = require('./services/flagsense');
const FSUser = require('./model/FSUser');
const FSFlag = require('./model/FSFlag');

const flagsenseServiceMap = {};

exports.createService = function (sdkId, sdkSecret, environment, userId, attributes) {
	if (!flagsenseServiceMap.hasOwnProperty(sdkId))
		flagsenseServiceMap[sdkId] = new FlagsenseService(sdkId, sdkSecret, environment, new FSUser(userId, attributes));
	return flagsenseServiceMap[sdkId];
}

exports.flag = function (flagId, defaultKey, defaultValue) {
	return new FSFlag(flagId, defaultKey, defaultValue);
}

// Below methods can be used on instance returned from createService method
// initializationComplete()
// waitForInitializationComplete()
// getVariation(fsFlag)
// recordEvent(fsFlag, eventName, value)
// recordCodeError(fsFlag)
// setMaxInitializationWaitTime(timeInMillis)
