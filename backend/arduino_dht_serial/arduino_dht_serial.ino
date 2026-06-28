#include <DHT.h>
#include <Wire.h>

#define DHTPIN 2
#define DHTTYPE DHT22
#define IRPIN 3
#define CURRENT_POT A0 // Potentiometer 1 (Current)
#define VOLTAGE_POT A1 // Potentiometer 2 (Voltage)

const int MPU_ADDR = 0x68; // Standard I2C address for MPU-6050 (A4=SDA, A5=SCL)

DHT dht(DHTPIN, DHTTYPE);

int objectCount = 0;
int lastIrState = HIGH;
unsigned long lastSendTime = 0;
unsigned long lastObjectTime = 0;

// Track the maximum vibration observed during the 1-second window
float maxVibration = 0.0;

void setup() {
  Serial.begin(115200);
  dht.begin();
  pinMode(IRPIN, INPUT_PULLUP);

  // Initialize the MPU-6050 accelerometer over I2C (A4 = SDA, A5 = SCL)
  Wire.begin();
  #if defined(WIRE_HAS_TIMEOUT)
  Wire.setWireTimeout(3000, true); // Prevent freezing if MPU is disconnected
  #endif
  
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B); // PWR_MGMT_1 register
  Wire.write(0);    // Wake up
  Wire.endTransmission(true);
}

void loop() {
  // 1. Read IR Sensor
  int currentIrState = digitalRead(IRPIN);
  
  if (lastIrState == HIGH && currentIrState == LOW) {
    if (millis() - lastObjectTime > 500) {
      objectCount++;
      lastObjectTime = millis();
    }
  }
  lastIrState = currentIrState;

  // 2. Read REAL Vibration from MPU-6050
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B); // Starting with register 0x3B (ACCEL_XOUT_H)
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, 6, true);
  
  if (Wire.available() >= 6) {
    int16_t ax = Wire.read() << 8 | Wire.read();
    int16_t ay = Wire.read() << 8 | Wire.read();
    int16_t az = Wire.read() << 8 | Wire.read();

    // Calculate total acceleration vector magnitude (in g's)
    float ax_g = ax / 16384.0;
    float ay_g = ay / 16384.0;
    float az_g = az / 16384.0;
    float magnitude = sqrt(ax_g * ax_g + ay_g * ay_g + az_g * az_g);

    // Subtract 1g (gravity) and scale to get a simulated mm/s value (roughly maps to 0.5 - 4.0 ranges)
    float currentVibration = abs(magnitude - 1.0) * 10.0; 
    
    // Some noise floor to match normal range 0.5 - 2.0 even when still
    if (currentVibration < 0.5) {
      currentVibration = 0.5 + (random(0, 50) / 100.0); // Random noise 0.5 - 1.0
    }

    if (currentVibration > maxVibration) {
      maxVibration = currentVibration;
    }
  }

  // 3. Send data every 1000 ms (1 second)
  if (millis() - lastSendTime >= 1000) {
    lastSendTime = millis();
    
    // Read Temperature
    float temp = dht.readTemperature();
    if (isnan(temp)) {
      temp = 24.5;
    }

    // Read Potentiometers for manual control
    int currentPot = analogRead(CURRENT_POT);
    int voltagePot = analogRead(VOLTAGE_POT);

    // Map 0-1023 to 0 - 15.0 Amps (Allows testing Normal/Warning/Critical)
    float current = (currentPot / 1023.0) * 15.0;      
    
    // Map 0-1023 to 190 - 250 Volts (Allows testing Critical/Warning/Normal)
    float voltage = 190.0 + ((voltagePot / 1023.0) * 60.0);     

    // Output the peak vibration tracked in the last second
    float finalVibration = maxVibration;
    
    // Reset maxVibration for the next second's cycle
    maxVibration = 0.0;

    // Prepare JSON payload
    Serial.print('{');
    Serial.print("\"machine_id\":\"MCH-001\"");
    Serial.print(',');
    Serial.print("\"temperature\":");
    Serial.print(temp, 2);
    Serial.print(',');
    Serial.print("\"current\":");
    Serial.print(current, 2);
    Serial.print(',');
    Serial.print("\"voltage\":");
    Serial.print(voltage, 2);
    Serial.print(',');
    Serial.print("\"vibration\":");
    Serial.print(finalVibration, 2);
    Serial.print(',');
    Serial.print("\"object_count\":");
    Serial.print(objectCount);
    Serial.println('}');
  }
}
