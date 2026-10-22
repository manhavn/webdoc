// Copy the built front-end bundles into `embed/` before `rust-embed` reads
// them at compile time. Missing dist folders are fine: the embed directories
// then only contain `.gitkeep` and the binary falls back to `UI_DIST` /
// `ADMIN_DIST` (development) or reports that the build is unavailable.

use std::env;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

fn main() {
    println!("cargo:rerun-if-changed=build.rs");

    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR"));
    let project_root = manifest_dir
        .parent()
        .expect("webdoc-api must live inside the webdoc project")
        .to_path_buf();

    for (name, relative) in [("ui", "webdoc-ui/dist"), ("admin", "webdoc-admin/dist")] {
        let source = project_root.join(relative);
        let destination = manifest_dir.join("embed").join(name);

        fs::create_dir_all(&destination).expect("create embed directory");
        println!("cargo:rerun-if-changed={}", source.display());

        if source.is_dir() {
            if let Err(error) = reset_and_copy(&source, &destination) {
                panic!(
                    "failed to copy {} into {}: {error}",
                    source.display(),
                    destination.display()
                );
            }
        }
    }
}

/// Replace everything except `.gitkeep` with the current build output.
fn reset_and_copy(source: &Path, destination: &Path) -> io::Result<()> {
    for entry in fs::read_dir(destination)? {
        let entry = entry?;
        if entry.file_name() == ".gitkeep" {
            continue;
        }
        let path = entry.path();
        if entry.file_type()?.is_dir() {
            fs::remove_dir_all(path)?;
        } else {
            fs::remove_file(path)?;
        }
    }
    copy_directory(source, destination)
}

fn copy_directory(source: &Path, destination: &Path) -> io::Result<()> {
    fs::create_dir_all(destination)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let target = destination.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_directory(&entry.path(), &target)?;
        } else {
            fs::copy(entry.path(), target)?;
        }
    }
    Ok(())
}
