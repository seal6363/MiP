/// <reference path="typings/index.d.ts" />

// import noble = require('noble');

import noble = require('noble');
import fs = require('fs');
import promise = require('bluebird');
import readline = require('readline');


var rl = readline.createInterface({input: process.stdin, output: process.stdout});


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
    static SERVICE_NOT_ENOUGH = 505;
    static CHARACTERISTIC_NOT_MATCHED = 504;
    static REQUIRE_PAIRING = 401;
    static REVISION_NOT_MATCHED = 502;
    static COMPASS_NOT_READY = 503;
    static UNEXPECTED_ERROR = 500;
    static INVALID_ARGUMENT = 600;
}


class Device {
    static PRODUCT_ID = 5;

    static UUID = '29b4ec3c21e040aba7db557d4cadc2a6';
    static SERVICE_UUID = ["fff0","ffb0"];
    static Info_Service_UUID = '180A';
    static Device_Battery_UUID = '180F';
	
    static SEND_DATA = 'ffe5';
    static RECEIVE_DATA = 'ffe0';
    static BATTERY_LEVEL = '180f';

	static SEND_DATA_UUID = 'ffe9';
	static RECEIVE_DATA_UUID= 'ffe4';
    static BATTERY_LEVEL_UUID = '2a19';
 
    static supportedServices = [
        Device.SEND_DATA,
		Device.RECEIVE_DATA,
	    Device.BATTERY_LEVEL
        ];

	// charac
	static DEVICE_NAME_UUID = "ff91";
	static PRODUCT_ID_UUID = "ff96";

    peripheral: noble.Peripheral = null;
	
	SendDataCharac: noble.Characteristic = null;
	ReceiveDataCharac: noble.Characteristic = null;
	BatteryLevelCharac: noble.Characteristic = null;
	RssiReportCharac: noble.Characteristic = null;
	DeviceInfoCharac: noble.Characteristic = null;
	DeviceSettingCharac: noble.Characteristic = null;
	DfuCharac: noble.Characteristic = null;
	ModuleParameterCharac: noble.Characteristic = null;
	NuvotonBootloaderCharac: noble.Characteristic = null;

	name: string = undefined;
    paired: boolean = false;
    disconnected: boolean = false;
    initialized: boolean = false;
    radar_mode: boolean = false;
    MiPstatus: any = null;
    MiPweight: any = null;
    obstacle: number = 0;
	constants: JSON = JSON.parse(fs.readFileSync('../../constants.json', 'utf8'));
    commands: JSON = this.constants.COMMAND_CODE;
    received: boolean = false;
    

    constructor(peripheral: noble.Peripheral) {
        this.peripheral = peripheral;
    }
    isReady(): Boolean {
        return this.SendDataCharac != null &&
		this.ReceiveDataCharac != null &&
		this.BatteryLevelCharac != null;
    }

    toString(): String {
        return `MiP: ${this.name}`;
    }

    initialize(): void {
        var device = this;

		if (device.initialized) {
			console.log("already initialized");
			return;
		}

		device.initialized = true;
        console.log('device initialized');
        device.receive();
        
        var p = new promise(function(resolve, reject) {
            resolve();
        });
        p.delay(1000).then(
            function() {device.SET_IR_REMOTE_ONOFF(true);}
        ).delay(500).then(
            function() {device.RESET_ODEMETER();}
        ).delay(500).then(
            function() {device.SET_VOLUME_LEVEL(4);}
        ).delay(500).then(
            function() {device.SET_GESTURE_RADAR_MODE(false, true);}
        ).delay(500).then(
            function() {device.SET_CLAPS_DETECTION_STATUS(true);}
        )
    }

    

