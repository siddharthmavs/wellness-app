// Must be the first import in index.js: persisted stores read localStorage while
// their modules load, so per-user key scoping has to be in place before that.
import { installUserScopedStorage } from "./lib/userStorage";

installUserScopedStorage();
