#include "ssamenj/OfflineQueue.h"

#include <LittleFS.h>
#include <ArduinoJson.h>

namespace {
const char* kQueueRewriteTempPath = "/reader-gateway/queue.tmp";
const char* kQueueRewriteBackupPath = "/reader-gateway/queue.bak";

bool replaceFileAtomically(const char* tempPath, const String& finalPath) {
  if (LittleFS.exists(kQueueRewriteBackupPath)) {
    LittleFS.remove(kQueueRewriteBackupPath);
  }

  if (LittleFS.exists(finalPath)) {
    if (!LittleFS.rename(finalPath.c_str(), kQueueRewriteBackupPath)) {
      LittleFS.remove(tempPath);
      return false;
    }
  }

  if (!LittleFS.rename(tempPath, finalPath.c_str())) {
    if (LittleFS.exists(kQueueRewriteBackupPath)) {
      LittleFS.rename(kQueueRewriteBackupPath, finalPath.c_str());
    }
    return false;
  }

  if (LittleFS.exists(kQueueRewriteBackupPath)) {
    LittleFS.remove(kQueueRewriteBackupPath);
  }
  return true;
}
}  // namespace

OfflineQueue::OfflineQueue(const char* path) : path_(path) {}

bool OfflineQueue::begin() {
  if (!LittleFS.exists("/reader-gateway")) {
    LittleFS.mkdir("/reader-gateway");
  }
  if (!LittleFS.exists(path_)) {
    File file = LittleFS.open(path_, FILE_WRITE);
    if (!file) {
      return false;
    }
    file.close();
  }
  return true;
}

String OfflineQueue::serializeEvent(const ReaderScanEvent& event) {
  JsonDocument doc;
  doc["eventId"] = event.eventId;
  doc["credential"] = event.credential;
  doc["format"] = event.format;
  doc["deviceTime"] = event.deviceTime;
  doc["readerId"] = event.readerId;
  doc["schoolId"] = event.schoolId;
  doc["deviceId"] = event.deviceId;
  doc["firmwareVersion"] = event.firmwareVersion;
  doc["retryCount"] = event.retryCount;
  doc["syncStatus"] = event.syncStatus;

  String output;
  serializeJson(doc, output);
  return output;
}

bool OfflineQueue::parseEventLine(const String& line, ReaderScanEvent& event) {
  JsonDocument doc;
  const DeserializationError error = deserializeJson(doc, line);
  if (error) {
    return false;
  }

  event.eventId = doc["eventId"] | "";
  event.credential = doc["credential"] | "";
  event.format = doc["format"] | "";
  event.deviceTime = doc["deviceTime"] | "";
  event.readerId = doc["readerId"] | "";
  event.schoolId = doc["schoolId"] | "";
  event.deviceId = doc["deviceId"] | "";
  event.firmwareVersion = doc["firmwareVersion"] | "";
  event.retryCount = doc["retryCount"] | 0UL;
  event.syncStatus = doc["syncStatus"] | "pending";
  return !event.eventId.isEmpty();
}

bool OfflineQueue::loadAll(std::vector<ReaderScanEvent>& events) {
  events.clear();
  File file = LittleFS.open(path_, FILE_READ);
  if (!file) {
    return false;
  }

  while (file.available()) {
    String line = file.readStringUntil('\n');
    line.trim();
    if (line.isEmpty()) {
      continue;
    }
    ReaderScanEvent event;
    if (parseEventLine(line, event)) {
      events.push_back(event);
    }
  }

  file.close();
  return true;
}

bool OfflineQueue::rewriteAll(const std::vector<ReaderScanEvent>& events) {
  File file = LittleFS.open(kQueueRewriteTempPath, FILE_WRITE);
  if (!file) {
    return false;
  }

  for (const auto& event : events) {
    file.println(serializeEvent(event));
  }

  file.close();
  return replaceFileAtomically(kQueueRewriteTempPath, path_);
}

bool OfflineQueue::enqueue(const ReaderScanEvent& event) {
  File file = LittleFS.open(path_, FILE_APPEND);
  if (!file) {
    return false;
  }

  file.println(serializeEvent(event));
  file.close();
  return true;
}

bool OfflineQueue::peek(ReaderScanEvent& event) {
  std::vector<ReaderScanEvent> events;
  if (!loadAll(events) || events.empty()) {
    return false;
  }
  event = events.front();
  return true;
}

bool OfflineQueue::pop() {
  std::vector<ReaderScanEvent> events;
  if (!loadAll(events) || events.empty()) {
    return false;
  }
  events.erase(events.begin());
  return rewriteAll(events);
}

bool OfflineQueue::updateFront(const ReaderScanEvent& event) {
  std::vector<ReaderScanEvent> events;
  if (!loadAll(events) || events.empty()) {
    return false;
  }
  events.front() = event;
  return rewriteAll(events);
}

size_t OfflineQueue::size() {
  std::vector<ReaderScanEvent> events;
  if (!loadAll(events)) {
    return 0;
  }
  return events.size();
}
