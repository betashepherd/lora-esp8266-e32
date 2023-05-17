load('api_arduino_ssd1306.js');
load('api_config.js');
load('api_events.js');
load('api_gpio.js');
load('api_mqtt.js');
load('api_timer.js');
load('api_sys.js');
load('api_uart.js');





//////////////////////////
// e32 module init
//////////////////////////
let e32_m0 = 5; // D1
let e32_m1 = 4; // D2
/////////////////////////////////
GPIO.set_mode(e32_m0, GPIO.MODE_OUTPUT);
GPIO.set_mode(e32_m1, GPIO.MODE_OUTPUT);

//set work mode
GPIO.write(e32_m0, 0);
GPIO.write(e32_m1, 0);

Timer.set(1500, 0, function () {
  // Wait for sometime for e32 module init work mode
}, null);
///////////////////////////////
// e32 module init end
///////////////////////////////

//////////////////////////
// Initialize Adafruit_SSD1306 library (I2C)
let d = Adafruit_SSD1306.create_i2c(14, Adafruit_SSD1306.RES_128_64);
// Initialize the display.
d.begin(Adafruit_SSD1306.SWITCHCAPVCC, 0x3C, true /* reset */);
d.display();
let showStr = function(d, str) {
  d.clearDisplay();
  d.setTextSize(2);
  d.setTextColor(Adafruit_SSD1306.WHITE);
  d.setCursor(d.width() / 4, d.height() / 4);
  d.write(str);
  d.display();
};
//////////////////////////

let btn = Cfg.get('board.btn1.pin');              // Built-in button GPIO
let led = Cfg.get('board.led1.pin');              // Built-in LED GPIO number
let onhi = Cfg.get('board.led1.active_high');     // LED on when high?
let state = {on: false, btnCount: 0, uptime: 0};  // Device state
let online = false;                               // Connected to the cloud?

let setLED = function(on) {
  let level = onhi ? on : !on;
  GPIO.write(led, level);
  print('LED on ->', on);
};

GPIO.set_mode(led, GPIO.MODE_OUTPUT);
setLED(state.on);

// Update state every second, and report to cloud if online
Timer.set(1000, Timer.REPEAT, function() {
  state.uptime = Sys.uptime();
  state.ram_free = Sys.free_ram();
  print('online:', online, JSON.stringify(state));
}, null);

if (btn >= 0) {
  let btnCount = 0;
  let btnPull, btnEdge;
  if (Cfg.get('board.btn1.pull_up') ? GPIO.PULL_UP : GPIO.PULL_DOWN) {
    btnPull = GPIO.PULL_UP;
    btnEdge = GPIO.INT_EDGE_NEG;
  } else {
    btnPull = GPIO.PULL_DOWN;
    btnEdge = GPIO.INT_EDGE_POS;
  }
  GPIO.set_button_handler(btn, btnPull, btnEdge, 20, function() {
    state.btnCount++;
    let message = JSON.stringify(state);
    let sendMQTT = false;
    // AWS is handled as plain MQTT since it allows arbitrary topics.
    if (sendMQTT) {
      let topic = 'devices/' + Cfg.get('device.id') + '/events';
      print('== Publishing to ' + topic + ':', message);
      MQTT.pub(topic, message, 0 /* QoS */);
    }
  }, null);
}

let uartNo = 0;   // Uart number used for this example
let rxAcc = '';   // Accumulated Rx data, will be echoed back to Tx
// Configure UART at 115200 baud
UART.setConfig(uartNo, {
  baudRate: 115200,
});

// // Set dispatcher callback, it will be called whenver new Rx data or space in
// // the Tx buffer becomes available
// UART.setDispatcher(uartNo, function(uartNo) {
//   let ra = UART.readAvail(uartNo);
//   if (ra > 0) {
//     // Received new data: print it immediately to the console, and also
//     // accumulate in the "rxAcc" variable which will be echoed back to UART later
//     let data = UART.read(uartNo);
//     print('Received UART data:', data);
//     rxAcc += data;
//   }
// }, null);
//
// // Enable Rx
// UART.setRxEnabled(uartNo, true);

// Send UART data every second
Timer.set(1000 /* milliseconds */, Timer.REPEAT, function() {
  UART.write(uartNo, 'AF01');
  UART.write(uartNo, '17');
  let data = 'Hello E32! ' + '\n';
  UART.write(uartNo, data);
  showStr(d, data);
  rxAcc = '';
}, null);

// Timer.set(1000 /* milliseconds */, Timer.REPEAT, function() {
//   showStr(d, "i = " + JSON.stringify(i));
//   print("i = ", i);
//   i++;
// }, null);