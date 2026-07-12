#pragma once

#include <Arduino.h>
#include <vector>

#include "GatewayTypes.h"

class OfflineQueue {
 public:
  explicit OfflineQueue(const char* path = "/reader-gateway/queue.ndjson");

  bool begin();
  bool enqueue(const ReaderScanEvent& event);
  bool peek(ReaderScanEvent& event);
  bool pop();
  bool updateFront(const ReaderScanEvent& event);
  bool clear();
  size_t size() const;

 private:
  bool loadAll(std::vector<ReaderScanEvent>& events) const;
  bool rewriteAll(const std::vector<ReaderScanEvent>& events);
  bool parseEventLine(const String& line, ReaderScanEvent& event) const;
  String serializeEvent(const ReaderScanEvent& event);

  String path_;
};
