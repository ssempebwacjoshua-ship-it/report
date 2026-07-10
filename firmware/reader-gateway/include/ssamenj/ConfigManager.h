#pragma once

#include <Arduino.h>

#include "GatewayTypes.h"

class ConfigManager {
 public:
  explicit ConfigManager(const char* path = "/reader-gateway/config.json");

  bool begin();
  bool load(ReaderGatewayConfig& config);
  bool save(const ReaderGatewayConfig& config);
  static ReaderGatewayConfig defaults();

 private:
  String path_;
};
