load('api_config.js');
load('api_gpio.js');
load('api_sys.js');
load('api_timer.js');
load('api_rpc.js');
//load('api_dht.js');
load('api_uart.js');
load('api_arduino_ssd1306.js');

let led = 0;
let ip = "??????";
let ssid = Cfg.get('wifi.ap.ssid');

//DHT
// let dht_pin = 13;
// let dht = DHT.create(dht_pin, DHT.DHT11);

//SSD13606
let oled_addr = 0x3C;
let oled = Adafruit_SSD1306.create_i2c(14 /* SCL */, Adafruit_SSD1306.RES_128_64);
oled.begin(Adafruit_SSD1306.SWITCHCAPVCC, oled_addr, true);
oled.display();

let showStr = function (d, text) {
    d.clearDisplay();
    d.setTextSize(1);
    d.setTextColor(Adafruit_SSD1306.WHITE);
    d.setCursor(d.width() / 4, d.height() / 4);
    d.write(text);
    d.display();
};

// Blink built-in LED every second
GPIO.set_mode(led, GPIO.MODE_OUTPUT);
Timer.set(1000, Timer.REPEAT, function () {
    let value = GPIO.toggle(led);
    let status = value ? 'Tick' : 'Tock';
    RPC.call(RPC.LOCAL, 'Sys.GetInfo', {}, function (resp, ud) {
        if (resp.wifi.status === "got ip") {
            ssid = resp.wifi.ssid;
            ip = resp.wifi.sta_ip;
        } else {
            ip = resp.wifi.ap_ip;
        }
    }, null);
    oled.clearDisplay();
    oled.setTextWrap(true);
    oled.setTextSize(1);
    oled.setTextColor(Adafruit_SSD1306.WHITE);
    oled.setCursor(1, 1);
    oled.write('Status:' + status);
    oled.write('\n\n');
    oled.write('Wifi:' + ssid);
    oled.write('\n');
    oled.write('Ip:' + ip);
    oled.write('\n\n');
    // let tp = dht.getTemp();
    // let hd = dht.getHumidity();
    // if (!isNaN(tp) && !isNaN(hd)) {
    //     oled.write(JSON.stringify({H: hd, T: tp}));
    // }
    oled.display();
}, null);

// e32 receiver module config
let e32_high_addr = 0xAF;
let e32_low_addr = 0x02;
let e32_channel = 0x17;//433 MHz
let e32_header = chr(e32_high_addr) + chr(e32_low_addr) + chr(e32_channel);

// e32 module config
let uartNo = 0;  // debug -> 0 , prod -> 1
let m0_pin = 5;  //D1 -> GPIO 5
let m1_pin = 4;  //D2 -> GPIO 4
//let aux_pin = 0; //D3 -> GPIO 0
let rxAcc = '';  // Accumulated Rx data, will be echoed back to Tx

// init e32 pinout
GPIO.set_mode(m0_pin, GPIO.MODE_OUTPUT);
GPIO.set_mode(m1_pin, GPIO.MODE_OUTPUT);
//GPIO.set_mode(aux_pin, GPIO.MODE_OUTPUT);

/**
 * E32 mode
 * general mode m0 = 0 , m1 = 0
 * wake mode m0 = 1 , m1 = 0
 * power save m0 = 0 , m1 = 1
 * sleep mode m0 = 1 , m1 = 1
 * */

//set module wake mode
GPIO.write(m0_pin, GPIO.MODE_OUTPUT);
GPIO.write(m1_pin, GPIO.MODE_INPUT);
//GPIO.write(aux_pin, GPIO.MODE_INPUT);

UART.setConfig(uartNo, {
    baudRate: 115200,
    esp8266: {
        rx: 3,
        tx: 1
    }
});

UART.setDispatcher(uartNo, function (uartNo) {
  let ok = UART.readAvail(uartNo);
  if (ok > 0) {
      let rx_data = UART.read(uartNo);
      showStr(oled, 'recv:' + rx_data);
  }
}, null);

UART.setRxEnabled(uartNo, true);

Timer.set(5000, Timer.REPEAT, function () {
  let write_avail = UART.writeAvail(uartNo);
  if (write_avail) {
      let payload = 'sender';
      UART.write(uartNo, e32_header + payload);
      showStr(oled, payload);
  }
}, null);

/**
 mos wifi pocketap a12345678
 mos config-set debug.level=-1 debug.stderr_uart=-1 debug.stdout_uart=-1
 mos config-set mqtt.enable=true mqtt.server=192.168.1.7:61883 mqtt.user=esp8266 mqtt.pass=123456790
 mos config-set dash.enable=true dash.token=30577b8dd99836adbc47ae72
 mos wifi pocketap a12345678
 */
