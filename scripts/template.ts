/// <reference path="typings/index.d.ts" />

// import noble = require('noble');
import q = require('q');

import * as noble from 'noble'

class DeviceError {
    message: string;
    code: number;

    constructor(code: number, message?: string) {
        this.code = code;
        this.message = message;
    }

    toString(): string {
        return `DeviceError(${this.code}) message: ${this.message}`;
    }

    static SERVICE_NOT_MATCHED = 501;
    static CHARACTERISTIC_NOT_MATCHED = 504;
    static REQUIRE_PAIRING = 401;
    static UNEXPECTED_ERROR = 500;
    static DISCONNECTED_ERROR = 506;
    static COMMAND_INCORRECT = 505;
    static TURN_OFF = 507;
}


class Device {
    // Service UUID
    static Device_Battery_UUID = '180F';

    // Characteristic UUID
    static BATTERY_LEVEL_CHAR_UUID = '2A19';

    // Characteristic Instance
    batteryLevelCharacteristic: noble.Characteristic = null;

    static supportedServiceUUIDs = [Device.Device_Battery_UUID];

    peripheral: noble.Peripheral = null;
    name: string;
    
    initialized: boolean = false;
    disconnected: boolean = false;

    constructor(peripheral: noble.Peripheral) {
        this.peripheral = peripheral;
    }

    toString(): String {
        return this.name;
    }

    /**
     * The static method to get device with corresponding peripheral
     * @param peripheral {any} The discovered peripheral instance
     * @param success {function} The success callback. Will pass with a device instance corresponding to the peripheral
     * @param failed {function} The failed callback. Will pass with the original peripheral and the error code.
     */
    static deviceWithPeripheral = function (
        peripheral: noble.Peripheral,
        success: (device: Device) => void,
        failed: (peripheral: any, code: number) => void) {

        console.log(`getting peripheral: ${peripheral}`);
        console.log(`advertisement: ${peripheral.advertisement}`);
        const localName = peripheral.advertisement['localName'];

        console.log(`got device: ${localName}`);
        let device = new Device(peripheral);
        device.name = localName;

        peripheral.discoverServices(Device.supportedServiceUUIDs, (error: string, services: noble.Service[]) => {
            console.log(`discover services with count: ${services.length}`);
            if (services.length < Device.supportedServiceUUIDs.length) {
                failed(peripheral, DeviceError.SERVICE_NOT_MATCHED);
            }
            var promises = [];
            services.forEach((service: noble.Service) => {
                console.log(`discover service with uuid: ${service.uuid}`);
                promises.push(device.getCharacteristicsInformationPromise(peripheral, service));
            });

            console.log(`promises: ${promises}`);

            q.all(promises).then(()=> {
                if (device.isReady()) {
                    device.initialize(peripheral);
                    success(device);
                } else {
                    failed(peripheral, DeviceError.CHARACTERISTIC_NOT_MATCHED);
                }
            });
        });
    }

    getCharacteristicsInformationPromise(peripheral: noble.Peripheral, service: noble.Service): any {
        let device = this;
        return q.Promise((resolve: ()=> void, reject, notify) => {
            service.discoverCharacteristics([], (error: string, characteristics: noble.Characteristic[]) => {
                console.log(`discover characteristic with count: ${characteristics.length}`);
                characteristics.forEach(characteristic => {
                    console.log(`discover characteristic ${characteristic.uuid} in ${service.uuid}`);
                    if (characteristic.uuid.toUpperCase() == Device.BATTERY_LEVEL_CHAR_UUID) {
                        device.batteryLevelCharacteristic = characteristic;
                    }
                });
                resolve();
            });
        });
    }

    /**
     * The method to consider this instance of the peripheral to be ready for reading and writing
     * The initialization process after all required characteristics have been discovered
     * @param peripheral {any} the discovered peripheral instance
     */
    initialize(peripheral: noble.Peripheral): void {
        let device = this;
        if (device.initialized) {
            console.log('already initialized');
            return;
        }

        // Setup Notify
        // ...         

        device.initialized = true;
        device.disconnected = false;
        console.log('device initialized');
    }



    isReady(): Boolean {
        // return this.BtCharacteristic != null &&
        //     this.RxCharacteristic != null &&
        //     this.TxCharacteristic != null &&
        //     this.ManufacturerNameStringCharacteristic != null &&
        //     this.ModelNumberStringCharacteristic != null &&
        //     this.SerialNumberStringCharacteristic != null &&
        //     this.FirmwareRevisionStringCharacteristic != null &&
        //     this.HardwareRevisionStringCharacteristic != null &&
        //     this.BatteryLevelCharacteristic != null;
        return this.batteryLevelCharacteristic != null;
    }


    /**
     * The method to check if the firmware is up-to-date.
     * @param completion {function} completion handler.
     */
    checkFirmwareVersion(completion: (updateNeeded: Boolean, errorCode: number)=> void) {
        completion(false, 0);
    }

}


/**
 *The method to check for the state change in noble
 *If noble's state is poweredOn, then we will begin scanning for the PLEN's service UUID, else we will stopScanning
 *@param "stateChange" {String} the direct call to noble's statechange function
 *@param function(state) {} {function} the state callback. Will pass a startScanning or stopScanning based on state.
 */
noble.on("stateChange", function (state: String): void {
    console.log('state changed with value: ' + state);
    if (state == 'poweredOn') {
        console.log('start scanning!');
        noble.startScanning(['E1F40469CFE143C1838DDDBC9DAFDDE6']);
    } else {
        noble.stopScanning();
    }
});

/**
 *The method to discover the device with noble
 *If the startScanning function successfully discovers a device, then will connect to device
 *@param "discover" {string} the direct call to noble's discover function
 *@param function(peripheral) {} {function} the peripheral callback. Will pass the discovered peripheral.
 */
noble.on("discover", function (peripheral: any) {
    console.log('Got device');
    peripheral.connect(function (error) {
        if (error != undefined) {
            console.log(peripheral.uuid + ' RSSI:' + peripheral.rssi + ' Connecting, Error : ' + error);
            throw new DeviceError(DeviceError.UNEXPECTED_ERROR, 'Cannot connect to peripheral');
        } else {
            console.log(peripheral.uuid + ' RSSI:' + peripheral.rssi);
            console.log('connected to peripheral: ' + peripheral.uuid);
            Device.deviceWithPeripheral(peripheral, function (Device) {
                console.log(`got device successfully: ${Device}`);
            }, function (peripheral, code) {
                console.log(`error: ${code}`)
                throw new DeviceError(DeviceError.UNEXPECTED_ERROR, 'Cannot connect to peripheral');
            });
        }
    });
});
