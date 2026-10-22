//! CLI entry points that do not require a running database.
//!
//! `--autostart` installs a user/system systemd unit (or a marked crontab
//! block) that points at the invoked binary or its mise shim, so version
//! upgrades do not leave systemd holding a deleted executable path.
//! `--print-systemd` / `--print-cron` render the same configuration without
//! touching the machine, and `--daemon` detaches the server for manual use.

use std::ffi::{OsStr, OsString};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use clap::{Parser, ValueEnum};

use crate::config::Config;

const SERVICE_NAME: &str = "webdoc.service";
const CRON_BEGIN: &str = "# >>> webdoc autostart >>>";
const CRON_END: &str = "# <<< webdoc autostart <<<";

#[derive(Parser, Debug)]
#[command(
    name = "webdoc",
    version,
    about = "WebDoc website, CMS and API (single self-contained binary)",
    after_help = r#"Examples:
  # Full configuration for the current run
  webdoc --host 0.0.0.0 --port 18620 \
         --api-prefix /api --admin-prefix /admin \
         --mongodb-url "mongodb://user:pass@127.0.0.1:27017/?authSource=admin" \
         --mongodb-db webdoc \
         --jwt-secret "replace-with-a-long-random-secret" \
         --admin-username admin --admin-password "replace-me" \
         --data-dir /var/lib/webdoc --upload-dir /var/lib/webdoc/uploads \
         --cache-dir /tmp/webdoc --cache-ttl 120 \
         --cors-origins "https://example.com"

  # The same flags are accepted by autostart; they are written into the unit/cron
  webdoc --autostart true --autostart-mode both --no-logs \
         --host 0.0.0.0 --port 18620 \
         --api-prefix /api --admin-prefix /admin \
         --mongodb-url "mongodb://127.0.0.1:27017" --mongodb-db webdoc \
         --jwt-secret "replace-with-a-long-random-secret" \
         --admin-username admin --admin-password "replace-me" \
         --data-dir /var/lib/webdoc --upload-dir /var/lib/webdoc/uploads \
         --cache-dir /tmp/webdoc --cache-ttl 120

  # Add --seed to load demo docs/partners/homepage on an empty database
  webdoc --seed --host 127.0.0.1 --port 18620 \
         --mongodb-url "mongodb://127.0.0.1:27017" --mongodb-db webdoc

  # Preview or remove autostart; run detached
  webdoc --print-systemd --host 0.0.0.0 --port 18620
  webdoc --print-cron --host 0.0.0.0 --port 18620
  webdoc --autostart false
  webdoc --daemon --no-logs

  Environment: WEBDOC_HOST, PORT, MONGODB_URI, MONGODB_DB, WEBDOC_DATA_DIR,
  JWT_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD, UPLOAD_DIR, CORS_ORIGINS."#
)]
pub struct Cli {
    /// Install (true) or remove (false) autostart configuration.
    #[arg(long, value_name = "true|false")]
    pub autostart: Option<bool>,

    /// Autostart mechanism used by --autostart.
    #[arg(long, value_enum, default_value_t = AutostartMode::Systemd)]
    pub autostart_mode: AutostartMode,

    /// Print the systemd unit that --autostart would install.
    #[arg(long)]
    pub print_systemd: bool,

    /// Print the crontab block that --autostart would install.
    #[arg(long)]
    pub print_cron: bool,

    /// Detach and run in the background (logs to the data directory).
    #[arg(long)]
    pub daemon: bool,

    /// Do not write a daemon log file (used by generated autostart configs).
    #[arg(long)]
    pub no_logs: bool,

    /// MongoDB connection string (overrides MONGODB_URI).
    #[arg(long, value_name = "URI")]
    pub mongodb_url: Option<String>,

    /// MongoDB database name (overrides MONGODB_DB).
    #[arg(long, value_name = "NAME")]
    pub mongodb_db: Option<String>,

    /// HTTP bind host (overrides WEBDOC_HOST; default 127.0.0.1).
    #[arg(long, value_name = "HOST")]
    pub host: Option<String>,

    /// HTTP port (overrides PORT; default 18620).
    #[arg(long, value_name = "PORT")]
    pub port: Option<u16>,

