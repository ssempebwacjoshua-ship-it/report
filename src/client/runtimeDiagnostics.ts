import {
  getApiBaseUrl,
  getApiTargetHost,
  getAppBasePath,
  getAppBuildTime,
  getAppBuildVersion,
} from "./apiBase";

let logged = false;

export function logRuntimeDiagnostics() {
  if (logged || typeof window === "undefined") return;
  logged = true;

  console.info("[report-lab] runtime", {
    apiBaseUrl: getApiBaseUrl(),
    apiHost: getApiTargetHost(),
    appBasePath: getAppBasePath(),
    buildVersion: getAppBuildVersion(),
    buildTime: getAppBuildTime(),
  });
}