    receive(): any {
        var device = this;
        
        device.ReceiveDataCharac.notify(true);
		device.ReceiveDataCharac.on("data", function(data, isNotification){
            device.received = false;
            var str = data.toString();
	        var convert = [];
            for (var i=0; i<str.length; i+=2) {
                convert.push(parseInt("0x"+str.substr(i, 2)));
            }
            if(convert[0] == device.commands["GET_STATUS"]) {
                device.MiPstatus = convert;
                console.log("print status");
                console.log('"ON_BACK": 0, "FACEDOWN": 1, "UP_RIGHT": 2, "PICKED_UP": 3, "HANDSTAND": 4, "FACEDOWN_TRAY": 5, "BACK_WITH_KICKSTAND": 6"');
                console.log("battery level: " + convert[1] + " (77-124) mip position: " + convert[2]);
                device.MiPstatus = convert[1];
            } else if (convert[0] == device.commands["GET_WEIGHT_LEVEL"]) {
                device.MiPweight = convert;
                console.log("print weight");
                console.log("0xD3(-45 degree) - 0x2D(+45 degree) * 0xD3 (211) (max)~0xFF(min) (255) is holding the weight on the front * 0x00(min)~0x2D(max) is holding the weight on the back");
                console.log(convert[1]);
            } else if (convert[0] == device.commands["GET_GAME_MDOE"]) {
                console.log("print game mode");
            } else if (convert[0] == device.commands["GET_CHEST_RGB_LED"]) {
                console.log("print chest LED");
                console.log("red: " + convert[1] + " green: " + convert[2] + " blue: " + convert[3] + " on(ms): " + convert[4] * 20 + " off(ms): " + convert[5] * 20);
            } else if (convert[0] == device.commands["GET_HEAD_LED"]) {
                console.log("print head LED");
                console.log("0=off, 1=on, 2=blink slow, 3=blink fast, 4=fade in");
                console.log("light1: " + convert[1] + " light2: " + convert[2] + " light3: " + convert[3] + " light4: " + convert[4]);
                
            } else if (convert[0] == device.commands["GET_ODEMETER"]) {
                console.log("print odometer");
                var value = 0;
                for (var i = 1; i <= 4; i++) {
                    value += data[i] * Math.pow(256, 4-i);
                }
                console.log(value);
                
            } else if (convert[0] == device.commands["GET_GESTURE_MODE"]) {
                console.log("print gesture detected");
                console.log("left: A, right, B, center sweep left: C, center sweep right: D, center hold: E, forward: F, back: 10");
                console.log(str.substr(i, 2));
            } else if (convert[0] == device.commands["GET_RADAR_MODE"]) {
                console.log("print gesture radar mode status");
                if (convert[1] == 1) {
                    console.log("disble gesture and radar");
                } else if (convert[1] == 2) {
                    console.log("gesture mode on");
                } else if (convert[1] == 4) {
                    console.log("radar mode on");
                }           
            } else if (convert[0] == device.commands["RADAR_RESPONSE"]) {
                console.log("print radar response")
                if (convert[1] == 1) {
                    console.log("no object or object disappear");
                } else if (convert[1] == 2) {
                    console.log("see object in 10-30 cm");
                } else if (convert[1] == 3) {
                    console.log("see object within 10 cm");
                }
                device.obstacle = convert[1];
            } else if (convert[0] == device.commands["GET_DETECTION_MODE"]) {
                console.log("print detection mode");
                console.log("detection on " + convert[1]);
                console.log("IR Tx power: " + convert[2]);
            } else if (convert[0] == device.commands["SHAKE_DETECTED"]) {
                console.log("print shake detected");
            } else if (convert[0] == device.commands["GET_IR_REMOTE_ONOFF"]) {
                console.log("print IR control status");
                console.log(convert[1]);
            } else if (convert[0] == device.commands["SHOULD_SLEEP"]) {
                console.log("print sleep");
            } else if (convert[0] == device.commands["GET_VOLUME_LEVEL"]) {
                console.log("print volume level");
                console.log(convert[1]);
            } else if (convert[0] == device.commands["CLAPS_DETECTED"]) {
                console.log("print clap detected count");
                console.log(convert[1]);
            } else if (convert[0] == device.commands["GET_CLAPS_DETECTION_STATUS"]) {
                console.log("print clap status");
                console.log("on: " + convert[1] + " delay time between claps: " + convert[2]);
            } else if (convert[0] == device.commands["GET_USER_DATA"]) {
                console.log("print user data");
                console.log("user data address: " + convert[1] + " , " + convert[2]);
            } else if (convert[0] == device.commands["GET_SOFTWARE_VERSION"]) {
                console.log("print software version");
                console.log({"year": convert[1], "month": convert[2], "date": convert[3], "#": convert[4]});
            } else if (convert[0] == device.commands["GET_HARDWARE_VERSION"]) {
                console.log("print hardware version");
                console.log({"voice_chip": convert[1], "hardware_version": convert[2]});
            } else if (convert[0] == device.commands["GET_MIP_DETECTION_MODE"]) {
                console.log("print detected");
                console.log("detect" + convert[1]);
            }
            console.log(convert);
            device.received = true;
		});
    }