    /// Public API prefix (default /api).
    #[arg(long, value_name = "PATH")]
    pub api_prefix: Option<String>,

    /// CMS URL prefix (default /admin).
    #[arg(long, value_name = "PATH")]
    pub admin_prefix: Option<String>,

    /// JWT signing secret (overrides JWT_SECRET).
    #[arg(long, value_name = "SECRET")]
    pub jwt_secret: Option<String>,

    /// Admin username created by the first-boot seed.
    #[arg(long, value_name = "NAME")]
    pub admin_username: Option<String>,

    /// Admin password created by the first-boot seed.
    #[arg(long, value_name = "PASSWORD")]
    pub admin_password: Option<String>,

    /// Portable data root (logs, pid, default uploads).
    #[arg(long, value_name = "DIR")]
    pub data_dir: Option<PathBuf>,

    /// Upload directory override.
    #[arg(long, value_name = "DIR")]
    pub upload_dir: Option<PathBuf>,

    /// Public response cache root (default /tmp/webdoc).
    #[arg(long, value_name = "DIR")]
    pub cache_dir: Option<PathBuf>,

    /// Public response cache TTL in seconds (default 120).
    #[arg(long, value_name = "SECONDS")]
    pub cache_ttl: Option<u64>,

    /// Extra CORS origins, comma separated.
    #[arg(long, value_name = "ORIGINS")]
    pub cors_origins: Option<String>,

    /// Development UI dist override.
    #[arg(long, value_name = "DIR")]
    pub ui_dist: Option<PathBuf>,

    /// Development CMS dist override.
    #[arg(long, value_name = "DIR")]
    pub admin_dist: Option<PathBuf>,

    /// Seed demo content (docs, partners, pages, layout) on an empty database.
    #[arg(long)]
    pub seed: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, ValueEnum)]
pub enum AutostartMode {
    Systemd,
    Cron,
    Both,
}

/// Apply CLI overrides that must be effective both for the current run and for
/// generated autostart configuration.
pub fn apply_overrides(cli: &Cli, config: &mut Config) -> Result<(), String> {
    if let Some(url) = cli.mongodb_url.as_deref() {
        let url = url.trim();
        if url.is_empty() {
            return Err("--mongodb-url cannot be empty".to_string());
        }
        config.mongodb_uri = url.to_string();
    }
    if let Some(db) = cli.mongodb_db.as_deref() {
        let db = db.trim();
        if db.is_empty() {
            return Err("--mongodb-db cannot be empty".to_string());
        }
        config.mongodb_db = db.to_string();
    }
    if let Some(host) = cli.host.as_deref() {
        let host = host.trim();
        if host.is_empty() {
            return Err("--host cannot be empty".to_string());
        }
        config.host = host.to_string();
    }
    if let Some(port) = cli.port {
        config.port = port;
    }
    if let Some(prefix) = cli.api_prefix.as_deref() {
        config.api_prefix = crate::config::normalize_prefix_value(prefix, "/api");
    }
    if let Some(prefix) = cli.admin_prefix.as_deref() {
        config.admin_prefix = crate::config::normalize_prefix_value(prefix, "/admin");
    }
    if let Some(secret) = cli.jwt_secret.as_deref() {
        if secret.trim().is_empty() {
            return Err("--jwt-secret cannot be empty".to_string());
        }
        config.jwt_secret = secret.to_string();
    }
    if let Some(name) = cli.admin_username.as_deref() {
        if name.trim().is_empty() {
            return Err("--admin-username cannot be empty".to_string());
        }
        config.admin_username = name.trim().to_string();
    }
    if let Some(password) = cli.admin_password.as_deref() {
        if password.is_empty() {
            return Err("--admin-password cannot be empty".to_string());
        }
        config.admin_password = password.to_string();
    }
    if let Some(dir) = cli.data_dir.as_ref() {
        config.data_dir = crate::config::absolute_path(dir.clone());
        if cli.upload_dir.is_none() && !config.upload_dir_explicit {
            config.upload_dir = config.data_dir.join("uploads");
        }
    }
    if let Some(dir) = cli.upload_dir.as_ref() {
        config.upload_dir = crate::config::absolute_path(dir.clone());
        config.upload_dir_explicit = true;
    }
    if let Some(dir) = cli.cache_dir.as_ref() {
        config.cache_dir = crate::config::absolute_path(dir.clone());
    }
    if let Some(ttl) = cli.cache_ttl {
        if ttl == 0 {
            return Err("--cache-ttl must be greater than 0".to_string());
        }
        config.cache_ttl_secs = ttl;
    }
    if let Some(origins) = cli.cors_origins.as_deref() {
        for origin in origins.split(',').map(str::trim).filter(|v| !v.is_empty()) {
            if !config
                .cors_origins
                .iter()
                .any(|existing| existing == origin)
            {
                config.cors_origins.push(origin.to_string());
            }
        }
    }
    if let Some(dir) = cli.ui_dist.as_ref() {
        config.ui_dist = Some(crate::config::absolute_path(dir.clone()));
    }
    if let Some(dir) = cli.admin_dist.as_ref() {
        config.admin_dist = Some(crate::config::absolute_path(dir.clone()));
    }
    if cli.seed {
        config.seed = true;
    }
    Ok(())
}

