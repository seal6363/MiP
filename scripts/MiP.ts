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
   // static RSSI_REPORT_UUID = 'FFA0';
    //static DEVICE_INFO_UUID = '180A';
    //static DEVICE_SETTING_UUID = 'FF10';
    //static DFU_UUID = 'FF30';
    //static MODULE_PARAMETER_UUID = 'FF90';
    //static NUVOTON_BOOTLOADER_UUID = 'FF00';
 
    static supportedServices = [
        Device.SEND_DATA,
		Device.RECEIVE_DATA,
	    Device.BATTERY_LEVEL
	    //Device.RSSI_REPORT_UUID,
	    //Device.DEVICE_INFO_UUID,
	    //Device.DEVICE_SETTING_UUID,
	    //Device.DFU_UUID,
	    //Device.MODULE_PARAMETER_UUID,
	    //Device.NUVOTON_BOOTLOADER_UUID
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
    get_status: boolean = false;
    MiPstatus: any = null;
    MiPweight: any = null;
	constants: JSON = JSON.parse(fs.readFileSync('../../constants.json', 'utf8'));
    received: boolean = false;
    

    constructor(peripheral: noble.Peripheral) {
        this.peripheral = peripheral;
    }
    isReady(): Boolean {
        return this.SendDataCharac != null &&
		this.ReceiveDataCharac != null &&
		this.BatteryLevelCharac != null;
		//this.RssiReportCharac != null &&
		//this.DeviceInfoCharac != null &&
		//this.DeviceSettingCharac != null &&
		//this.DfuCharac != null &&
		//this.ModuleParameterCharac != null &&
		//this.NuvotonBootloaderCharac != null;
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
        /*var promises = [];
        device.READING_CONSTANTS.forEach(function (name, i) {
            promises.push(q.Promise(function (resolve: () => void, reject: any) {
                device.GET_STUFF(peripheral, device.READING_CONSTANTS[i]);
                if (device.received) {
                    resolve();
                    console.log(device.received);
                }
            }));
        });
        q.all(promises).then(function(){console.log("empty success")}).catch(function() {console.log("fail");});*/
        var reading = function () {
            console.log("reading");
            if (i >= device.READING_CONSTANTS.length) {
                i = 0;
            }
            device.GET_STUFF(peripheral, device.READING_CONSTANTS[i]);
            i++;
        }

       var timer = setInterval(reading, 1000);

        device.listCommands();
        //device.prepareCommands(peripheral);
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
            if(device.get_status && convert[0] == 121) {
                device.MiPstatus = convert;
                console.log("print status");
                device.get_status = false;
            } else if (convert[0] == 129) {
                device.MiPweight = convert;
                console.log("print weight");
            } else if (convert[0] == 120) {
                console.log("print game mode");
            } else if (convert[0] == 131) {
                console.log("print chest LED");
            } else if (convert[0] == 139) {
                console.log("print head LED");
            } else if (convert[0] == 133) {
                console.log("print odometer");
            } 
            console.log(convert);
            device.received = true;
		});
    }

    listCommands(): void {
        var command_code = Object.keys(this.constants.COMMAND_CODE);

        for (var i = 0; i < command_code.length; i++) {
            console.log(i + ": " command_code[i]);
        }
    }

    prepareCommands(peripheral: noble.Peripheral): void {
        var device = this;

        device.requestCommands(function (index: number, selectedOption: number) {
            var args = [selectedOption];
            if (selectedOption == 21) {
                                    device.DRIVE_TIME(peripheral, false, 20, 30);

                //device.DRIVE_FIXED(peripheral, false, 20, true, 90)
                //device.USER_SET_VOLUME_LEVEL(peripheral, args);
            } else if (selectedOption == 6) {
                device.USER_PLAY_SOUND(peripheral, args);
            } else if (selectedOption == 112) {
                device.USER_DRIVE_FIXED(peripheral, args);
            }
        })
    } 

    requestCommands(callback: any): void {
        var command_code = this.constants.COMMAND_CODE;
        var selectedOption;

        rl.question("which one: ", function(ans: number): any {
            var selectedOption = command_code[ans].value;
            if (selectedOption != null) {
                console.log("valid option");
                callback (ans, selectedOption);
            } else {
                throw new DeviceError(DeviceError.INVALID_ARGUMENT, "invalid argument");

            }
        });
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
            //device.prepareCommands(peripheral);
        });
    }    
//////READ....

    READING_CONSTANTS: String[] = ["GET_STATUS", "GET_WEIGHT_LEVEL", "GET_GAME_MDOE", "GET_CHEST_RGB_LED", "GET_HEAD_LED",
    "GET_ODEMETER", "GET_RADAR_MODE", "GET_DETECTION_MODE", "OTHER_MIP_DETECTED", "SHAKE_DETECTED"/* detect automatically*/,
    "GET_IR_REMOTE_ONOFF", "GET_USER_DATA", "GET_VOLUME_LEVEL", "RECEIVE_IR_COMMAND", "CLAPS_DETECTED", "GET_CLAPS_DETECTION_STATUS"];


    GET_STUFF(peripheral: noble.Peripheral, type: String): any {
        var device = this;
        var command_code = this.constants.COMMAND_CODE;
        var value = command_code[type];

        device.giveCommands(peripheral, [value]);
    }

    


