#include <ESP32Servo.h>

#define SERVO_PIN 21

Servo testServo;

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("Servo isolation test — starting.");
  testServo.attach(SERVO_PIN);
}

void loop() {
  Serial.println("Moving to 90 (OPEN)");
  testServo.write(90);
  delay(2000);

  Serial.println("Moving to 0 (CLOSED)");
  testServo.write(0);
  delay(2000);
}
