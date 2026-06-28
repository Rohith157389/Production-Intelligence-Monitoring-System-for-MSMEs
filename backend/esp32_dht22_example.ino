#include <WiFi.h>
#include <HTTPClient.h>
#include "DHT.h"

// Wi-Fi
const char* ssid = "YOUR_SSID";
const char* password = "YOUR_PASSWORD";

// Backend settings
const char* serverUrl = "http://192.168.1.100:5000/api/sensor-data"; // change to your server IP/port
const char* apiKey = "esp32-dev-key"; // match IOT_API_KEY on backend (if set)

// DHT22 settings
#define DHTPIN 2        // GPIO pin connected to DHT data pin (change if needed)
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(115200);
  delay(100);

  dht.begin();

  WiFi.begin(ssid, password);
  Serial.print("Connecting to Wi-Fi");
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (millis() - start > 20000) {
      Serial.println("\nFailed to connect to Wi-Fi - will retry in 15s");
      delay(15000);
      ESP.restart();
    }
  }
  Serial.println("\nWi-Fi connected.");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  // Read temperature (C)
  float temperature = dht.readTemperature();

  if (isnan(temperature)) {
    Serial.println("DHT22: Failed to read temperature");
  } else {
    Serial.print("Temperature: ");
    Serial.print(temperature);
    Serial.println(" °C");

    // Build JSON payload (send only temperature for testing)
    String payload = "{";
    payload += "\"machine_id\": \"MCH-001\","; // change to your machine id
    payload += "\"temperature\": ";
    payload += String(temperature, 2);
    payload += ", \"timestamp\": \"";
    payload += iso8601Now();
    payload += "\"}";

    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.begin(serverUrl);
      http.addHeader("Content-Type", "application/json");
      http.addHeader("X-API-Key", apiKey);

      int statusCode = http.POST(payload);
      String resp = http.getString();
      Serial.printf("POST %s\n", serverUrl);
      Serial.printf("Status: %d\nResponse: %s\n", statusCode, resp.c_str());

      http.end();
    } else {
      Serial.println("Wi-Fi not connected, skipping POST");
    }
  }

  delay(15000); // wait 15 seconds between readings
}

String iso8601Now() {
  time_t now;
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    // fallback: return a simple timestamp
    unsigned long t = millis() / 1000;
    char buf[32];
    snprintf(buf, sizeof(buf), "%lu", t);
    return String(buf);
  }
  char buf[32];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buf);
}

// getLocalTime requires setting up time; if you want accurate timestamps, consider
// configuring NTP. For testing the backend, the locally-generated millis-based
// timestamp is acceptable.