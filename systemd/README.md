# Systemd Service Files

These service files allow the application to run as system services on Linux, with automatic restart on failure and startup on boot.

## Installation

1. **Copy service files to systemd directory:**

```bash
sudo cp systemd/france-renovation-backend.service /etc/systemd/system/
sudo cp systemd/france-renovation-bot.service /etc/systemd/system/
```

2. **Edit service files to match your setup:**

```bash
sudo nano /etc/systemd/system/france-renovation-backend.service
```

Update:
- `User=` - Change to your EC2 username (e.g., `ec2-user` for Amazon Linux, `ubuntu` for Ubuntu)
- `WorkingDirectory=` - Verify path is correct
- `ExecStart=` - Verify paths are correct
- `--workers 4` - Adjust based on CPU cores

3. **Reload systemd and enable services:**

```bash
sudo systemctl daemon-reload
sudo systemctl enable france-renovation-backend
sudo systemctl enable france-renovation-bot  # If using Zulip bot
```

4. **Start services:**

```bash
sudo systemctl start france-renovation-backend
sudo systemctl start france-renovation-bot  # If using Zulip bot
```

## Management Commands

### Check Status
```bash
sudo systemctl status france-renovation-backend
sudo systemctl status france-renovation-bot
```

### View Logs
```bash
sudo journalctl -u france-renovation-backend -f
sudo journalctl -u france-renovation-bot -f
```

### Restart Services
```bash
sudo systemctl restart france-renovation-backend
sudo systemctl restart france-renovation-bot
```

### Stop Services
```bash
sudo systemctl stop france-renovation-backend
sudo systemctl stop france-renovation-bot
```

### Disable Auto-Start
```bash
sudo systemctl disable france-renovation-backend
sudo systemctl disable france-renovation-bot
```

## Notes

- Services will automatically restart on failure
- Services will start on system boot (if enabled)
- Logs are written to both journalctl and application logs directory
- Make sure `.env` file exists and is properly configured
- Ensure Python venv is set up correctly
- Verify file permissions allow the user to access all required files