    giveCommands(args: number[]): any {
        var device = this;

        var data = new Buffer(args.length);
        args.forEach(function(arg: number[], i: number): void {
            data.writeUInt8(arg, i);
        });

        device.SendDataCharac.write(data, true, function (error) {
            if (error) {
                throw new DeviceError(DeviceError.UNEXPECTED_ERROR, "write error: " + error);
            }
        });
    }    


    promiseReadDataFromCharacteristic(service: noble.Service): any {
        var device = this;
        return new Promise(function (resolve: () => void, reject: any) {
            service.discoverCharacteristics([], function(error, charateristics){
                charateristics.forEach(function(charac: noble.Characteristic) {
                    if (charac.uuid.toUpperCase() == Device.SEND_DATA_UUID.toUpperCase()) {
                        device.SendDataCharac = charac;
                    } else if (charac.uuid.toUpperCase() == Device.RECEIVE_DATA_UUID.toUpperCase()) {
                        device.ReceiveDataCharac = charac;    
                    } else if (charac.uuid.toUpperCase() == Device.BATTERY_LEVEL_UUID.toUpperCase()) {
                        device.BatteryLevelCharac = charac;
                    }
                });
                resolve();
            });
        });
    }

    GET_ALL_INFO(): any {
        var device = this;
        
        function task(callback: any, command: String) {
            device.GET_STUFF(command);
            setTimeout(function() {
                callback();
            }, 50);
            
        };
       
       function executeTasks() {
            var commands = Array.prototype.concat.apply([], arguments);
            var command = commands.shift();
            task(function() {
                if(commands.length > 0)
                    executeTasks.apply(this, commands);
            }, command);
        };

        executeTasks("GET_GAME_MDOE", "GET_CHEST_RGB_LED", "GET_HEAD_LED", "GET_ODEMETER", "GET_RADAR_MODE", "GET_DETECTION_MODE", "GET_IR_REMOTE_ONOFF", "GET_CLAPS_DETECTION_STATUS", "GET_USER_DATA", "GET_SOFTWARE_VERSION", "GET_HARDWARE_VERSION");

    }

    GET_STUFF(type: String): any {
        var device = this;
        var value = device.commands[type];

        device.giveCommands([value]);
    }

    SHOULD_DISCONNECT_APP_MODE() {
        var device = this;
        console.log("disconnect app");
        device.giveCommands([device.commands["SHOULD_DISCONNECT_APP_MODE"]]);
        device.GET_STUFF("GET_GAME_MDOE");
    }

    // volume level: 0-7
    SET_VOLUME_LEVEL(level: number): any {
        var device = this;
        if (typeof(level) != "number") {
                throw new DeviceError(DeviceError.INVALID_ARGUMENT, "invalid argument");
        }

        if (level < 0) {
            level = 0;
        } else if (level > 7) {
            level = 7;
        }
        console.log("set volume");
        device.giveCommands([device.commands["SET_VOLUME_LEVEL"], level]);
        device.GET_STUFF("GET_VOLUME_LEVEL");
    }

