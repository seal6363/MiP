"use strict";
var q = require('q');
var noble = require('noble');
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
        this.batteryLevelCharacteristic = null;
        this.peripheral = null;
        this.initialized = false;
        this.disconnected = false;
        this.peripheral = peripheral;
    }
    Device.prototype.toString = function () {
        return this.name;
    };
    Device.prototype.getCharacteristicsInformationPromise = function (peripheral, service) {
        var device = this;
        return q.Promise(function (resolve, reject, notify) {
            service.discoverCharacteristics([], function (error, characteristics) {
                console.log("discover characteristic with count: " + characteristics.length);
                characteristics.forEach(function (characteristic) {
                    console.log("discover characteristic " + characteristic.uuid + " in " + service.uuid);
                    if (characteristic.uuid.toUpperCase() == Device.BATTERY_LEVEL_CHAR_UUID) {
                        device.batteryLevelCharacteristic = characteristic;
                    }
                });
                resolve();
            });
        });
    };
    Device.prototype.initialize = function (peripheral) {
        var device = this;
        if (device.initialized) {
            console.log('already initialized');
            return;
        }
        device.initialized = true;
        device.disconnected = false;
        console.log('device initialized');
    };
    Device.prototype.isReady = function () {
        return this.batteryLevelCharacteristic != null;
    };
    Device.prototype.checkFirmwareVersion = function (completion) {
        completion(false, 0);
    };
    Device.Device_Battery_UUID = '180F';
    Device.BATTERY_LEVEL_CHAR_UUID = '2A19';
    Device.supportedServiceUUIDs = [Device.Device_Battery_UUID];
    Device.deviceWithPeripheral = function (peripheral, success, failed) {
        console.log("getting peripheral: " + peripheral);
        console.log("advertisement: " + peripheral.advertisement);
        var localName = peripheral.advertisement['localName'];
        console.log("got device: " + localName);
        var device = new Device(peripheral);
        device.name = localName;
        peripheral.discoverServices(Device.supportedServiceUUIDs, function (error, services) {
            console.log("discover services with count: " + services.length);
            if (services.length < Device.supportedServiceUUIDs.length) {
                failed(peripheral, DeviceError.SERVICE_NOT_MATCHED);
            }
            var promises = [];
            services.forEach(function (service) {
                console.log("discover service with uuid: " + service.uuid);
                promises.push(device.getCharacteristicsInformationPromise(peripheral, service));
            });
            console.log("promises: " + promises);
            q.all(promises).then(function () {
                if (device.isReady()) {
                    device.initialize(peripheral);
                    success(device);
                }
                else {
                    failed(peripheral, DeviceError.CHARACTERISTIC_NOT_MATCHED);
                }
            });
        });
    };
    return Device;
}());
noble.on("stateChange", function (state) {
    console.log('state changed with value: ' + state);
    if (state == 'poweredOn') {
        console.log('start scanning!');
        noble.startScanning(['E1F40469CFE143C1838DDDBC9DAFDDE6']);
    }
    else {
        noble.stopScanning();
    }
});
noble.on("discover", function (peripheral) {
    console.log('Got device');
    peripheral.connect(function (error) {
        if (error != undefined) {
            console.log(peripheral.uuid + ' RSSI:' + peripheral.rssi + ' Connecting, Error : ' + error);
            throw new DeviceError(DeviceError.UNEXPECTED_ERROR, 'Cannot connect to peripheral');
        }
        else {
            console.log(peripheral.uuid + ' RSSI:' + peripheral.rssi);
            console.log('connected to peripheral: ' + peripheral.uuid);
            Device.deviceWithPeripheral(peripheral, function (Device) {
                console.log("got device successfully: " + Device);
            }, function (peripheral, code) {
                console.log("error: " + code);
                throw new DeviceError(DeviceError.UNEXPECTED_ERROR, 'Cannot connect to peripheral');
            });
        }
    });
});
