#include "ssamenj/ReaderGatewayApp.h"

ReaderGatewayApp gatewayApp;

void setup() {
  gatewayApp.begin();
}

void loop() {
  gatewayApp.loop();
}