    PLAY_SOUND(file: number, time: number): any {
        var device = this;

        file = parseInt(file);
        if (typeof(file) != "number") {
            throw new DeviceError(DeviceError.INVALID_ARGUMENT, 'invalid argument');
        }

        if (file < 1 || file > 106) {
            file = 1;
        } 

        time = parseInt(time);
        if (typeof(time) != "number") {
            throw new DeviceError(DeviceError.INVALID_ARGUMENT, "invalid argument");
        }

        if (time < 1) {
            time = 1;
        } else if (time > 256) {
            time = 256;
        }
        console.log("play sound");
        device.giveCommands([device.commands["PLAY_SOUND"], file, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, time-1]);
    
    }
    // queued up for multiple commands (up to 20)
    DRIVE_FIXED_DISTANCE(distanceInCm: number, degree: number): any {
        var device = this;

        var direction = (distanceInCm > 0) ? device.constants["DRIVE_DIRECTION"]["FORWARD"] : device.constants["DRIVE_DIRECTION"]["BACKWARD"];
	    var distance = Math.round(Math.abs(distanceInCm));
	    var turn = (degree < 0) ? device.constants["DRIVE_DIRECTION"]["TURN_CLOCKWISE"] : device.constants["DRIVE_DIRECTION"]["TURN_ANTI_CLOCKWISE"];
	    var angle1 = Math.round(Math.abs(degree)) >> 8;
	    var angle2 = Math.round(Math.abs(degree)) & 0x00ff;
        console.log("drive fixed distance")
        device.giveCommands([device.commands["DRIVE_FIXED_DISTANCE"], direction, distance, turn, angle1, angle2]);
    }

    DRIVE_TIME(backward: boolean, speed: number, time: number): any {
        var device = this;

        var direction = 113;
        if (backward) {
            direction = 114;
        }
        speed = Math.ceil(31 * speed / 100);
        if (time < 0) {
            time = 0;
        } else if (time > 255) {
            time = 255;
        }
        console.log("drive with time")
        device.giveCommands([direction, speed, time]);
    }
    // x: left and right, y: forward and backward
    // need to be sent every 50 ms
    DRIVE_CONTINUOUS(x: number, y: number): any {
        var device = this;
        var driveValue = Math.round(Math.min(100, Math.abs(y)) * 32 / 100);
	    var turnValue = Math.round(Math.min(100, Math.abs(x)) * 32 / 100);
	
	    driveValue += (y > 0) ? device.constants["DRIVE_CONTINOUS_VALUE"]["FW_SPEED1"] : device.constants["DRIVE_CONTINOUS_VALUE"]["BW_SPEED1"];
	    turnValue += (x > 0) ? device.constants["DRIVE_CONTINOUS_VALUE"]["RIGHT_SPEED1"] : device.constants["DRIVE_CONTINOUS_VALUE"]["LEFT_SPEED1"];
        console.log(driveValue + " " + turnValue + device.commands["DRIVE_CONTINOUS"]);
        console.log("drive continuously");
        device.giveCommands([device.commands["DRIVE_CONTINOUS"], driveValue, turnValue]);

    }
    // x: left and right, y: forward and backward
    // need to be sent every 50 ms
    DRIVE_CONTINUOUS_CRAZY(x: number, y: number): any {
        var device = this;
        var driveValue = Math.round(Math.min(100, Math.abs(y)) * 32 / 100);
	    var turnValue = Math.round(Math.min(100, Math.abs(x)) * 32 / 100);
	
	    driveValue += (y > 0) ? device.constants["DRIVE_CONTINOUS_CRAZY_VALUE"]["FW_SPEED1"] : device.constants["DRIVE_CONTINOUS_CRAZY_VALUE"]["BW_SPEED1"];
	    turnValue += (x > 0) ? Math.min(device.constants["DRIVE_CONTINOUS_CRAZY_VALUE"]["RIGHT_SPEED1"], 223) : device.constants["DRIVE_CONTINOUS_CRAZY_VALUE"]["LEFT_SPEED1"];
        console.log(turnValue);
        console.log("drive continuously");
        device.giveCommands([device.commands["DRIVE_CONTINOUS"], driveValue, turnValue]);

    }

// Set Mip to fall down to front or back;
    SHOULD_FALLOVER(front: boolean): any {
        var device = this;

        var face = 0;
        if (front) {
            face = 1;
        }
        console.log("set position");
        device.giveCommands([device.commands["SHOULD_FALLOVER"], face]);
    }