/// Handle print/autostart flags. Returns `true` when the process should exit
/// without starting the server.
pub fn handle(cli: &Cli, config: &Config) -> Result<bool, String> {
    if cli.print_systemd || cli.print_cron {
        let exec = invocation_path();
        let data_dir = data_dir(config);
        if cli.print_systemd {
            println!("# {}", unit_path().display());
            print!("{}", systemd_unit(&exec, config, &data_dir, cli.no_logs));
        }
        if cli.print_cron {
            if cli.print_systemd {
                println!();
            }
            print!("{}", cron_block(&exec, config, &data_dir, cli.no_logs));
        }
        return Ok(true);
    }

    match cli.autostart {
        Some(true) => {
            install_autostart(cli, config)?;
            Ok(true)
        }
        Some(false) => {
            remove_autostart(config)?;
            Ok(true)
        }
        None => Ok(false),
    }
}

/// Re-exec in a new session with logs and a pid file. The parent exits after
/// the child has been spawned.
pub fn daemonize(cli: &Cli, config: &Config) -> Result<(), String> {
    #[cfg(not(unix))]
    {
        let _ = (cli, config);
        return Err("--daemon is only supported on Unix".to_string());
    }

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;

        let data_dir = data_dir(config);
        fs::create_dir_all(&data_dir)
            .map_err(|error| format!("cannot create data dir {}: {error}", data_dir.display()))?;

        let log_path = data_dir.join("webdoc.log");
        let (stdout, stderr) = if cli.no_logs {
            (Stdio::null(), Stdio::null())
        } else {
            let file = fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&log_path)
                .map_err(|error| format!("cannot open {}: {error}", log_path.display()))?;
            let clone = file
                .try_clone()
                .map_err(|error| format!("cannot open {}: {error}", log_path.display()))?;
            (Stdio::from(file), Stdio::from(clone))
        };

        let exec = invocation_path();
        let arguments = std::env::args_os()
            .skip(1)
            .filter(|argument| argument.to_str() != Some("--daemon"))
            .collect::<Vec<OsString>>();

        let mut command = Command::new(&exec);
        command
            .args(&arguments)
            .env("WEBDOC_DAEMONIZED", "1")
            .stdin(Stdio::null())
            .stdout(stdout)
            .stderr(stderr);

        // Detach from the invoking terminal/session.
        unsafe {
            command.pre_exec(|| {
                if libc::setsid() == -1 {
                    return Err(std::io::Error::last_os_error());
                }
                Ok(())
            });
        }

        let child = command
            .spawn()
            .map_err(|error| format!("cannot start {}: {error}", exec.display()))?;
        let pid_path = pid_path(config);
        fs::write(&pid_path, format!("{}\n", child.id()))
            .map_err(|error| format!("cannot write {}: {error}", pid_path.display()))?;

        if cli.no_logs {
            println!(
                "webdoc started in background (pid {}), logging disabled",
                child.id()
            );
        } else {
            println!(
                "webdoc started in background (pid {}), logs: {}",
                child.id(),
                log_path.display()
            );
        }
        Ok(())
    }
}

