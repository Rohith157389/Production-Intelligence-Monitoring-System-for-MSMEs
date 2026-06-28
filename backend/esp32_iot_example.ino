#include <WiFi.h>
#include <HTTPClient.h>

// Replace with your Wi-Fi credentials
const char* ssid = "YOUR_SSID";
const char* password = "YOUR_PASSWORD";

// Replace with your backend URL and API key
const char* serverUrl = "http://192.168.1.100:5000/api/sensor-data";
const char* apiKey = "esp32-dev-key";

void setup() {
  Serial.begin(115200);
  delay(100);

  WiFi.begin(ssid, password);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected.");
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-API-Key", apiKey);

    String payload = R"REQLITERAL({
      "machine_id": "MCH-001",
      "current": 9.4,
      "voltage": 219.6,
      "temperature": 58.2,
      "vibration": 0.14,
      "rpm": 1220,
      "object_count": 42,
      "timestamp": "2026-06-01T12:00:00Z"
    })REQLITERAL";

    int httpResponseCode = http.POST(payload);
    String response = http.getString();

    Serial.printf("POST %s\n", serverUrl);
    Serial.printf("Response code: %d\n", httpResponseCode);
    Serial.printf("Response body: %s\n", response.c_str());

    http.end();
  } else {
    Serial.println("Wi-Fi disconnected, reconnecting...");
    WiFi.reconnect();
  }

  delay(15000); // Send every 15 seconds
}
