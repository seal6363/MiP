var noble = require('noble');
var MiP = require('./MiP');
var promise = require('bluebird');
var readline = require('readline');
var rl = readline.createInterface(process.stdin, process.stdout);
var Device = MiP.Device;
var DeviceError = MiP.DeviceError;

var device = null;
var valid_commands = [
                            ["GET_ALL_INFO"],
                            ["SHOULD_DISCONNECT_APP_MODE"],
                            ["SET_VOLUME_LEVEL", 7], 
                            ["PLAY_SOUND", 2, 1], 
                            ["DRIVE_FIXED_DISTANCE", 30, 0],
                            ["DRIVE_TIME", false, 60, 10000], 
                            ["DRIVE_CONTINUOUS", 30, 30], 
                            ["SHOULD_FALLOVER", true], 
                            ["GET_UP", true, true],
                            ["TURN", false, 90, 100],
                            ["SET_CHEST_RGB_LED", 66, 66, 66],
                            ["FLASH_CHEST_RGB_LED", 77, 77, 77, 5, 5],
                            ["SET_HEAD_LED", 2, 3, 2, 3],
                            ["RESET_ODEMETER"], 
                            ["SET_GESTURE_RADAR_MODE", false, true],
                            ["STOP"]
                            ];
var command_functions = null;
var command_queue = [];

function listCommands() {
        for (var i = 0; i < valid_commands.length; i++) {
            console.log(i + ": " + valid_commands[i][0]);
        }
}
 

function requestCommands() {
        rl.question("which one: ", function(ans) {
            var selectedOption = valid_commands[ans];
            if (selectedOption != null) {
                console.log("valid option");
                command_queue.push(selectedOption);
            } else {
                throw new DeviceError(DeviceError.INVALID_ARGUMENT, "invalid argument");
            }
            requestCommands();
        });
        
}

function processCommands(device) {
    setInterval(function() {
        if (command_queue.length > 0) {
            var current = command_queue.shift();
            var fn = command_functions[current[0]];
            fn.apply(device, current.slice(1));
        }
    }, 50);
}

 noble.on(`stateChange`, function (state) {
        console.log("state changed with value: " + state);
        if (state == 'poweredOn') {
            console.log('start scanning!');
            noble.startScanning(Device.SERVICE_UUID);
        } else {
            noble.stopScanning();
        }
    });
	
	noble.on(`discover`, function (peripheral) {
        if (Device.getProductId(peripheral) != Device.PRODUCT_ID) {
            return;
        };

        var localName = peripheral.advertisement['localName'];
        console.log('Got device: ' + localName);
        device = new Device(peripheral);
        device.name = localName;
        //device.successConnectedCallback = 'success';
        peripheral.connect(function (error) {
            if (error != undefined) {
                console.log(peripheral.uuid + " RSSI: " + peripheral.rssi + " Connecting, Error : " + error);
            } else {
                console.log(peripheral.uuid + " RSSI: " + peripheral.rssi);
                console.log('connected to peripheral: ' + peripheral.uuid);
                command_functions = Object.getPrototypeOf(device);
                Device.deviceWithPeripheral(peripheral, function(device){
                    setTimeout(function() {
                        console.log("------------LIST COMMNANDS--------------");
                        listCommands();
                        console.log("----------------------------------------");
                        requestCommands();
                        processCommands(device);
                    }, 4000);
                    
                }, 
                    function(error) {
                    throw new DeviceError(error, "fail to connect");
                });
            }

        });
    });

    function drive_clockwise_continuous(peripheral, device) {
        setInterval(function() {
            device.DRIVE_CONTINUOUS(peripheral, 1, 1);
        }, 50);
    }


