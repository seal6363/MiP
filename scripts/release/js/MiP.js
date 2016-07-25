"use strict";
var noble = require('noble');
var fs = require('fs');
var q = require('q');
var readline = require('readline');
var rl = readline.createInterface({ input: process.stdin, output: process.stdout });
var DeviceError = (function () {
    function DeviceError(code, message) {
        this.code = code;
        this.message = message;
    }
    DeviceError.prototype.toString = function () {
        return "DeviceError(" + this.code + ") message: " + this.message;
    };
    DeviceError.SERVICE_NOT_MATCHED = 501;
    DeviceError.SERVICE_NOT_ENOUGH = 505;
    DeviceError.CHARACTERISTIC_NOT_MATCHED = 504;
    DeviceError.REQUIRE_PAIRING = 401;
    DeviceError.REVISION_NOT_MATCHED = 502;
    DeviceError.COMPASS_NOT_READY = 503;
    DeviceError.UNEXPECTED_ERROR = 500;
    DeviceError.INVALID_ARGUMENT = 600;
    return DeviceError;
}());
var Device = (function () {
    function Device(peripheral) {
        this.peripheral = null;
        this.SendDataCharac = null;
        this.ReceiveDataCharac = null;
        this.BatteryLevelCharac = null;
        this.RssiReportCharac = null;
        this.DeviceInfoCharac = null;
        this.DeviceSettingCharac = null;
        this.DfuCharac = null;
        this.ModuleParameterCharac = null;
        this.NuvotonBootloaderCharac = null;
        this.name = undefined;
        this.paired = false;
        this.disconnected = false;
        this.initialized = false;
        this.radar_mode = false;
        this.MiPstatus = null;
        this.MiPweight = null;
        this.constants = JSON.parse(fs.readFileSync('../../constants.json', 'utf8'));
        this.commands = this.constants.COMMAND_CODE;
        this.received = false;
        this.peripheral = peripheral;
    }
    Device.prototype.isReady = function () {
        return this.SendDataCharac != null &&
            this.ReceiveDataCharac != null &&
            this.BatteryLevelCharac != null;
    };
    Device.prototype.toString = function () {
        return "MiP: " + this.name;
    };
    Device.prototype.initialize = function (peripheral) {
        var device = this;
        if (device.initialized) {
            console.log("already initialized");
            return;
        }
        device.initialized = true;
        console.log('device initialized');
        device.receive(peripheral);
        var i = 0;
        device.listCommands();
    };
    Device.prototype.getAllInformation = function (peripheral) {
        var device = this;
        device.GET_STUFF(peripheral, "GET_GAME_MDOE");
        device.GET_STUFF(peripheral, "GET_CHEST_RGB_LED");
        device.GET_STUFF(peripheral, "GET_HEAD_LED");
        device.GET_STUFF(peripheral, "GET_ODEMETER");
        device.GET_STUFF(peripheral, "GET_RADAR_MODE");
        device.GET_STUFF(peripheral, "GET_DETECTION_MODE");
        device.GET_STUFF(peripheral, "GET_IR_REMOTE_ONOFF");
        device.GET_STUFF(peripheral, "GET_CLAPS_DETECTION_STATUS");
        device.GET_STUFF(peripheral, "GET_USER_DATA");
        device.GET_STUFF(peripheral, "GET_SOFTWARE_VERSION");
        device.GET_STUFF(peripheral, "GET_HARDWARE_VERSION");
    };
    Device.prototype.receive = function (peripheral) {
        var device = this;
        device.ReceiveDataCharac.notify(true);
        device.ReceiveDataCharac.on("data", function (data, isNotification) {
            device.received = false;
            var str = data.toString();
            var convert = [];
            for (var i = 0; i < str.length; i += 2) {
                convert.push(parseInt("0x" + str.substr(i, 2)));
            }
            if (convert[0] == 121) {
                device.MiPstatus = convert;
                console.log("print status");
                console.log('"ON_BACK": 0, "FACEDOWN": 1, "UP_RIGHT": 2, "PICKED_UP": 3, "HANDSTAND": 4, "FACEDOWN_TRAY": 5, "BACK_WITH_KICKSTAND": 6"');
                console.log("battery level: " + convert[1] + " (77-124) mip position: " + convert[2]);
                device.MiPstatus = convert[1];
            }
            else if (convert[0] == 129) {
                device.MiPweight = convert;
                console.log("print weight");
                console.log("0xD3(-45 degree) - 0x2D(+45 degree) * 0xD3 (211) (max)~0xFF(min) (255) is holding the weight on the front * 0x00(min)~0x2D(max) is holding the weight on the back");
                console.log(convert[1]);
            }
            else if (convert[0] == 120) {
                console.log("print game mode");
            }
            else if (convert[0] == 131) {
                console.log("print chest LED");
                console.log("red: " + convert[1] + " green: " + convert[2] + " blue: " + convert[3] + " on(ms): " + convert[4] * 20 + " off(ms): " + convert[5] * 20);
            }
            else if (convert[0] == 139) {
                console.log("print head LED");
                console.log("0=off, 1=on, 2=blink slow, 3=blink fast, 4=fade in");
                console.log("light1: " + convert[1] + " light2: " + convert[2] + " light3: " + convert[3] + " light4: " + convert[4]);
            }
            else if (convert[0] == 133) {
                console.log("print odometer");
                console.log(data[1]);
                console.log(convert[1]);
            }
            else if (convert[0] == 10) {
                console.log("print gesture detected");
                console.log("left: A, right, B, center sweep left: C, center sweep right: D, center hold: E, forward: F, back: 10");
                console.log(str.substr(i, 2));
            }
            else if (convert[0] == 13) {
                console.log("print gesture radar mode status");
                if (convert[1] == 1) {
                    console.log("disble gesture and radar");
                }
                else if (convert[1] == 2) {
                    console.log("gesture mode on");
                }
                else if (convert[1] == 4) {
                    console.log("radar mode on");
                }
            }
            else if (convert[0] == 12) {
                console.log("print radar response");
                if (convert[1] == 1) {
                    console.log("no object or object disappear");
                }
                else if (convert[1] == 2) {
                    console.log("see object in 10-30 cm");
                }
                else if (convert[1] == 3) {
                    console.log("see object within 10 cm");
                }
            }
            else if (convert[0] == 15) {
                console.log("print detection mode");
                console.log("detection on " + convert[1]);
                console.log("IR Tx power: " + convert[2]);
            }
            else if (convert[0] == 26) {
                console.log("print shake detected");
            }
            else if (convert[0] == 17) {
                console.log("print IR control status");
                console.log(convert[1]);
            }
            else if (convert[0] == 250) {
                console.log("print sleep");
            }
            else if (convert[0] == 22) {
                console.log("print volume level");
                console.log(convert[1]);
            }
            else if (convert[0] == 29) {
                console.log("print clap detected time");
                console.log(convert[1]);
            }
            else if (convert[0] == 31) {
                console.log("print clap status");
                console.log("on: " + convert[1] + " delay time between claps: " + convert[2]);
            }
            else if (convert[0] == 19) {
                console.log("print user data");
                console.log("user data address: " + convert[1] + " , " + convert[2]);
            }
            else if (convert[0] == 20) {
                console.log("print software version");
                console.log({ "year": convert[1], "month": convert[2], "date": convert[3], "#": convert[4] });
            }
            else if (convert[0] == 25) {
                console.log("print hardware version");
                console.log({ "voice_chip": convert[1], "hardware_version": convert[2] });
            }
            console.log(convert);
            device.received = true;
        });
    };
    Device.prototype.listCommands = function () {
        var command_code = Object.keys(this.commands);
        for (var i = 0; i < command_code.length; i++) {
            console.log(i + ": ", command_code[i]);
        }
    };
    Device.prototype.giveCommands = function (peripheral, args) {
        var device = this;
        var data = new Buffer(args.length);
        args.forEach(function (arg, i) {
            data.writeUInt8(arg, i);
        });
        device.SendDataCharac.write(data, true, function (error) {
            if (error) {
                throw new DeviceError(DeviceError.UNEXPECTED_ERROR, "write error: " + error);
            }
        });
    };
    Device.prototype.GET_STUFF = function (peripheral, type) {
        var device = this;
        var value = device.commands[type];
        device.giveCommands(peripheral, [value]);
    };
    Device.prototype.SET_VOLUME_LEVEL = function (peripheral, level) {
        var device = this;
        if (typeof (level) != "number") {
            throw new DeviceError(DeviceError.INVALID_ARGUMENT, "invalid argument");
        }
        if (level < 0) {
            level = 0;
        }
        else if (level > 7) {
            level = 7;
        }
        console.log("set volume");
        device.giveCommands(peripheral, [device.commands["SET_VOLUME_LEVEL"], level]);
        device.GET_STUFF(peripheral, "GET_VOLUME_LEVEL");
    };
    Device.prototype.PLAY_SOUND = function (peripheral, file, time) {
        var device = this;
        file = parseInt(file);
        if (typeof (file) != "number") {
            throw new DeviceError(DeviceError.INVALID_ARGUMENT, 'invalid argument');
        }
        if (file < 1 || file > 106) {
            file = 1;
        }
        time = parseInt(time);
        if (typeof (time) != "number") {
            throw new DeviceError(DeviceError.INVALID_ARGUMENT, "invalid argument");
        }
        if (time < 1) {
            time = 1;
        }
        else if (time > 256) {
            time = 256;
        }
        console.log("play sound");
        device.giveCommands(peripheral, [device.commands["PLAY_SOUND"], file, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, time]);
    };
    Device.prototype.DRIVE_FIXED = function (peripheral, backward, distance, clockwise, angle) {
        var device = this;
        var direction = 0;
        var turn_direction = 0;
        var high_byte = 0;
        var low_byte = angle;
        if (backward) {
            direction = 1;
        }
        if (typeof (distance) != "number") {
            throw new DeviceError(DeviceError.INVALID_ARGUMENT, "invalid argument");
        }
        if (distance < 0) {
            distance = 0;
        }
        else if (distance > 255) {
            distance = 255;
        }
        if (clockwise) {
            turn_direction = 1;
        }
        if (angle > 255) {
            high_byte = 1;
            low_byte = angle - 255;
        }
        console.log("drive fixed distance");
        device.giveCommands(peripheral, [device.commands["DRIVE_FIXED_DISTANCE"], direction, distance, turn_direction, high_byte, low_byte]);
    };
    Device.prototype.DRIVE_TIME = function (peripheral, backward, speed, time) {
        var device = this;
        var direction = 113;
        if (backward) {
            direction = 114;
        }
        if (speed < 0) {
            speed = 0;
        }
        else if (speed > 30) {
            speed = 30;
        }
        if (time < 0) {
            time = 0;
        }
        else if (time > 255) {
            time = 255;
        }
        console.log("drive with time");
        device.giveCommands(peripheral, [direction, speed, time]);
    };
    Device.prototype.DRIVE_CONTINUOUS = function (peripheral, crazy, backward, move_speed, right, spin_speed) {
        var device = this;
        var direction_with_speed = 1;
        var spin = 0x41;
        if (move_speed < 1) {
            move_speed = 1;
        }
        else if (move_speed > 32) {
            move_speed = 32;
        }
        if (spin_speed < 1) {
            spin_speed = 1;
        }
        else if (spin_speed > 32) {
            spin_speed = 32;
        }
        if (crazy) {
            if (backward) {
                direction_with_speed = 161 + move_speed - 1;
            }
            else {
                direction_with_speed = 129 + move_speed - 1;
            }
            if (right) {
                spin = 193 + spin_speed - 1;
            }
            else {
                spin = 225 + spin_speed - 1;
            }
        }
        else {
            if (backward) {
                direction_with_speed = 33 + move_speed - 1;
            }
            else {
                direction_with_speed = 1 + move_speed - 1;
            }
            if (right) {
                spin = 65 + spin_speed - 1;
            }
            else {
                spin = 97 + spin_speed - 1;
            }
        }
        console.log("drive continuously");
        device.giveCommands(peripheral, [device.commands["DRIVE_CONTINOUS"], direction_with_speed, spin]);
    };
    Device.prototype.SET_FALL_POSITION = function (peripheral, front) {
        var device = this;
        var face = 0;
        if (front) {
            face = 1;
        }
        console.log("set position");
        device.giveCommands(peripheral, [device.commands["SHOULD_FALLOVER"], face]);
    };
    Device.prototype.GET_UP = function (peripheral, front, back) {
        var device = this;
        var direction = 0;
        if (front && back) {
            direction = 2;
        }
        else if (front) {
            direction = 0;
        }
        else {
            direction = 1;
        }
        console.log("get up");
        device.giveCommands(peripheral, [device.commands["GET_UP_FROM_POSITION"], direction]);
    };
    Device.prototype.TURN = function (peripheral, right, angle, speed) {
        var device = this;
        var direction = 115;
        if (right) {
            direction = 116;
        }
        angle = angle / 5;
        if (speed < 0) {
            speed = 0;
        }
        else if (speed > 24) {
            speed = 24;
        }
        console.log("turn");
        device.giveCommands(peripheral, [direction, angle, speed]);
    };
    Device.prototype.SET_CHEST_RGB_LED = function (peripheral, red, green, blue) {
        var device = this;
        if (red < 0) {
            red = 0;
        }
        else if (red > 255) {
            red = 255;
        }
        if (green < 0) {
            green = 0;
        }
        else if (green > 255) {
            green = 255;
        }
        if (blue < 0) {
            blue = 0;
        }
        else if (red > 255) {
            blue = 255;
        }
        console.log("change chest light");
        device.giveCommands(peripheral, [device.commands["SET_CHEST_RGB_LED"], red, green, blue]);
        device.GET_STUFF(peripheral, "GET_CHEST_RGB_LED");
    };
    Device.prototype.FLASH_CHEST_RGB_LED = function (peripheral, red, green, blue, onTime, offTime) {
        var device = this;
        for (var i = 1; i < arguments.length; i++) {
            if (arguments[i] < 0) {
                arguments[i] = 0;
            }
            else if (arguments[i] > 255) {
                arguments[i] = 255;
            }
        }
        console.log("change chest light");
        device.giveCommands(peripheral, [device.commands["FLASH_CHEST_RGB_LED"], red, green, blue, onTime / 20, offTime / 20]);
    };
    Device.prototype.SET_HEAD_LED = function (peripheral, light1, light2, light3, light4) {
        var device = this;
        for (var i = 1; i < arguments.length; i++) {
            if (arguments[i] < 1) {
                arguments[i] = 1;
            }
            else if (arguments[i] > 4) {
                arguments[i] = 4;
            }
        }
        console.log("set head light");
        device.giveCommands(peripheral, [device.commands["SET_HEAD_LED"], light1, light2, light3, light4]);
        device.GET_STUFF(peripheral, "GET_HEAD_LED");
    };
    Device.prototype.RESET_ODEMETER = function (peripheral) {
        var device = this;
        console.log("reset odometer");
        device.giveCommands(peripheral, [device.commands["RESET_ODEMETER"]]);
        device.GET_STUFF(peripheral, "GET_ODEMETER");
    };
    Device.prototype.SET_GESTURE_RADAR_MODE = function (peripheral, gesture, radar) {
        var device = this;
        var value = 0;
        if (gesture) {
            value = 2;
            console.log("set to gesture mode");
        }
        else if (radar) {
            value = 4;
            console.log("set to radar mode");
        }
        else {
            console.log("disable gesture and radar");
        }
        device.giveCommands(peripheral, [device.commands["SET_GESTURE_RADAR_MODE"], value]);
        device.GET_STUFF(peripheral, "GET_RADAR_MODE");
    };
    Device.prototype.SET_DETECTION_MODE = function (peripheral, id, power) {
        var device = this;
        if (id < 0) {
            id = 0;
        }
        else if (id > 255) {
            id = 0;
        }
        if (power < 1) {
            id = 1;
        }
        else if (id > 120) {
            id = 120;
        }
        console.log("set dection mode");
        device.giveCommands(peripheral, [device.commands["SET_DETECTION_MODE"], id, power]);
        device.GET_STUFF(peripheral, "GET_DETECTION_MODE");
    };
    Device.prototype.SET_IR_REMOTE_ONOFF = function (peripheral, on) {
        var device = this;
        var value = 0;
        if (on) {
            value = 1;
        }
        console.log("set IR remote");
        device.giveCommands(peripheral, [device.commands["SET_IR_REMOTE_ONOFF"], value]);
        device.GET_STUFF(peripheral, "GET_IR_REMOTE_ONOFF");
    };
    Device.prototype.SET_CLAPS_DETECTION_STATUS = function (peripheral, on) {
        var device = this;
        var value = 0;
        if (on) {
            value = 1;
        }
        console.log("set clap dection");
        device.giveCommands(peripheral, [device.commands["SET_CLAPS_DETECTION_STATUS"], value]);
    };
    Device.prototype.SET_CLAPS_DETECTION_TIMING = function (peripheral, time) {
        var device = this;
        var high = 0;
        var low = time;
        while (time > 255) {
            high++;
            low = time - 255;
        }
        console.log("set delay time between two claps");
        device.giveCommands(peripheral, [device.commands["SET_CLAPS_DETECTION_TIMING"], high, low]);
        device.GET_STUFF(peripheral, "GET_CLAPS_DETECTION_STATUS");
    };
    Device.prototype.STOP = function (peripheral) {
        var device = this;
        console.log("stop");
        device.giveCommands(peripheral, [device.commands["STOP"]]);
    };
    Device.prototype.SET_GAME_MODE = function (peripheral, option) {
        var device = this;
        console.log("set mode");
        device.giveCommands(peripheral, [device.commands["SET_GAME_MODE"], option]);
        device.GET_STUFF(peripheral, "GET_GAME_MDOE");
    };
    Device.prototype.promiseReadDataFromCharacteristic = function (peripheral, service) {
        var device = this;
        return q.Promise(function (resolve, reject) {
            service.discoverCharacteristics([], function (error, charateristics) {
                charateristics.forEach(function (charac) {
                    if (charac.uuid.toUpperCase() == Device.SEND_DATA_UUID.toUpperCase()) {
                        device.SendDataCharac = charac;
                    }
                    else if (charac.uuid.toUpperCase() == Device.RECEIVE_DATA_UUID.toUpperCase()) {
                        device.ReceiveDataCharac = charac;
                    }
                    else if (charac.uuid.toUpperCase() == Device.BATTERY_LEVEL_UUID.toUpperCase()) {
                        device.BatteryLevelCharac = charac;
                    }
                });
                resolve();
            });
        });
    };
    Device.PRODUCT_ID = 5;
    Device.UUID = '29b4ec3c21e040aba7db557d4cadc2a6';
    Device.SERVICE_UUID = ["fff0", "ffb0"];
    Device.Info_Service_UUID = '180A';
    Device.Device_Battery_UUID = '180F';
    Device.SEND_DATA = 'ffe5';
    Device.RECEIVE_DATA = 'ffe0';
    Device.BATTERY_LEVEL = '180f';
    Device.SEND_DATA_UUID = 'ffe9';
    Device.RECEIVE_DATA_UUID = 'ffe4';
    Device.BATTERY_LEVEL_UUID = '2a19';
    Device.supportedServices = [
        Device.SEND_DATA,
        Device.RECEIVE_DATA,
        Device.BATTERY_LEVEL
    ];
    Device.DEVICE_NAME_UUID = "ff91";
    Device.PRODUCT_ID_UUID = "ff96";
    Device.deviceWithPeripheral = function (peripheral, success, failed) {
        console.log("getting peripheral: " + peripheral);
        console.log("advertisement: " + peripheral.advertisement);
        var localName = peripheral.advertisement['localName'];
        console.log("got device: MiP( " + localName);
        var device = new Device(peripheral);
        device.name = localName;
        device.disconnected = false;
        device.paired = false;
        peripheral.discoverServices(Device.supportedServices, function (error, services) {
            console.log("discover services with count: " + services.length);
            if (services.length < Device.supportedServices.length) {
                failed(peripheral, DeviceError.SERVICE_NOT_MATCHED);
            }
            var promises = [];
            services.forEach(function (service) {
                console.log("discover service with uuid: " + service.uuid);
                promises.push(device.promiseReadDataFromCharacteristic(peripheral, service));
            });
            console.log("promises: ${promises}");
            q.all(promises)
                .then(function () {
                if (device.isReady()) {
                    device.paired = true;
                    device.initialize(peripheral);
                    success(device);
                }
                else {
                    failed(peripheral, DeviceError.CHARACTERISTIC_NOT_MATCHED);
                }
            }).catch(function () {
                failed(peripheral, DeviceError.CHARACTERISTIC_NOT_MATCHED);
            });
        });
    };
    Device.getProductId = function (peripheral) {
        var data = peripheral.advertisement.manufacturerData;
        if (data != null) {
            return data[0] << 8 | data[1];
        }
        else {
            return -1;
        }
    };
    return Device;
}());
noble.on("stateChange", function (state) {
    console.log("state changed with value: " + state);
    if (state == 'poweredOn') {
        console.log('start scanning!');
        noble.startScanning(Device.SERVICE_UUID);
    }
    else {
        noble.stopScanning();
    }
});
noble.on("discover", function (peripheral) {
    if (Device.getProductId(peripheral) != Device.PRODUCT_ID) {
        return;
    }
    ;
    var localName = peripheral.advertisement['localName'];
    console.log('Got device: ' + localName);
    var device = new Device(peripheral);
    device.name = localName;
    peripheral.connect(function (error) {
        if (error != undefined) {
            console.log(peripheral.uuid + " RSSI: " + peripheral.rssi + " Connecting, Error : " + error);
        }
        else {
            console.log(peripheral.uuid + " RSSI: " + peripheral.rssi);
            console.log('connected to peripheral: ' + peripheral.uuid);
            Device.deviceWithPeripheral(peripheral, function (device) {
                console.log("success");
                setTimeout(function () {
                }, 5000);
            }, function (peripheral, error) {
                throw new DeviceError(error, "fail to connect");
            });
        }
    });
});