fn install_autostart(cli: &Cli, config: &Config) -> Result<(), String> {
    let exec = invocation_path();
    let data_dir = data_dir(config);
    fs::create_dir_all(&data_dir)
        .map_err(|error| format!("cannot create data dir {}: {error}", data_dir.display()))?;

    if matches!(
        cli.autostart_mode,
        AutostartMode::Systemd | AutostartMode::Both
    ) {
        install_systemd(&exec, config, &data_dir, cli.no_logs)?;
        println!("installed {}", unit_path().display());
    }
    if matches!(
        cli.autostart_mode,
        AutostartMode::Cron | AutostartMode::Both
    ) {
        install_cron(&exec, config, &data_dir, cli.no_logs)?;
        println!("installed webdoc crontab block");
    }
    println!("executable: {}", exec.display());
    Ok(())
}

fn remove_autostart(config: &Config) -> Result<(), String> {
    let _ = run_ignore("systemctl", &["stop", SERVICE_NAME]);
    let _ = run_ignore("systemctl", &["disable", SERVICE_NAME]);
    let _ = run_ignore("systemctl", &["--user", "stop", SERVICE_NAME]);
    let _ = run_ignore("systemctl", &["--user", "disable", SERVICE_NAME]);

    let path = unit_path();
    match fs::remove_file(&path) {
        Ok(()) => println!("removed {}", path.display()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(format!("cannot remove {}: {error}", path.display())),
    }
    let _ = run_ignore("systemctl", &["daemon-reload"]);
    let _ = run_ignore("systemctl", &["--user", "daemon-reload"]);

    remove_cron_block()?;
    stop_daemon(&data_dir(config));
    Ok(())
}

fn install_systemd(
    exec: &Path,
    config: &Config,
    data_dir: &Path,
    no_logs: bool,
) -> Result<(), String> {
    let path = unit_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("cannot create {}: {error}", parent.display()))?;
    }
    fs::write(&path, systemd_unit(exec, config, data_dir, no_logs))
        .map_err(|error| format!("cannot write {}: {error}", path.display()))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
    }

    let user_scope = !is_root();
    let mut commands: Vec<Vec<&str>> = Vec::new();
    if user_scope {
        commands.push(vec!["--user", "daemon-reload"]);
        commands.push(vec!["--user", "enable", "--now", SERVICE_NAME]);
    } else {
        commands.push(vec!["daemon-reload"]);
        commands.push(vec!["enable", "--now", SERVICE_NAME]);
    }
    for arguments in commands {
        run("systemctl", &arguments)?;
    }
    Ok(())
}

fn runtime_args(config: &Config) -> Vec<String> {
    let mut args = vec![
        "--host".to_string(),
        config.host.clone(),
        "--port".to_string(),
        config.port.to_string(),
        "--api-prefix".to_string(),
        config.api_prefix.clone(),
        "--admin-prefix".to_string(),
        config.admin_prefix.clone(),
        "--mongodb-url".to_string(),
        config.mongodb_uri.clone(),
        "--mongodb-db".to_string(),
        config.mongodb_db.clone(),
        "--jwt-secret".to_string(),
        config.jwt_secret.clone(),
        "--admin-username".to_string(),
        config.admin_username.clone(),
        "--admin-password".to_string(),
        config.admin_password.clone(),
        "--data-dir".to_string(),
        config.data_dir.display().to_string(),
        "--upload-dir".to_string(),
        config.upload_dir.display().to_string(),
        "--cache-dir".to_string(),
        config.cache_dir.display().to_string(),
        "--cache-ttl".to_string(),
        config.cache_ttl_secs.to_string(),
    ];
    if !config.cors_origins.is_empty() {
        args.push("--cors-origins".to_string());
        args.push(config.cors_origins.join(","));
    }
    if let Some(dir) = config.ui_dist.as_ref() {
        args.push("--ui-dist".to_string());
        args.push(dir.display().to_string());
    }
    if let Some(dir) = config.admin_dist.as_ref() {
        args.push("--admin-dist".to_string());
        args.push(dir.display().to_string());
    }
    if config.seed {
        args.push("--seed".to_string());
    }
    args
}