////// Can't find
    GET_RADAR_RESPONSE(peripheral: noble.Peripheral) {
        var device = this;
        if (device.radar_mode) {
            device.giveCommands(peripheral, [12])
        }
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
        device.giveCommands(peripheral, [21, level]);
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
        device.giveCommands(peripheral, [6, file, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, time]);
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
        device.giveCommands(peripheral, [112, direction, distance, turn_direction, high_byte, low_byte]);
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
        device.giveCommands(peripheral, [120, direction_with_speed, spin]);

    }

// Set Mip to fall down to front or back;
    SET_FALL_POSITION(peripheral: noble.Peripheral, front: boolean): any {
        var device = this;

        var face = 0;
        if (front) {
            face = 1;
        }
        console.log("set position");
        device.giveCommands(peripheral, [8, face]);
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
        device.giveCommands(peripheral, [35, direction]);
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
        device.giveCommands(peripheral, [132, red, green, blue]);
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
        device.giveCommands(peripheral, [137, red, green, blue, onTime / 20, offTime / 20]);        
    }

    //0=off, 1=on, 2=blink slow, 3=blink fast
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
        device.giveCommands(peripheral, [138, light1, light2, light3, light4]);        

    }

    RESET_ODEMETER(peripheral: noble.Peripheral) {
        var device = this;
        console.log("reset odometer");
        device.giveCommands(peripheral, [134]);
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
        device.giveCommands(peripheral, [13, value]);
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
        device.giveCommands(peripheral, [14, id, power]);
    }

    SET_IR_REMOTE_ONOFF(peripheral: noble.Peripheral, on: boolean) {
        var device = this;
        var value = 0;
        if (on) {
            value = 1;
        }
        console.log("set IR remote");
        device.giveCommands(peripheral, [16, value]);
    }

    SET_CLAPS_DETECTION_STATUS(peripheral: noble.Peripheral, on: boolean) {
        var device = this;
        var value = 0;
        if (on) {
            value = 1;
        }
        console.log("set clap dection");
        device.giveCommands(peripheral, [30, value]);
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
        device.giveCommands(peripheral, [32, high, low]);
    }

    STOP(peripheral: noble.Peripheral) {
        var device = this;

        console.log("stop");
        device.giveCommands(peripheral, [119]);
    }

    
    


// not ready for tickle
    SET_GAME_MODE(peripheral: noble.Peripheral, option: number): any {
        var device = this;

        console.log("set mode");
        device.giveCommands(peripheral, [118, option]);
    }

/////////////////// USER PROMPT VERSION ///////////////////////
    USER_SET_VOLUME_LEVEL(peripheral: noble.Peripheral, args: number[]): any {
        var device = this;

        rl.question("Set volume level to (0-7) ", function (ans: any): any {
            ans = parseInt(ans);
            if (typeof(ans) != "number") {
                throw new DeviceError(DeviceError.INVALID_ARGUMENT, "invalid argument");
            }

            if (ans < 0) {
                ans = 0;
            } else if (ans > 7) {
                ans = 7;
            }
            args.push(ans);
            device.giveCommands(peripheral, args);
        });
    }

    USER_PLAY_SOUND(peripheral: noble.Peripheral, args: number[]): any {
        var device = this;

        rl.question("Play what sound? ", function (ans: any) {
            ans = parseInt(ans);
            if (typeof(ans) != "number") {
                throw new DeviceError(DeviceError.INVALID_ARGUMENT, 'invalid argument');
            }

            if (ans < 1 || ans > 106) {
                ans = 1;
            } 
            args.push(ans);

            for (var i = 0; i < 15; i++) {
            args.push(0);
            }

            rl.question("Play how many times? (1-256) ", function (ans: any) {
                ans = parseInt(ans);
                if (typeof(ans) != "number") {
                    throw new DeviceError(DeviceError.INVALID_ARGUMENT, "invalid argument");
                }

                if (ans < 1) {
                    ans = 1;
                } else if (ans > 256) {
                    ans = 256;
                }
                args.push(ans - 1);
                device.giveCommands(peripheral, args);

            });
        });
    }

    USER_DRIVE_FIXED(peripheral: noble.Peripheral, args: number[]): any {
        var device = this;

        rl.question("Drive forward or backward? (f or b) ", function (ans: String) {
            
            if (ans == 'f') {
                args.push(0);
            } else if (ans == 'b') {
                args.push(1);
            } else {
                throw new DeviceError(DeviceError.INVALID_ARGUMENT, "invalid argument");
            }

            rl.question("Distance (0-255 cm)", function (ans: any) {
                ans = parseInt(ans);
                if (typeof(ans) != "number") {
                    throw new DeviceError(DeviceError.INVALID_ARGUMENT, "invalid argument");
                }

                if (ans < 0) {
                    ans = 0;
                } else if (ans > 255) {
                    ans = 255;
                }
                args.push(ans);
                for (var i = 0; i < 3; i++) {
                    args.push(0);
                }
                device.giveCommands(peripheral, args);
                
            }); 
        });
    }
////\\\\\\\\\\\\\\ USER PROMPT VERSION \\\\\\\\\\\\\\\\\\\\\\
    
    
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
        console.log('Got device');

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
                    device.SET_CHEST_RGB_LED(peripheral, 255, 0, 0);
                }, 
                    function(peripheral: noble.Peripheral, error: number) {
                    throw new DeviceError(error, "fail to connect");
                });
            }

        });
    });