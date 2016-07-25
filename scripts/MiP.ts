/// <reference path="typings/index.d.ts" />

// import noble = require('noble');

import noble = require('noble');

import fs = require('fs');
import q = require('q');
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

    initialize(peripheral: noble.Peripheral): void {
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
    }

    getAllInformation(peripheral: noble.Peripheral): any {
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
    }

    receive(peripheral: noble.Peripheral): any {
        var device = this;
        
        device.ReceiveDataCharac.notify(true);
		device.ReceiveDataCharac.on("data", function(data, isNotification){
            device.received = false;
            var str = data.toString();
	        var convert = [];
            for (var i=0; i<str.length; i+=2) {
                convert.push(parseInt("0x"+str.substr(i, 2)));
            }
            if(convert[0] == 121) {
                device.MiPstatus = convert;
                console.log("print status");
                console.log('"ON_BACK": 0, "FACEDOWN": 1, "UP_RIGHT": 2, "PICKED_UP": 3, "HANDSTAND": 4, "FACEDOWN_TRAY": 5, "BACK_WITH_KICKSTAND": 6"');
                console.log("battery level: " + convert[1] + " (77-124) mip position: " + convert[2]);
                device.MiPstatus = convert[1];
            } else if (convert[0] == 129) {
                device.MiPweight = convert;
                console.log("print weight");
                console.log("0xD3(-45 degree) - 0x2D(+45 degree) * 0xD3 (211) (max)~0xFF(min) (255) is holding the weight on the front * 0x00(min)~0x2D(max) is holding the weight on the back");
                console.log(convert[1]);
            } else if (convert[0] == 120) {
                console.log("print game mode");
            } else if (convert[0] == 131) {
                console.log("print chest LED");
                console.log("red: " + convert[1] + " green: " + convert[2] + " blue: " + convert[3] + " on(ms): " + convert[4] * 20 + " off(ms): " + convert[5] * 20);
            } else if (convert[0] == 139) {
                console.log("print head LED");
                console.log("0=off, 1=on, 2=blink slow, 3=blink fast, 4=fade in");
                console.log("light1: " + convert[1] + " light2: " + convert[2] + " light3: " + convert[3] + " light4: " + convert[4]);
                
            } else if (convert[0] == 133) {
                console.log("print odometer");
                console.log(data[1]);
                console.log(convert[1]);
                
            } else if (convert[0] == 10) {
                console.log("print gesture detected");
                console.log("left: A, right, B, center sweep left: C, center sweep right: D, center hold: E, forward: F, back: 10");
                console.log(str.substr(i, 2));
            } else if (convert[0] == 13) {
                console.log("print gesture radar mode status");
                if (convert[1] == 1) {
                    console.log("disble gesture and radar");
                } else if (convert[1] == 2) {
                    console.log("gesture mode on");
                } else if (convert[1] == 4) {
                    console.log("radar mode on");
                }           
            } else if (convert[0] == 12) {
                console.log("print radar response")
                if (convert[1] == 1) {
                    console.log("no object or object disappear");
                } else if (convert[1] == 2) {
                    console.log("see object in 10-30 cm");
                } else if (convert[1] == 3) {
                    console.log("see object within 10 cm");
                }
            } else if (convert[0] == 15) {
                console.log("print detection mode");
                console.log("detection on " + convert[1]);
                console.log("IR Tx power: " + convert[2]);
            } else if (convert[0] == 26) {
                console.log("print shake detected");
            } else if (convert[0] == 17) {
                console.log("print IR control status");
                console.log(convert[1]);
            } else if (convert[0] == 250) {
                console.log("print sleep");
            } else if (convert[0] == 22) {
                console.log("print volume level");
                console.log(convert[1]);
            } else if (convert[0] == 29) {
                console.log("print clap detected time");
                console.log(convert[1]);
            } else if (convert[0] == 31) {
                console.log("print clap status");
                console.log("on: " + convert[1] + " delay time between claps: " + convert[2]);
            } else if (convert[0] == 19) {
                console.log("print user data");
                console.log("user data address: " + convert[1] + " , " + convert[2]);
            } else if (convert[0] == 20) {
                console.log("print software version");
                console.log({"year": convert[1], "month": convert[2], "date": convert[3], "#": convert[4]});
            } else if (convert[0] == 25) {
                console.log("print hardware version");
                console.log({"voice_chip": convert[1], "hardware_version": convert[2]});
            }
            console.log(convert);
            device.received = true;
		});
    }

    listCommands(): void {
        var command_code = Object.keys(this.commands);

        for (var i = 0; i < command_code.length; i++) {
            console.log(i + ": " command_code[i]);
        }
    }

    giveCommands(peripheral: noble.Peripheral, args: number[]): any {
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


    GET_STUFF(peripheral: noble.Peripheral, type: String): any {
        var device = this;
        var value = device.commands[type];

        device.giveCommands(peripheral, [value]);
    }


    // volume level: 0-7
    SET_VOLUME_LEVEL(peripheral: noble.Peripheral, level: number): any {
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
        device.giveCommands(peripheral, [device.commands["SET_VOLUME_LEVEL"], level]);
        device.GET_STUFF(peripheral, "GET_VOLUME_LEVEL");
    }

    PLAY_SOUND(peripheral: noble.Peripheral, file: number, time: number): any {
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
        device.giveCommands(peripheral, [device.commands["PLAY_SOUND"], file, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, time]);
    
    }
    
    DRIVE_FIXED(peripheral: noble.Peripheral, backward: boolean, distance: number, clockwise: boolean, angle: number): any {
        var device = this;

        var direction = 0;
        var turn_direction = 0;
        var high_byte = 0;
        var low_byte = angle;
        if (backward) {
            direction = 1;
        }
        if (typeof(distance) != "number") {
            throw new DeviceError(DeviceError.INVALID_ARGUMENT, "invalid argument");
        }

        if (distance < 0) {
            distance = 0;
        } else if (distance > 255) {
            distance = 255;
        }

        if (clockwise) {
            turn_direction = 1;
        }

        if (angle > 255) {
            high_byte = 1;
            low_byte = angle - 255;
        }
        console.log("drive fixed distance")
        device.giveCommands(peripheral, [device.commands["DRIVE_FIXED_DISTANCE"], direction, distance, turn_direction, high_byte, low_byte]);
    }

    DRIVE_TIME(peripheral: noble.Peripheral, backward: boolean, speed: number, time: number): any {
        var device = this;

        var direction = 113;
        if (backward) {
            direction = 114;
        }
        if (speed < 0) {
            speed = 0;
        } else if (speed > 30) {
            speed = 30;
        }
        if (time < 0) {
            time = 0;
        } else if (time > 255) {
            time = 255;
        }
        console.log("drive with time")
        device.giveCommands(peripheral, [direction, speed, time]);
    }

// Not working
    DRIVE_CONTINUOUS(peripheral: noble.Peripheral, crazy: boolean, backward: boolean, move_speed: number, right: boolean, spin_speed): any {
        var device = this;

        var direction_with_speed = 1;
        var spin = 0x41;
        if (move_speed < 1) {
            move_speed = 1;
        } else if( move_speed > 32) {
            move_speed = 32;
        }
        if (spin_speed < 1) {
            spin_speed = 1;
        } else if(spin_speed > 32) {
            spin_speed = 32;
        }
        if (crazy) {
            if (backward) {
                direction_with_speed = 161 + move_speed - 1;
            } else /* forward */ {
                direction_with_speed = 129 + move_speed - 1;
            }
            if (right) {
                spin = 193 + spin_speed - 1;
            } else /* left */ {
                spin = 225 + spin_speed - 1;
            }
        } else /* normal */ {
            if (backward) {
                direction_with_speed = 33 + move_speed - 1;
            } else /* forward */ {
                direction_with_speed = 1 + move_speed - 1;
            }
            if (right) {
                spin = 65 + spin_speed - 1;
            } else /* left */ {
                spin = 97 + spin_speed - 1;
            }
        }

        console.log("drive continuously");
        device.giveCommands(peripheral, [device.commands["DRIVE_CONTINOUS"], direction_with_speed, spin]);

    }

// Set Mip to fall down to front or back;
    SET_FALL_POSITION(peripheral: noble.Peripheral, front: boolean): any {
        var device = this;

        var face = 0;
        if (front) {
            face = 1;
        }
        console.log("set position");
        device.giveCommands(peripheral, [device.commands["SHOULD_FALLOVER"], face]);
    }

    // Mip will attempt to get up from front or back if angle is correct
    GET_UP(peripheral: noble.Peripheral, front: boolean, back: boolean): any {
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
        device.giveCommands(peripheral, [device.commands["GET_UP_FROM_POSITION"], direction]);
    }

    TURN(peripheral: noble.Peripheral, right: boolean, angle: number, speed: number): any {
        var device = this;

        var direction = 115;
        if (right) {
            direction = 116;
        }

        angle = angle / 5;

        if (speed < 0) {
            speed = 0;
        } else if (speed > 24) {
            speed = 24;
        }
        console.log("turn");
        device.giveCommands(peripheral, [direction, angle, speed]);
    } 

    SET_CHEST_RGB_LED(peripheral: noble.Peripheral, red: number, green: number, blue: number) {
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
        device.giveCommands(peripheral, [device.commands["SET_CHEST_RGB_LED"], red, green, blue]);
        device.GET_STUFF(peripheral, "GET_CHEST_RGB_LED");
    }

    // onTime and offTime in ms
    FLASH_CHEST_RGB_LED(peripheral: noble.Peripheral, red: number, green: number, blue: number, onTime: number, offTime: number) {
        var device = this;

        for (var i = 1; i < arguments.length; i++) {
            if (arguments[i] < 0) {
                arguments[i] = 0;
            } else if (arguments[i] > 255) {
                arguments[i] = 255;
            }
        }
       
        console.log("change chest light");
        device.giveCommands(peripheral, [device.commands["FLASH_CHEST_RGB_LED"], red, green, blue, onTime / 20, offTime / 20]);        
    }

    //0=off, 1=on, 2=blink slow, 3=blink fast, 4=fade in
    SET_HEAD_LED(peripheral: noble.Peripheral, light1: number, light2: number, light3: number, light4: number) {
        var device = this;
        for (var i = 1; i < arguments.length; i++) {
            if (arguments[i] < 1) {
                arguments[i] = 1;
            } else if (arguments[i] > 4) {
                arguments[i] = 4;
            }
        }
        console.log("set head light");
        device.giveCommands(peripheral, [device.commands["SET_HEAD_LED"], light1, light2, light3, light4]);        
        device.GET_STUFF(peripheral, "GET_HEAD_LED");
    }

    RESET_ODEMETER(peripheral: noble.Peripheral) {
        var device = this;
        console.log("reset odometer");
        device.giveCommands(peripheral, [device.commands["RESET_ODEMETER"]]);
        device.GET_STUFF(peripheral, "GET_ODEMETER");
    }

    // either gesture mode or radar mode can be turn on
    SET_GESTURE_RADAR_MODE(peripheral: noble.Peripheral, gesture: boolean, radar: boolean) {
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
        device.giveCommands(peripheral, [device.commands["SET_GESTURE_RADAR_MODE"], value]);
        device.GET_STUFF(peripheral, "GET_RADAR_MODE");
    }

    // Tu turn off dection mode, pass id with 0
    // IR Tx power (1~120) (about 1~300 cm)
    SET_DETECTION_MODE(peripheral: noble.Peripheral, id: number, power: number) {
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
        device.giveCommands(peripheral, [device.commands["SET_DETECTION_MODE"], id, power]);
        device.GET_STUFF(peripheral, "GET_DETECTION_MODE");
    }

    SET_IR_REMOTE_ONOFF(peripheral: noble.Peripheral, on: boolean) {
        var device = this;
        var value = 0;
        if (on) {
            value = 1;
        }
        console.log("set IR remote");
        device.giveCommands(peripheral, [device.commands["SET_IR_REMOTE_ONOFF"], value]);
        device.GET_STUFF(peripheral, "GET_IR_REMOTE_ONOFF");
    }

    SET_CLAPS_DETECTION_STATUS(peripheral: noble.Peripheral, on: boolean) {
        var device = this;
        var value = 0;
        if (on) {
            value = 1;
        }
        console.log("set clap dection");
        device.giveCommands(peripheral, [device.commands["SET_CLAPS_DETECTION_STATUS"], value]);
    }
    // set delay time between two claps
    SET_CLAPS_DETECTION_TIMING(peripheral: noble.Peripheral, time: number) {
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
    }

    STOP(peripheral: noble.Peripheral) {
        var device = this;

        console.log("stop");
        device.giveCommands(peripheral, [device.commands["STOP"]]);
    }

// not ready for tickle
//"APP": 1, "CAGE": 2, "TRACKING": 3, "DANCE": 4, "DEFAULT": 5, "STACK": 6, "TRICK": 7, "ROAM": 8
    SET_GAME_MODE(peripheral: noble.Peripheral, option: number): any {
        var device = this;

        console.log("set mode");
        device.giveCommands(peripheral, [device.commands["SET_GAME_MODE"], option]);
        device.GET_STUFF(peripheral, "GET_GAME_MDOE");
    }
    
    promiseReadDataFromCharacteristic(peripheral: noble.Peripheral, service: noble.Service): any {
        var device = this;
        return q.Promise(function (resolve: () => void, reject: any) {
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


    /**
     * The static method to get device with corresponding peripheral
     * @param peripheral {any} The discovered peripheral instance
     * @param success {function} The success callback. Will pass with a device instance corresponding to the peripheral
     * @param failed {function} The failed callback. Will pass with the original peripheral and the error code.
     */
    static deviceWithPeripheral = function (peripheral: noble.Peripheral, success: (device: Device) => void, failed: (peripheral: noble.Peripheral, code: number) => void) {
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
                failed(peripheral, DeviceError.SERVICE_NOT_MATCHED);
            }
            var promises: any[] = [];
            services.forEach(function (service: noble.Service) {
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
            }).catch(function() {
                failed(peripheral, DeviceError.CHARACTERISTIC_NOT_MATCHED);
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

    noble.on(`stateChange`, function (state: String): void {
        console.log("state changed with value: " + state);
        if (state == 'poweredOn') {
            console.log('start scanning!');
            noble.startScanning(Device.SERVICE_UUID);
        } else {
            noble.stopScanning();
        }
    });
	
	noble.on(`discover`, function (peripheral: noble.Peripheral): void {
        if (Device.getProductId(peripheral) != Device.PRODUCT_ID) {
            return;
        };

        var localName = peripheral.advertisement['localName'];
        console.log('Got device: ' + localName);
        var device = new Device(peripheral);
        device.name = localName;
        //device.successConnectedCallback = 'success';
        peripheral.connect(function (error: String) {
            if (error != undefined) {
                console.log(peripheral.uuid + " RSSI: " + peripheral.rssi + " Connecting, Error : " + error);
            } else {
                console.log(peripheral.uuid + " RSSI: " + peripheral.rssi);
                console.log('connected to peripheral: ' + peripheral.uuid);
                Device.deviceWithPeripheral(peripheral, function(device: Device){
                    console.log("success");
                    setTimeout(function() {
                        //device.getAllInformation(peripheral);
                    }, 5000);
                }, 
                    function(peripheral: noble.Peripheral, error: number) {
                    throw new DeviceError(error, "fail to connect");
                });
            }

        });
    });