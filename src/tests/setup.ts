import "@testing-library/jest-dom/vitest";
import { resolveSafeTestDatabaseEnvironment } from "./testDatabaseEnvironment";

const resolution = resolveSafeTestDatabaseEnvironment();

process.env.DATABASE_URL = resolution.envOverride.DATABASE_URL;
process.env.TEST_DATABASE_URL = resolution.envOverride.TEST_DATABASE_URL;
process.env.NODE_ENV = "test";
