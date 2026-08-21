#define TRIG_PIN 18
#define ECHO_PIN 19

void setup() {
  Serial.begin(115200);
  delay(500);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  Serial.println("HC-SR04 isolation test — starting. Wave your hand in front of it.");
}

void loop() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000);

  if (duration == 0) {
    Serial.println("No echo");
  } else {
    float cm = duration * 0.0343 / 2.0;
    Serial.printf("Echo received — duration: %ld us, distance: %.1f cm\n", duration, cm);
  }

  delay(300);
}