fn systemd_unit(exec: &Path, config: &Config, data_dir: &Path, no_logs: bool) -> String {
    let mut parts = vec![systemd_arg(&exec.to_string_lossy())];
    parts.extend(
        runtime_args(config)
            .into_iter()
            .map(|arg| systemd_arg(&arg)),
    );
    if no_logs {
        parts.push("--no-logs".to_string());
    }
    let exec_start = parts.join(" ");
    let target = if is_root() {
        "multi-user.target"
    } else {
        "default.target"
    };

    format!(
        "[Unit]\n\
         Description=WebDoc website, CMS and API\n\
         After=network-online.target mongod.service\n\
         Wants=network-online.target\n\
         \n\
         [Service]\n\
         Type=simple\n\
         WorkingDirectory={working_dir}\n\
         ExecStart={exec_start}\n\
         Restart=on-failure\n\
         RestartSec=3\n\
         NoNewPrivileges=true\n\
         \n\
         [Install]\n\
         WantedBy={target}\n",
        working_dir = systemd_arg(&data_dir.display().to_string()),
        exec_start = exec_start,
        target = target,
    )
}

fn cron_block(exec: &Path, config: &Config, data_dir: &Path, no_logs: bool) -> String {
    let mut parts = vec![shell_quote(&exec.to_string_lossy())];
    parts.extend(
        runtime_args(config)
            .into_iter()
            .map(|arg| shell_quote(&arg)),
    );
    parts.push("--daemon".to_string());
    if no_logs {
        parts.push("--no-logs".to_string());
    }
    let command = parts.join(" ");
    format!(
        "{begin}\n\
         @reboot cd {dir} && {command}\n\
         {end}\n",
        begin = CRON_BEGIN,
        dir = shell_quote(&data_dir.display().to_string()),
        command = command,
        end = CRON_END,
    )
}

fn install_cron(
    exec: &Path,
    config: &Config,
    data_dir: &Path,
    no_logs: bool,
) -> Result<(), String> {
    let existing = read_crontab()?.unwrap_or_default();
    let mut content = strip_cron_block(&existing);
    if !content.is_empty() && !content.ends_with('\n') {
        content.push('\n');
    }
    content.push_str(&cron_block(exec, config, data_dir, no_logs));
    write_crontab(&content)
}

fn remove_cron_block() -> Result<(), String> {
    let Some(existing) = read_crontab()? else {
        return Ok(());
    };
    if !existing.contains(CRON_BEGIN) {
        return Ok(());
    }
    let content = strip_cron_block(&existing);
    write_crontab(&content)?;
    println!("removed webdoc crontab block");
    Ok(())
}

fn strip_cron_block(content: &str) -> String {
    let mut output = String::new();
    let mut skipping = false;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed == CRON_BEGIN {
            skipping = true;
            continue;
        }
        if trimmed == CRON_END {
            skipping = false;
            continue;
        }
        if !skipping {
            output.push_str(line);
            output.push('\n');
        }
    }
    output
}

fn read_crontab() -> Result<Option<String>, String> {
    match Command::new("crontab").arg("-l").output() {
        Ok(output) if output.status.success() => {
            Ok(Some(String::from_utf8_lossy(&output.stdout).into_owned()))
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            if stderr.contains("no crontab") {
                Ok(None)
            } else {
                Err(format!("cannot read crontab: {}", stderr.trim()))
            }
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("cannot run crontab: {error}")),
    }
}

fn write_crontab(content: &str) -> Result<(), String> {
    let mut child = Command::new("crontab")
        .arg("-")
        .stdin(Stdio::piped())
        .spawn()
        .map_err(|error| format!("cannot run crontab: {error}"))?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(content.as_bytes())
            .map_err(|error| format!("cannot write crontab: {error}"))?;
    }
    let status = child
        .wait()
        .map_err(|error| format!("cannot wait for crontab: {error}"))?;
    if !status.success() {
        return Err("crontab rejected the generated configuration".to_string());
    }
    Ok(())
}

