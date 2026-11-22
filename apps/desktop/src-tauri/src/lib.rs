//! The desktop shell. It opens the window and does one other thing: it tells
//! the frontend where the sidecar is. Everything else (the database, the
//! ledger, the leads) lives in the Node sidecar, in `apps/sidecar`.

use std::{env, fs, path::PathBuf};

use serde::{Deserialize, Serialize};

/// What the sidecar writes to `sidecar.json` each time it starts.
#[derive(Serialize, Deserialize)]
struct SidecarEndpoint {
    port: u16,
    token: String,
}

/// Where Rooms keeps its data. Must match `dataDir` in `apps/sidecar/src/config.ts`.
fn data_dir() -> Result<PathBuf, String> {
    if let Some(dir) = env::var_os("ROOMS_DATA_DIR").filter(|dir| !dir.is_empty()) {
        return Ok(PathBuf::from(dir));
    }

    let home = env::var_os("HOME").ok_or("HOME is not set")?;
    Ok(PathBuf::from(home).join("Library/Application Support/ConduitRooms"))
}

/// Reads the sidecar's port and token, so the built app can call it directly.
/// In development the frontend goes through the Vite proxy and never calls this.
#[tauri::command]
fn sidecar_endpoint() -> Result<SidecarEndpoint, String> {
    let path = data_dir()?.join("sidecar.json");

    let raw = fs::read_to_string(&path)
        .map_err(|_| format!("The sidecar is not running (no {}).", path.display()))?;

    serde_json::from_str(&raw).map_err(|error| format!("{} is malformed: {error}", path.display()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![sidecar_endpoint])
        .run(tauri::generate_context!())
        .expect("error while running Conduit Rooms");
}