    // Mip will attempt to get up from front or back if angle is correct
    GET_UP(front: boolean, back: boolean): any {
        var device = this;

        var direction = 0;

        if (front && back) {
            direction = 2;
        } else if (front) {
            direction = 0;
        } else {
            direction = 1;
        }
        console.log("get up");
        device.giveCommands([device.commands["GET_UP_FROM_POSITION"], direction]);
    }

    TURN(right: boolean, angle: number, speed: number): any {
        var device = this;

        var direction = 115;
        if (right) {
            direction = 116;
        }

        angle = angle / 5;
        speed = Math.ceil(25 * speed / 100);
    
        console.log("turn");
        device.giveCommands([direction, angle, speed]);
    } 

    SET_CHEST_RGB_LED(red: number, green: number, blue: number) {
        var device = this;

        if (red < 0) {
            red = 0;
        } else if (red > 255) {
            red = 255;
        }
        if (green < 0) {
            green = 0;
        } else if (green > 255) {
            green = 255;
        }
        if (blue < 0) {
            blue = 0;
        } else if (red > 255) {
            blue = 255;
        }
        console.log("change chest light");
        device.giveCommands([device.commands["SET_CHEST_RGB_LED"], red, green, blue]);
        device.GET_STUFF("GET_CHEST_RGB_LED");
    }

    // onTime and offTime in ms
    FLASH_CHEST_RGB_LED(red: number, green: number, blue: number, onTime: number, offTime: number) {
        var device = this;

        for (var i = 1; i < arguments.length; i++) {
            if (arguments[i] < 0) {
                arguments[i] = 0;
            } else if (arguments[i] > 255) {
                arguments[i] = 255;
            }
        }
       
        console.log("change chest light");
        device.giveCommands([device.commands["FLASH_CHEST_RGB_LED"], red, green, blue, onTime / 20, offTime / 20]);        
    }

    //0=off, 1=on, 2=blink slow, 3=blink fast
    SET_HEAD_LED(light1: number, light2: number, light3: number, light4: number) {
        var device = this;
        for (var i = 1; i < arguments.length; i++) {
            if (arguments[i] < 1) {
                arguments[i] = 1;
            } else if (arguments[i] > 4) {
                arguments[i] = 4;
            }
        }
        console.log("set head light");
        device.giveCommands([device.commands["SET_HEAD_LED"], light1, light2, light3, light4]);        
        device.GET_STUFF("GET_HEAD_LED");
    }

    RESET_ODEMETER() {
        var device = this;
        console.log("reset odometer");
        device.giveCommands([device.commands["RESET_ODEMETER"]]);
        device.GET_STUFF("GET_ODEMETER");
    }

    // either gesture mode or radar mode can be turn on
    SET_GESTURE_RADAR_MODE(gesture: boolean, radar: boolean) {
        var device = this;
        var value = 0;
        if (gesture) {
            value = 2;
            console.log("set to gesture mode");
        } else if (radar) {
            value = 4;
            console.log("set to radar mode");
        } else {
            console.log("disable gesture and radar");
        }
        device.giveCommands([device.commands["SET_GESTURE_RADAR_MODE"], value]);
        device.GET_STUFF("GET_RADAR_MODE");
    }

