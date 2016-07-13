"use strict";
var DeviceError = (function () {
    function DeviceError(code, message) {
        this.code = code;
        this.message = message;
    }
    DeviceError.prototype.toString = function () {
        return "DeviceError(" + this.code + ") message: " + this.message;
    };
    DeviceError.SERVICE_NOT_MATCHED = 501;
    DeviceError.CHARACTERISTIC_NOT_MATCHED = 504;
    DeviceError.REQUIRE_PAIRING = 401;
    DeviceError.UNEXPECTED_ERROR = 500;
    DeviceError.DISCONNECTED_ERROR = 506;
    DeviceError.COMMAND_INCORRECT = 505;
    DeviceError.TURN_OFF = 507;
    return DeviceError;
}());
var Device = (function () {
    function Device(peripheral) {
        this.peripheral = null;
        this.initialized = false;
        this.disconnected = false;
        this.peripheral = peripheral;
    }
    Device.prototype.initialize = function (peripheral, success, failed) {
        var device = this;
        if (device.initialized) {
            console.log('already initialized');
            return;
        }
        device.initialized = true;
        device.disconnected = false;
        console.log('device initialized');
        success();
    };
    Device.prototype.isReady = function () {
        return true;
    };
    Device.prototype.checkFirmwareVersion = function (completion) {
        completion(false, 0);
    };
    Device.DEVICE_INFO_SERVICE_UUID = '180A';
    Device.deviceWithPeripheral = function (peripheral, success, failed) {
        console.log("getting peripheral: " + peripheral);
        console.log("advertisement: " + peripheral.advertisement);
        var localName = peripheral.advertisement['localName'];
        console.log("got device: " + localName);
        var device = new Device(peripheral);
        device.name = localName;
        if (device.isReady()) {
            device.initialize(peripheral, function () {
                success(device);
            }, function (errorCode) {
                failed(peripheral, errorCode);
            });
        }
        else {
            failed(peripheral, DeviceError.UNEXPECTED_ERROR);
        }
    };
    return Device;
}());
