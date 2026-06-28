#include <DHT.h>

#define DHTPIN 2
#define DHTTYPE DHT22

DHT dht(DHTPIN, DHTTYPE);

int simulatedObjectCount = 0;

void setup() {
  Serial.begin(115200);
  dht.begin();
  randomSeed(analogRead(0));
}

void loop() {
  float temp = dht.readTemperature();

  if (isnan(temp)) {
    temp = 24.5;
  }

  // Simulate other parameters since only DHT22 temperature is connected
  float current = 8.5 + (random(-150, 150) / 100.0); // 7.0A - 10.0A
  float voltage = 220.0 + (random(-1000, 1000) / 100.0); // 210V - 230V
  float vibration = 0.12 + (random(-50, 50) / 1000.0); // 0.07 - 0.17
  int rpm = 1450 + random(-50, 50);

  // Increment object count when the machine is running (current > 0)
  if (current > 0.0 && random(0, 10) > 3) {
    simulatedObjectCount += random(1, 3);
  }

  // Prepare a compact JSON line for the bridge to read
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
  Serial.print(vibration, 4);
  Serial.print(',');
  Serial.print("\"rpm\":");
  Serial.print(rpm);
  Serial.print(',');
  Serial.print("\"object_count\":");
  Serial.print(simulatedObjectCount);
  Serial.println('}');

  delay(2000); // send every 2s for testing
}
