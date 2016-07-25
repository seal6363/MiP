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
        this.get_status = false;
        this.MiPstatus = null;
        this.MiPweight = null;
        this.constants = JSON.parse(fs.readFileSync('../../constants.json', 'utf8'));
        this.received = false;
        this.READING_CONSTANTS = ["GET_STATUS", "GET_WEIGHT_LEVEL", "GET_GAME_MDOE", "GET_CHEST_RGB_LED", "GET_HEAD_LED",
            "GET_ODEMETER", "GET_RADAR_MODE", "GET_DETECTION_MODE", "OTHER_MIP_DETECTED", "SHAKE_DETECTED",
            "GET_IR_REMOTE_ONOFF", "GET_USER_DATA", "GET_VOLUME_LEVEL", "RECEIVE_IR_COMMAND", "CLAPS_DETECTED", "GET_CLAPS_DETECTION_STATUS"];
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
        var reading = function () {
            console.log("reading");
            if (i >= device.READING_CONSTANTS.length) {
                i = 0;
            }
            device.GET_STUFF(peripheral, device.READING_CONSTANTS[i]);
            i++;
        };
        var timer = setInterval(reading, 1000);
        device.listCommands();
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
            if (device.get_status && convert[0] == 121) {
                device.MiPstatus = convert;
                console.log("print status");
                device.get_status = false;
            }
            else if (convert[0] == 129) {
                device.MiPweight = convert;
                console.log("print weight");
            }
            else if (convert[0] == 120) {
                console.log("print game mode");
            }
            else if (convert[0] == 131) {
                console.log("print chest LED");
            }
            else if (convert[0] == 139) {
                console.log("print head LED");
            }
            else if (convert[0] == 133) {
                console.log("print odometer");
            }
            console.log(convert);
            device.received = true;
        });
    };
    Device.prototype.listCommands = function () {
        var command_code = Object.keys(this.constants.COMMAND_CODE);
        for (var i = 0; i < command_code.length; i++) {
            console.log(i + ": ", command_code[i]);
        }
    };
    Device.prototype.prepareCommands = function (peripheral) {
        var device = this;
        device.requestCommands(function (index, selectedOption) {
            var args = [selectedOption];
            if (selectedOption == 21) {
                device.DRIVE_TIME(peripheral, false, 20, 30);
            }
            else if (selectedOption == 6) {
                device.USER_PLAY_SOUND(peripheral, args);
            }
            else if (selectedOption == 112) {
                device.USER_DRIVE_FIXED(peripheral, args);
            }
        });
    };
    Device.prototype.requestCommands = function (callback) {
        var command_code = this.constants.COMMAND_CODE;
        var selectedOption;
        rl.question("which one: ", function (ans) {
            var selectedOption = command_code[ans].value;
            if (selectedOption != null) {
                console.log("valid option");
                callback(ans, selectedOption);
            }
            else {
                throw new DeviceError(DeviceError.INVALID_ARGUMENT, "invalid argument");
            }
        });
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
        var command_code = this.constants.COMMAND_CODE;
        var value = command_code[type];
        device.giveCommands(peripheral, [value]);
    };
    Device.prototype.GET_RADAR_RESPONSE = function (peripheral) {
        var device = this;
        if (device.radar_mode) {
            device.giveCommands(peripheral, [12]);
        }
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
        device.giveCommands(peripheral, [21, level]);
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
        device.giveCommands(peripheral, [6, file, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, time]);
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
        device.giveCommands(peripheral, [112, direction, distance, turn_direction, high_byte, low_byte]);
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
        device.giveCommands(peripheral, [120, direction_with_speed, spin]);
    };
    Device.prototype.SET_FALL_POSITION = function (peripheral, front) {
        var device = this;
        var face = 0;
        if (front) {
            face = 1;
        }
        console.log("set position");
        device.giveCommands(peripheral, [8, face]);
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
        device.giveCommands(peripheral, [35, direction]);
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
        device.giveCommands(peripheral, [132, red, green, blue]);
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
        device.giveCommands(peripheral, [137, red, green, blue, onTime / 20, offTime / 20]);
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
        device.giveCommands(peripheral, [138, light1, light2, light3, light4]);
    };
    Device.prototype.RESET_ODEMETER = function (peripheral) {
        var device = this;
        console.log("reset odometer");
        device.giveCommands(peripheral, [134]);
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
        device.giveCommands(peripheral, [13, value]);
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
        device.giveCommands(peripheral, [14, id, power]);
    };
    Device.prototype.SET_IR_REMOTE_ONOFF = function (peripheral, on) {
        var device = this;
        var value = 0;
        if (on) {
            value = 1;
        }
        console.log("set IR remote");
        device.giveCommands(peripheral, [16, value]);
    };
    Device.prototype.SET_CLAPS_DETECTION_STATUS = function (peripheral, on) {
        var device = this;
        var value = 0;
        if (on) {
            value = 1;
        }
        console.log("set clap dection");
        device.giveCommands(peripheral, [30, value]);
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
        device.giveCommands(peripheral, [32, high, low]);
    };
    Device.prototype.STOP = function (peripheral) {
        var device = this;
        console.log("stop");
        device.giveCommands(peripheral, [119]);
    };
    Device.prototype.SET_GAME_MODE = function (peripheral, option) {
        var device = this;
        console.log("set mode");
        device.giveCommands(peripheral, [118, option]);
    };
    Device.prototype.USER_SET_VOLUME_LEVEL = function (peripheral, args) {
        var device = this;
        rl.question("Set volume level to (0-7) ", function (ans) {
            ans = parseInt(ans);
            if (typeof (ans) != "number") {
                throw new DeviceError(DeviceError.INVALID_ARGUMENT, "invalid argument");
            }
            if (ans < 0) {
                ans = 0;
            }
            else if (ans > 7) {
                ans = 7;
            }
            args.push(ans);
            device.giveCommands(peripheral, args);
        });
    };
    Device.prototype.USER_PLAY_SOUND = function (peripheral, args) {
        var device = this;
        rl.question("Play what sound? ", function (ans) {
            ans = parseInt(ans);
            if (typeof (ans) != "number") {
                throw new DeviceError(DeviceError.INVALID_ARGUMENT, 'invalid argument');
            }
            if (ans < 1 || ans > 106) {
                ans = 1;
            }
            args.push(ans);
            for (var i = 0; i < 15; i++) {
                args.push(0);
            }
            rl.question("Play how many times? (1-256) ", function (ans) {
                ans = parseInt(ans);
                if (typeof (ans) != "number") {
                    throw new DeviceError(DeviceError.INVALID_ARGUMENT, "invalid argument");
                }
                if (ans < 1) {
                    ans = 1;
                }
                else if (ans > 256) {
                    ans = 256;
                }
                args.push(ans - 1);
                device.giveCommands(peripheral, args);
            });
        });
    };
    Device.prototype.USER_DRIVE_FIXED = function (peripheral, args) {
        var device = this;
        rl.question("Drive forward or backward? (f or b) ", function (ans) {
            if (ans == 'f') {
                args.push(0);
            }
            else if (ans == 'b') {
                args.push(1);
            }
            else {
                throw new DeviceError(DeviceError.INVALID_ARGUMENT, "invalid argument");
            }
            rl.question("Distance (0-255 cm)", function (ans) {
                ans = parseInt(ans);
                if (typeof (ans) != "number") {
                    throw new DeviceError(DeviceError.INVALID_ARGUMENT, "invalid argument");
                }
                if (ans < 0) {
                    ans = 0;
                }
                else if (ans > 255) {
                    ans = 255;
                }
                args.push(ans);
                for (var i = 0; i < 3; i++) {
                    args.push(0);
                }
                device.giveCommands(peripheral, args);
            });
        });
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
    console.log('Got device');
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
                device.SET_CHEST_RGB_LED(peripheral, 255, 0, 0);
            }, function (peripheral, error) {
                throw new DeviceError(error, "fail to connect");
            });
        }
    });
});
