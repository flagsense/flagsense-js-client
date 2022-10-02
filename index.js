require('es6-promise').polyfill();
const FlagsenseService = require('./services/flagsense');
const FSUser = require('./model/FSUser');
const FSFlag = require('./model/FSFlag');

const flagsenseServiceMap = {};

exports.createService = function (sdkId, sdkSecret, environment, userId, attributes, deviceInfo, appInfo) {
	if (!flagsenseServiceMap.hasOwnProperty(sdkId))
		flagsenseServiceMap[sdkId] = new FlagsenseService(sdkId, sdkSecret, environment, new FSUser(userId, attributes), deviceInfo, appInfo);
	return flagsenseServiceMap[sdkId];
}

exports.flag = function (flagId, defaultKey, defaultValue) {
	return new FSFlag(flagId, defaultKey, defaultValue);
}

// Below methods can be used on instance returned from createService method
// initializationComplete()
// waitForInitializationComplete()
// waitForInitializationCompleteAsync()
// getVariation(fsFlag)
// recordEvent(fsFlag, eventName, value)
// setMaxInitializationWaitTime(timeInMillis)
// setFSUser(userId, attributes)
// setDeviceInfo(deviceInfo)
// setAppInfo(appInfo)