fn stop_daemon(data_dir: &Path) {
    #[cfg(unix)]
    {
        let pid_path = data_dir.join("webdoc.pid");
        if let Ok(text) = fs::read_to_string(&pid_path) {
            if let Ok(pid) = text.trim().parse::<i32>() {
                unsafe {
                    libc::kill(pid, libc::SIGTERM);
                }
            }
        }
        let _ = fs::remove_file(pid_path);
    }
    #[cfg(not(unix))]
    {
        let _ = data_dir;
    }
}

pub fn pid_path(config: &Config) -> PathBuf {
    data_dir(config).join("webdoc.pid")
}

fn data_dir(config: &Config) -> PathBuf {
    config.data_dir.clone()
}

fn invocation_path() -> PathBuf {
    let argument = std::env::args_os()
        .next()
        .unwrap_or_else(|| OsString::from("webdoc"));
    let invoked = resolve_invocation(&argument)
        .or_else(|| std::env::current_exe().ok())
        .unwrap_or_else(|| PathBuf::from(argument));

    if let Some(shim) = mise_shim_for(&invoked) {
        if !shim.exists() {
            eprintln!(
                "warning: derived mise shim {} does not exist; install the app with mise first",
                shim.display()
            );
        }
        return shim;
    }
    invoked
}

fn resolve_invocation(argument: &OsStr) -> Option<PathBuf> {
    let path = Path::new(argument);
    if path.is_absolute() {
        return Some(path.to_path_buf());
    }
    if argument
        .to_string_lossy()
        .contains(std::path::MAIN_SEPARATOR)
    {
        return std::env::current_dir().ok().map(|dir| dir.join(path));
    }
    let search_path = std::env::var_os("PATH")?;
    for directory in std::env::split_paths(&search_path) {
        let candidate = directory.join(path);
        if is_executable(&candidate) {
            return Some(candidate);
        }
    }
    None
}

fn mise_shim_for(executable: &Path) -> Option<PathBuf> {
    let display = executable.to_string_lossy();
    if !display.contains("/mise/installs/") {
        return None;
    }
    let data_dir = env_path("MISE_DATA_DIR")
        .or_else(|| env_path("HOME").map(|home| home.join(".local").join("share").join("mise")))?;
    Some(data_dir.join("shims").join(executable.file_name()?))
}

fn is_executable(path: &Path) -> bool {
    let Ok(metadata) = fs::metadata(path) else {
        return false;
    };
    if !metadata.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        metadata.permissions().mode() & 0o111 != 0
    }
    #[cfg(not(unix))]
    {
        true
    }
}

fn unit_path() -> PathBuf {
    if is_root() {
        PathBuf::from("/etc/systemd/system").join(SERVICE_NAME)
    } else {
        let base = env_path("XDG_CONFIG_HOME")
            .or_else(|| env_path("HOME").map(|home| home.join(".config")));
        base.unwrap_or_else(|| PathBuf::from(".config"))
            .join("systemd")
            .join("user")
            .join(SERVICE_NAME)
    }
}

fn is_root() -> bool {
    #[cfg(unix)]
    {
        unsafe { libc::geteuid() == 0 }
    }
    #[cfg(not(unix))]
    {
        false
    }
}

fn env_path(key: &str) -> Option<PathBuf> {
    std::env::var_os(key)
        .map(PathBuf::from)
        .filter(|value| !value.as_os_str().is_empty())
}

fn run(command: &str, arguments: &[&str]) -> Result<(), String> {
    let output = Command::new(command)
        .args(arguments)
        .output()
        .map_err(|error| format!("cannot run {command}: {error}"))?;
    if output.status.success() {
        Ok(())
    } else {
        Err(format!(
            "{command} {} failed: {}",
            arguments.join(" "),
            String::from_utf8_lossy(&output.stderr).trim()
        ))
    }
}

fn run_ignore(command: &str, arguments: &[&str]) -> Result<(), String> {
    match Command::new(command).args(arguments).output() {
        Ok(output) if output.status.success() => Ok(()),
        Ok(output) => Err(String::from_utf8_lossy(&output.stderr).trim().to_string()),
        Err(error) => Err(error.to_string()),
    }
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn systemd_arg(value: &str) -> String {
    let value = value.replace('%', "%%");
    if value
        .chars()
        .any(|character| character.is_whitespace() || character == '"' || character == '\\')
    {
        format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
    } else {
        value
    }
}