    // Tu turn off dection mode, pass id with 0
    // IR Tx power (1~120) (about 1~300 cm)
    SET_MIP_DETECTION_MODE(id: number, power: number) {
        var device = this;
        if (id < 0) {
            id = 0;
        } else if (id > 255) {
            id = 0;
        }
        if (power < 1) {
            id = 1;
        } else if (id > 120) {
            id = 120;
        }
        console.log("set dection mode");
        device.giveCommands([device.commands["SET_MIP_DETECTION_MODE"], id, power]);
        device.GET_STUFF("GET_MIP_DETECTION_MODE");
    }

    SET_IR_REMOTE_ONOFF(on: boolean) {
        var device = this;
        var value = 0;
        if (on) {
            value = 1;
        }
        console.log("set IR remote");
        device.giveCommands([device.commands["SET_IR_REMOTE_ONOFF"], value]);
        device.GET_STUFF("GET_IR_REMOTE_ONOFF");
    }

    SET_CLAPS_DETECTION_STATUS(on: boolean) {
        var device = this;
        var value = 0;
        if (on) {
            value = 1;
        }
        console.log("set clap dection");
        device.giveCommands([device.commands["SET_CLAPS_DETECTION_STATUS"], value]);
    }
    // set delay time between two claps
    SET_CLAPS_DETECTION_TIMING(time: number) {
        var device = this;
        var high = 0;
        var low = time;
        while (time > 255) {
            high++;
            low = time - 255;   
        } 
        console.log("set delay time between two claps");
        device.giveCommands([device.commands["SET_CLAPS_DETECTION_TIMING"], high, low]);
        device.GET_STUFF("GET_CLAPS_DETECTION_STATUS");
    }

    STOP() {
        var device = this;

        console.log("stop");
        device.giveCommands([device.commands["STOP"]]);
    }

// not ready for tickle
//"APP": 1, "CAGE": 2, "TRACKING": 3, "DANCE": 4, "DEFAULT": 5, "STACK": 6, "TRICK": 7, "ROAM": 8
    SET_GAME_MODE(option: number): any {
        var device = this;

        console.log("set mode");
        device.giveCommands([device.commands["SET_GAME_MODE"], option]);
        device.GET_STUFF("GET_GAME_MDOE");
    }
    


    /**
     * The static method to get device with corresponding peripheral
     * @param peripheral {any} The discovered peripheral instance
     * @param success {function} The success callback. Will pass with a device instance corresponding to the peripheral
     * @param failed {function} The failed callback. Will pass with the original peripheral and the error code.
     */
    static deviceWithPeripheral = function (peripheral: noble.Peripheral, success: (device: Device) => void, failed: (code: number) => void) {
        console.log("getting peripheral: " + peripheral);
        console.log("advertisement: " + peripheral.advertisement);
        var localName = peripheral.advertisement['localName'];
        console.log("got device: MiP( " + localName);
        var device = new Device(peripheral);
        device.name = localName;
        device.disconnected = false;
        device.paired = false;

        peripheral.discoverServices(Device.supportedServices, function (error: string, services: noble.Service[]) {
            console.log("discover services with count: " + services.length);
            if (services.length < Device.supportedServices.length) {
                failed(DeviceError.SERVICE_NOT_MATCHED);
            }
            var promises: any[] = [];
            services.forEach(function (service: noble.Service) {
                console.log("discover service with uuid: " + service.uuid);
                promises.push(device.promiseReadDataFromCharacteristic(service));
            });
            console.log("promises: ${promises}");
            promise.all(promises)
            .then(function () {
                if (device.isReady()) {
                    device.paired = true;
                    device.initialize();
                    success(device);
                }
                else {
                    failed(DeviceError.CHARACTERISTIC_NOT_MATCHED);
                }
            }).catch(function() {
                failed(DeviceError.CHARACTERISTIC_NOT_MATCHED);
            });
        });
    }

    static getProductId = function (peripheral: noble.Peripheral): number {
        var data = peripheral.advertisement.manufacturerData;
        if (data != null) {
            return data[0] << 8 | data[1];
        }
        else {
            return -1;
        }
    }
}
module.exports.Device = Device;
module.exports.DeviceError = DeviceError;