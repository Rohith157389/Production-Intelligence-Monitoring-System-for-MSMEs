void setup() {
  Serial.begin(115200);
  // seed rand from an unconnected analog pin for variability
  randomSeed(analogRead(A0));
}

void loop() {
  // Generate example sensor values
  float temperature = 20.0 + (random(0, 1000) / 100.0); // 20.00 - 30.00
  float current = (random(0, 1000) / 100.0); // 0.00 - 10.00 A
  float voltage = 210.0 + (random(0, 400) / 100.0); // 210.00 - 214.00 V
  int rpm = random(0, 2000);
  int objectCount = random(0, 10);

  // Build compact JSON payload matching backend expectations
  // Example: {"machineId":"MCH-001","temperature":25.34,"current":5.20,"voltage":212.34,"rpm":1200,"objectCount":3,"source":"test"}
  Serial.print('{');
  Serial.print("\"machineId\":\"MCH-001\"");
  Serial.print(',');
  Serial.print("\"temperature\":");
  Serial.print(temperature, 2);
  Serial.print(',');
  Serial.print("\"current\":");
  Serial.print(current, 2);
  Serial.print(',');
  Serial.print("\"voltage\":");
  Serial.print(voltage, 2);
  Serial.print(',');
  Serial.print("\"rpm\":");
  Serial.print(rpm);
  Serial.print(',');
  Serial.print("\"objectCount\":");
  Serial.print(objectCount);
  Serial.print(',');
  Serial.print("\"source\":\"test\"");
  Serial.println('}');

  delay(2000);
}
